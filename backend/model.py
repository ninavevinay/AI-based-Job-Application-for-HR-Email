from pydantic import BaseModel


class AuthRequest(BaseModel):
    name: str | None = None
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class EmailRequest(BaseModel):
    resume_text: str
    job_position: str
    job_description: str = ""
    from_email: str = ""
    to_email: str = ""
    candidate_name: str = ""
