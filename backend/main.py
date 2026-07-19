import io
import os
from email.message import EmailMessage

import pdfplumber
import smtplib
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from db import (
    authenticate_user,
    create_session,
    create_user,
    delete_session,
    get_user_by_email,
    get_user_by_token,
    init_db,
    serialize_user,
)
from model import AuthRequest, EmailRequest, LoginRequest
from service import EmailGenerator

app = FastAPI()
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "Backend is Running"}


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
) -> None:
    if not to:
        return

    msg = EmailMessage()
    msg["From"] = from_email or os.getenv("EMAIL")
    msg["To"] = to
    msg["Subject"] = subject

    if reply_to:
        msg["Reply-To"] = reply_to

    msg.set_content(body)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(
            os.getenv("EMAIL"),
            os.getenv("APP_PASSWORD"),
        )
        server.send_message(msg)


def notify_registration(user) -> list[str]:
    notifications_sent: list[str] = []

    send_mail(
        to=user["email"],
        subject="Welcome to AI Job Application Studio",
        body=(
            f"Hi {user['name']},\n\n"
            "Your account has been created successfully.\n"
            "You can now log in and generate job application emails from your resume.\n\n"
            "Best regards,\n"
            "AI Job Application Studio"
        ),
        from_email=os.getenv("EMAIL"),
    )
    notifications_sent.append("user")

    hr_email = os.getenv("HR_EMAIL", "").strip()
    if hr_email:
        send_mail(
            to=hr_email,
            subject=f"New user registration: {user['name']}",
            body=(
                f"Hello HR,\n\n"
                f"A new user has registered in the application.\n\n"
                f"Name: {user['name']}\n"
                f"Email: {user['email']}\n"
                f"Registered At: {user['created_at']}\n\n"
                "You can review this account if needed.\n"
            ),
            from_email=user["email"],
            reply_to=user["email"],
        )
        notifications_sent.append("hr")

    return notifications_sent



@app.post("/register")
def register(payload: AuthRequest):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    existing_user = get_user_by_email(payload.email)
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="Email is already registered")

    user = create_user(payload.name, payload.email, payload.password)
    token = create_session(user["id"])
    notifications_sent = []
    try:
        notifications_sent = notify_registration(user)
    except Exception as exc:
        print(f"Registration notification failed: {exc}")

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


@app.get("/me")
def me(user=Depends(require_user)):
    return {
        "status": "success",
        "user": serialize_user(user),
    }


@app.post("/logout")
def logout(token: str = Depends(get_token_from_header)):
    delete_session(token)
    return {"status": "success"}


@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    user=Depends(require_user),
):
    file_bytes = await file.read()
    text = ""

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    return {"resume_text": text}


@app.post("/generate-application")
def generate_application(email: EmailRequest, user=Depends(require_user)):
    response = EmailGenerator().generate_application_from_resume_text(
        **email.model_dump()
    )
    return response


@app.post("/generate-email")
def generate_email(email: EmailRequest, user=Depends(require_user)):
    response = EmailGenerator().generate_application_from_resume_text(
        **email.model_dump()
    )
    return response


@app.post("/send-email")
async def send_email(
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    from_email: str = Form(...),
    resume: UploadFile = File(...),
    user=Depends(require_user),
):
    msg = EmailMessage()

    sender_email = from_email.strip()
    if not sender_email:
        raise HTTPException(status_code=400, detail="From Email is required")

    msg["From"] = sender_email
    msg["To"] = to
    msg["Subject"] = subject

    msg["Reply-To"] = sender_email

    msg.set_content(body)

    pdf_data = await resume.read()
    msg.add_attachment(
        pdf_data,
        maintype="application",
        subtype="pdf",
        filename=resume.filename,
    )

    with smtplib.SMTP_SSL(
        "smtp.gmail.com",
        465,
    ) as server:
        server.login(
            os.getenv("EMAIL"),
            os.getenv("APP_PASSWORD"),
        )
        server.send_message(msg)

    return {
        "status": "success",
        "message": "Email sent successfully",
    }
