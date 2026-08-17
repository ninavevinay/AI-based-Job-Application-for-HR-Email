import io
import os
from email.message import EmailMessage

import pdfplumber
import smtplib
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db import (
    authenticate_user,
    change_user_password,
    create_jwt_token,
    create_session,
    create_user,
    delete_application_log,
    delete_session,
    get_or_create_google_user,
    get_user_application_logs,
    get_user_by_email,
    get_user_by_jwt,
    get_user_by_token,
    get_user_stats,
    init_db,
    record_application_log,
    serialize_user,
    update_user_name,
)
from model import (
    AuthRequest,
    ChangePasswordRequest,
    EmailRequest,
    GoogleAuthRequest,
    LoginRequest,
    UpdateProfileRequest,
)
from service import EmailGenerator


app = FastAPI(title="AI Job Application Studio API")

try:
    init_db()
except Exception as db_err:
    print(f"Database initialization note: {db_err}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "Backend is Running with PostgreSQL & OAuth"}


def get_token_from_header(authorization: str | None = Header(default=None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header is required")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Bearer token is required")

    return token


def require_user(token: str = Depends(get_token_from_header)):
    user = get_user_by_token(token)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


def send_mail(
    to: str,
    subject: str,
    body: str,
    from_email: str | None = None,
    reply_to: str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_name: str | None = None,
) -> None:
    if not to:
        return

    smtp_email = os.getenv("EMAIL", "").strip()
    smtp_password = os.getenv("APP_PASSWORD", "").strip()

    if not smtp_email or not smtp_password:
        raise HTTPException(
            status_code=500,
            detail="SMTP credentials (EMAIL and APP_PASSWORD) are not configured in backend/.env",
        )

    msg = EmailMessage()
    msg["From"] = from_email or smtp_email
    msg["To"] = to
    msg["Subject"] = subject

    if reply_to:
        msg["Reply-To"] = reply_to

    msg.set_content(body)

    if attachment_bytes and attachment_name:
        msg.add_attachment(
            attachment_bytes,
            maintype="application",
            subtype="pdf",
            filename=attachment_name,
        )

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(smtp_email, smtp_password)
        server.send_message(msg)


def notify_registration(user: dict) -> list[str]:
    notifications_sent: list[str] = []

    user_email = user.get("email")
    user_name = user.get("name", "Applicant")

    if user_email:
        try:
            send_mail(
                to=user_email,
                subject="Welcome to AI Job Application Studio 🎉",
                body=(
                    f"Hi {user_name},\n\n"
                    "Welcome to AI Job Application Studio!\n\n"
                    "Your account has been successfully set up. You can now:\n"
                    "1. Upload your PDF resume.\n"
                    "2. Automatically tailor high-impact application emails for any job position.\n"
                    "3. Send the application and resume directly to HR with automatic confirmation sent to your mailbox.\n\n"
                    "Best regards,\n"
                    "AI Job Application Studio Team"
                ),
            )
            notifications_sent.append("user")
        except Exception as err:
            print(f"Error sending welcome email to user: {err}")

    hr_email = os.getenv("HR_EMAIL", "").strip()
    if hr_email:
        try:
            send_mail(
                to=hr_email,
                subject=f"New User Registration: {user_name}",
                body=(
                    f"Hello HR / Admin,\n\n"
                    f"A new user registered on AI Job Application Studio.\n\n"
                    f"Name: {user_name}\n"
                    f"Email: {user_email}\n"
                    f"Provider: {user.get('auth_provider', 'local')}\n"
                    f"Registered At: {user.get('created_at')}\n\n"
                    "AI Job Application Studio"
                ),
                from_email=user_email,
                reply_to=user_email,
            )
            notifications_sent.append("hr")
        except Exception as err:
            print(f"Error sending notification to HR: {err}")

    return notifications_sent


def verify_google_token(credential: str) -> dict:
    """Verifies a Google OAuth ID Token (JWT) and returns token claims."""
    google_client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip() or None

    # First attempt: Google official auth library
    try:
        req = google_requests.Request()
        id_info = id_token.verify_oauth2_token(
            credential,
            req,
            google_client_id,
            clock_skew_in_seconds=10,
        )
        return id_info
    except Exception as lib_err:
        print(f"google-auth verify failed ({lib_err}), trying Google tokeninfo endpoint...")

    # Second attempt: Google tokeninfo API endpoint
    try:
        resp = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}",
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            if "email" in data:
                return data
        raise ValueError(f"Google tokeninfo response invalid: {resp.text}")
    except Exception as endpoint_err:
        raise HTTPException(
            status_code=401,
            detail=f"Google token verification failed: {str(endpoint_err)}",
        )


@app.post("/register")
def register(payload: AuthRequest):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    if not payload.email or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")

    if not payload.password or len(payload.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long",
        )

    existing_user = get_user_by_email(payload.email)
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="Email is already registered")

    user = create_user(payload.name, payload.email, payload.password)
    token = create_session(user["id"])
    notifications_sent = []
    try:
        notifications_sent = notify_registration(user)
    except Exception as exc:
        print(f"Registration notification warning: {exc}")

    return {
        "status": "success",
        "token": token,
        "user": serialize_user(user),
        "notifications_sent": notifications_sent,
    }


@app.post("/login")
def login(payload: LoginRequest):
    user = authenticate_user(payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_session(user["id"])
    return {
        "status": "success",
        "token": token,
        "user": serialize_user(user),
    }


@app.post("/auth/google")
def google_auth(payload: GoogleAuthRequest):
    if not payload.credential:
        raise HTTPException(status_code=400, detail="Google credential token is required")

    google_data = verify_google_token(payload.credential)

    google_id = google_data.get("sub")
    email = google_data.get("email")
    name = google_data.get("name") or google_data.get("given_name") or "Google User"
    avatar_url = google_data.get("picture")

    if not email or not google_id:
        raise HTTPException(status_code=400, detail="Invalid Google profile data received")

    user, is_new_user = get_or_create_google_user(
        google_id=google_id,
        email=email,
        name=name,
        avatar_url=avatar_url,
    )

    token = create_session(user["id"])

    # If it's a new user joining via Google, send welcome email to their Google email
    notifications_sent = []
    if is_new_user:
        try:
            notifications_sent = notify_registration(user)
        except Exception as exc:
            print(f"Google OAuth welcome email warning: {exc}")

    return {
        "status": "success",
        "token": token,
        "user": serialize_user(user),
        "is_new_user": is_new_user,
        "notifications_sent": notifications_sent,
    }


@app.get("/me")
def me(user=Depends(require_user)):
    stats = get_user_stats(user["id"])
    return {
        "status": "success",
        "user": serialize_user(user),
        "stats": stats,
    }


@app.put("/me/profile")
def update_profile(payload: UpdateProfileRequest, user=Depends(require_user)):
    updated_user = update_user_name(user["id"], payload.name)
    if not updated_user:
        raise HTTPException(status_code=400, detail="Invalid name provided")
    return {
        "status": "success",
        "message": "Profile updated successfully",
        "user": serialize_user(updated_user),
    }


@app.put("/me/password")
def update_password(payload: ChangePasswordRequest, user=Depends(require_user)):
    success, message = change_user_password(
        user_id=user["id"],
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {
        "status": "success",
        "message": message,
    }


@app.get("/applications")
def get_applications(user=Depends(require_user)):
    logs = get_user_application_logs(user["id"])
    return {
        "status": "success",
        "applications": logs,
        "count": len(logs),
    }


@app.delete("/applications/{app_id}")
def delete_application(app_id: int, user=Depends(require_user)):
    deleted = delete_application_log(user["id"], app_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Application log not found")
    return {
        "status": "success",
        "message": "Application log deleted successfully",
    }


@app.get("/stats")
def get_stats(user=Depends(require_user)):
    stats = get_user_stats(user["id"])
    return {
        "status": "success",
        "stats": stats,
    }


@app.post("/logout")
def logout(token: str = Depends(get_token_from_header)):
    delete_session(token)
    return {"status": "success", "message": "Successfully logged out"}



@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    user=Depends(require_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_bytes = await file.read()
    text = ""

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from the PDF. Please check if the PDF is text-based.",
        )

    return {
        "status": "success",
        "filename": file.filename,
        "resume_text": text.strip(),
    }


@app.post("/generate-application")
def generate_application(email: EmailRequest, user=Depends(require_user)):
    generator = EmailGenerator()
    response = generator.generate_application_from_resume_text(
        resume_text=email.resume_text,
        job_position=email.job_position,
        job_description=email.job_description,
        from_email=email.from_email or user["email"],
        to_email=email.to_email,
        candidate_name=email.candidate_name or user["name"],
    )
    if response.get("status", "").startswith("error"):
        raise HTTPException(status_code=500, detail=response["status"])
    return response


@app.post("/generate-email")
def generate_email(email: EmailRequest, user=Depends(require_user)):
    return generate_application(email, user)


@app.post("/send-email")
async def send_email(
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    from_email: str = Form(...),
    resume: UploadFile = File(...),
    user=Depends(require_user),
):
    to_recipient = to.strip()
    sender_email = from_email.strip() or user["email"]
    main_user_email = user["email"]

    if not to_recipient:
        raise HTTPException(status_code=400, detail="HR / Recipient email is required")

    pdf_data = await resume.read()

    # 1. Send application email to HR
    try:
        send_mail(
            to=to_recipient,
            subject=subject,
            body=body,
            from_email=os.getenv("EMAIL"),
            reply_to=sender_email,
            attachment_bytes=pdf_data,
            attachment_name=resume.filename or "Resume.pdf",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email to HR ({to_recipient}): {str(exc)}",
        )

    # 2. Send confirmation copy to Main User email
    user_copy_sent = False
    try:
        if main_user_email:
            send_mail(
                to=main_user_email,
                subject=f"[Confirmation Copy] {subject}",
                body=(
                    f"Hi {user['name']},\n\n"
                    f"Your job application has been successfully sent to {to_recipient}.\n\n"
                    "--- APPLICATION COPY ---\n\n"
                    f"{body}\n\n"
                    "------------------------\n"
                    "A copy of your attached resume is included with this email.\n\n"
                    "Best regards,\n"
                    "AI Job Application Studio"
                ),
                from_email=os.getenv("EMAIL"),
                reply_to=sender_email,
                attachment_bytes=pdf_data,
                attachment_name=resume.filename or "Resume.pdf",
            )
            user_copy_sent = True
    except Exception as exc:
        print(f"Warning: Failed to send copy to main user ({main_user_email}): {exc}")

    # 3. Record in database log
    try:
        record_application_log(
            user_id=user["id"],
            job_position=subject,
            hr_email=to_recipient,
            subject=subject,
            body=body,
        )
    except Exception as exc:
        print(f"Warning: Failed to record application log: {exc}")

    return {
        "status": "success",
        "message": f"Email successfully sent to HR ({to_recipient})"
        + (f" and confirmation copy sent to your email ({main_user_email})" if user_copy_sent else ""),
        "delivered_to": [to_recipient] + ([main_user_email] if user_copy_sent else []),
    }
