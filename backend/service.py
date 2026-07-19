import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class EmailGenerator:
    def __init__(self):
        # Initialize client once in the constructor
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def generate_application_from_resume_text(
        self,
        resume_text: str,
        job_position: str,
        job_description: str = "",
        from_email: str = "",
        to_email: str = "",
        candidate_name: str = "",
    ):
        """Generate a tailored job application email from resume text."""
        prompt = f"""Based on the following resume and job description, generate a professional job application email for the {job_position} position.

Candidate name: {candidate_name or "Use the name inferred from the resume if possible"}
Candidate email: {from_email or "Not provided"}
Recipient HR email: {to_email or "Not provided"}

Job Description:
{job_description or "Not provided"}

Resume Content:
{resume_text}

Generate a plain text email with:
- a professional subject line
- formal greeting like "Dear Hiring Manager,"
- a brief introduction expressing interest in the role
- a summary of key qualifications matched to the job description
- a short paragraph showing why the candidate is a strong fit
- a professional closing requesting an interview or next step
- a sign off that uses the candidate name if available, otherwise the candidate email

Write in first person as the job applicant.
Use proper line breaks and paragraphs for readability.
Do not use any markdown formatting like *, **, #, or bullets in the output body.
Return only a JSON object in this exact format:
{{"subject":"your subject line","email-body":"Your plain text email content"}} """

        try:
            # Fixed model name to a valid Groq endpoint
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="llama-3.3-70b-versatile", 
                response_format={"type": "json_object"}  # Forces Groq to return clean JSON
            )
            
            # Fixed variable name from response -> chat_completion
            email_content = chat_completion.choices[0].message.content
            
            try:
                # Fixed json.load -> json.loads for strings
                email_data = json.loads(email_content)
                return {
                    "subject": email_data.get("subject", ""),
                    "body": email_data.get("email-body", ""),
                    "status": "success"
                }
            except json.JSONDecodeError:
                return {
                    "subject": f"Application for {job_position}",
                    "body": email_content,
                    "status": "partial_success"
                }

        except Exception as e:
            print(f"Error generating email: {e}")
            return {
                "subject": "",
                "body": "",
                "status": f"error: {str(e)}"
            }

    def generate_email_from_resume_text(self, resume_text: str, job_position: str):
        return self.generate_application_from_resume_text(
            resume_text=resume_text,
            job_position=job_position,
        )
