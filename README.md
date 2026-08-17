# 🚀 AI Job Application Studio

An intelligent, full-stack web application that leverages Generative AI (**Groq - Llama 3.3 70B**) to extract resume details from PDFs, analyze job descriptions, and auto-generate tailored, highly professional job application emails. It connects directly to **PostgreSQL**, supports **Google OAuth ("Continue with Google")**, and dispatches cover emails directly to HR via SMTP along with confirmation copies to the applicant's main email.

---

## 🌟 Key Features

- **🐘 PostgreSQL Powered Database**
  - Robust relational database for user profiles, sessions, and application logs.
  - Automatic table initialization and connection handling with `psycopg2`.
  - Configurable via `DATABASE_URL` or standard `POSTGRES_*` environment variables.

- **🌐 Google OAuth ("Continue with Google")**
  - One-click Google Sign-In and registration using `@react-oauth/google` and Google ID tokens.
  - Automatic profile linking, avatar display, and welcome onboarding email.
  - Secure fallback to local email/password authentication.

- **✉️ Direct SMTP Dispatch to HR & Main User Mailbox**
  - Integrated Gmail SMTP engine (`smtplib` over SSL on port 465).
  - Automatically sends the application email and attached PDF resume to the HR/Recruiter.
  - Sends a full confirmation copy with the attached resume to the **main user's email** for record keeping.

- **📄 Resume Extraction & Text Parsing**
  - Instant PDF upload and text extraction using `pdfplumber`.
  - Parses skills, experience, candidate contact info, and structural highlights.

- **🤖 AI-Powered Cover Email Generation**
  - Integrates **Groq AI API** using the `llama-3.3-70b-versatile` model.
  - Enforces structured JSON output mode for clean, reliable response formatting.
  - Customizes subject line and email body to match candidate resume qualifications directly against the Job Description and Role.

- **✨ Modern Glassmorphism UI**
  - Designed with **React 19**, **Vite**, and **Tailwind CSS v4**.
  - Interactive toast notifications via **Sonner** and icons from **Lucide React**.
  - Responsive, step-by-step application drafting workflow with quick copy actions.

---

## 🛠️ Tech Stack

### **Backend**
| Technology | Purpose |
| :--- | :--- |
| **FastAPI** | High-performance Python web framework for REST APIs |
| **PostgreSQL** | Relational database for user profiles, OAuth, and sessions |
| **psycopg2-binary** | PostgreSQL database driver and connection pool |
| **google-auth / requests** | Google OAuth token verification |
| **Groq SDK** | AI inference backend using `llama-3.3-70b-versatile` |
| **pdfplumber** | Accurate PDF text extraction |
| **smtplib / EmailMessage** | Native email composition and SSL SMTP transport |
| **Pydantic** | Request validation & serialization |

### **Frontend**
| Technology | Purpose |
| :--- | :--- |
| **React 19** | Component-driven UI library |
| **Vite 8** | Fast frontend build tool & HMR server |
| **@react-oauth/google** | Google OAuth authentication components |
| **Tailwind CSS v4** | Modern utility-first CSS styling |
| **Axios** | HTTP client with automatic Bearer token interceptor |
| **Lucide React** | Modern SVG icons |
| **Sonner** | Toast notifications |

---

## 💾 Database Schema (PostgreSQL)

### `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique User ID |
| `name` | `VARCHAR(255)` | `NOT NULL` | Full Name of Candidate |
| `email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | Candidate Email Address |
| `password_hash` | `VARCHAR(255)` | `NULLABLE` | PBKDF2 Hashed Password (local auth) |
| `auth_provider` | `VARCHAR(50)` | `DEFAULT 'local'` | `'local'` or `'google'` |
| `google_id` | `VARCHAR(255)` | `UNIQUE NULLABLE` | Google OAuth Unique Subject ID |
| `avatar_url` | `TEXT` | `NULLABLE` | Google Profile Picture URL |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | User creation timestamp |

### `sessions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `token` | `VARCHAR(255)` | `PRIMARY KEY` | Secure 32-byte URL-safe Bearer Token |
| `user_id` | `INTEGER` | `REFERENCES users(id) ON DELETE CASCADE` | User reference |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Session Expiration Timestamp (7 Days) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Session created timestamp |

### `applications_log`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique log entry ID |
| `user_id` | `INTEGER` | `REFERENCES users(id) ON DELETE CASCADE` | User ID |
| `job_position` | `VARCHAR(255)` | - | Target job title |
| `hr_email` | `VARCHAR(255)` | - | Recipient HR email |
| `subject` | `TEXT` | - | Email subject |
| `body` | `TEXT` | - | Application body |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Dispatch timestamp |

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/` | ❌ No | Backend health check status |
| `POST` | `/register` | ❌ No | Registers user, returns session token & sends welcome email |
| `POST` | `/login` | ❌ No | Authenticates local user credentials & returns session token |
| `POST` | `/auth/google` | ❌ No | Verifies Google OAuth token, creates/logs in user & returns session token |
| `GET` | `/me` | ✅ Yes | Returns current authenticated user profile |
| `POST` | `/logout` | ✅ Yes | Invalidates user session token |
| `POST` | `/upload-resume` | ✅ Yes | Uploads PDF resume & extracts raw text |
| `POST` | `/generate-application` | ✅ Yes | Invokes Groq AI to draft tailored email body and subject |
| `POST` | `/send-email` | ✅ Yes | Sends application to HR and delivers confirmation copy to main user email |

---

## 🚀 Getting Started

### **Prerequisites**
- **Python 3.10+**
- **PostgreSQL 13+** (Running locally or via cloud e.g., Supabase, Neon, AWS RDS)
- **Node.js 18+** & `npm`
- **Groq API Key** (Get free key at [console.groq.com](https://console.groq.com))
- **Gmail App Password** (Generated via Google Account -> Security -> 2-Step Verification -> App Passwords)
- **Google OAuth Client ID** (Optional/Recommended from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))

---

### **1. Backend Setup**

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure `.env` in `backend/`:
   ```env
   GROQ_API_KEY=your_groq_api_key
   EMAIL=your_gmail_address@gmail.com
   APP_PASSWORD=your_gmail_app_password
   HR_EMAIL=

   # PostgreSQL Configuration
   DATABASE_URL=postgresql://postgres:your_postgres_password@localhost:5432/ai_job_db
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_postgres_password
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=ai_job_db

   # Google OAuth (Optional/Recommended)
   GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
   ```

4. Start the FastAPI backend server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

### **2. Frontend Setup**

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Configure `.env` in `frontend/`:
   ```env
   VITE_APP_BASE_URL=http://127.0.0.1:8000/
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.
