import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(override=True)

SESSION_TTL_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", "7"))
PBKDF2_ITERATIONS = 120000
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ai_job_application_default_jwt_secret_key_2026_xyz987654321")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")



def get_db_config() -> dict:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        # Handle postgresql:// or postgres://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        parsed = urlparse(database_url)
        return {
            "dbname": parsed.path.lstrip("/") or "ai_job_db",
            "user": parsed.username or os.getenv("POSTGRES_USER", "postgres"),
            "password": parsed.password or os.getenv("POSTGRES_PASSWORD", "postgres"),
            "host": parsed.hostname or os.getenv("POSTGRES_HOST", "localhost"),
            "port": parsed.port or int(os.getenv("POSTGRES_PORT", "5432")),
        }

    return {
        "dbname": os.getenv("POSTGRES_DB", "ai_job_db"),
        "user": os.getenv("POSTGRES_USER", "postgres"),
        "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
    }


def ensure_database_exists() -> None:
    """Attempts to create the target database if it does not already exist."""
    config = get_db_config()
    target_db = config["dbname"]

    # Try connecting directly first
    try:
        conn = psycopg2.connect(**config)
        conn.close()
        return
    except psycopg2.OperationalError:
        pass

    # Try connecting to default 'postgres' database to create target_db
    try:
        admin_config = config.copy()
        admin_config["dbname"] = "postgres"
        conn = psycopg2.connect(**admin_config)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (target_db,),
            )
            if not cur.fetchone():
                cur.execute(
                    sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target_db))
                )
                print(f"Created PostgreSQL database '{target_db}' successfully.")
        conn.close()
    except Exception as exc:
        print(f"Database auto-creation check note: {exc}")


def get_connection():
    config = get_db_config()
    return psycopg2.connect(**config, cursor_factory=RealDictCursor)


def init_db() -> None:
    try:
        ensure_database_exists()
    except Exception as exc:
        print(f"Warning during ensure_database_exists: {exc}")

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Users table with support for local & OAuth (Google) authentication
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(255),
                    auth_provider VARCHAR(50) DEFAULT 'local',
                    google_id VARCHAR(255) UNIQUE,
                    avatar_url TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # Sessions table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    token VARCHAR(255) PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # Job applications activity log
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS applications_log (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
                    job_position VARCHAR(255),
                    hr_email VARCHAR(255),
                    subject TEXT,
                    body TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # Performance indexes
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);"
            )
        conn.commit()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    try:
        salt_hex, expected_digest = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False

    computed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    ).hex()
    return hmac.compare_digest(computed, expected_digest)


def serialize_user(row: dict) -> dict:
    created_at = row.get("created_at")
    if isinstance(created_at, datetime):
        created_at_str = created_at.isoformat()
    else:
        created_at_str = str(created_at) if created_at else ""

    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "auth_provider": row.get("auth_provider", "local"),
        "avatar_url": row.get("avatar_url"),
        "created_at": created_at_str,
    }


def get_user_by_email(email: str) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM users WHERE email = %s",
                (normalize_email(email),),
            )
            return cur.fetchone()


def get_user_by_id(user_id: int) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()


def get_user_by_google_id(google_id: str) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM users WHERE google_id = %s",
                (google_id,),
            )
            return cur.fetchone()


def create_user(name: str, email: str, password: str) -> dict:
    normalized_email = normalize_email(email)
    password_hash = hash_password(password)
    now = datetime.now(timezone.utc)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (name, email, password_hash, auth_provider, created_at)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (name.strip(), normalized_email, password_hash, "local", now),
            )
            user = cur.fetchone()
        conn.commit()

    if user is None:
        raise RuntimeError("Failed to load newly created user")
    return user


def get_or_create_google_user(
    google_id: str,
    email: str,
    name: str,
    avatar_url: str | None = None,
) -> tuple[dict, bool]:
    """
    Returns (user_dict, is_newly_created).
    If user exists by google_id or email, updates profile and links google_id.
    Otherwise creates a new user with auth_provider='google'.
    """
    normalized_email = normalize_email(email)
    display_name = name.strip() if name else normalized_email.split("@")[0]

    with get_connection() as conn:
        with conn.cursor() as cur:
            # 1. Check by google_id
            cur.execute("SELECT * FROM users WHERE google_id = %s", (google_id,))
            user = cur.fetchone()
            if user:
                # Update avatar or name if newly available
                cur.execute(
                    """
                    UPDATE users 
                    SET name = COALESCE(%s, name), avatar_url = COALESCE(%s, avatar_url)
                    WHERE id = %s
                    RETURNING *;
                    """,
                    (display_name, avatar_url, user["id"]),
                )
                updated_user = cur.fetchone()
                conn.commit()
                return updated_user, False

            # 2. Check by email
            cur.execute("SELECT * FROM users WHERE email = %s", (normalized_email,))
            user = cur.fetchone()
            if user:
                # Link google_id
                cur.execute(
                    """
                    UPDATE users 
                    SET google_id = %s, avatar_url = COALESCE(%s, avatar_url)
                    WHERE id = %s
                    RETURNING *;
                    """,
                    (google_id, avatar_url, user["id"]),
                )
                updated_user = cur.fetchone()
                conn.commit()
                return updated_user, False

            # 3. Create new user
            now = datetime.now(timezone.utc)
            cur.execute(
                """
                INSERT INTO users (name, email, google_id, auth_provider, avatar_url, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (display_name, normalized_email, google_id, "google", avatar_url, now),
            )
            new_user = cur.fetchone()
        conn.commit()

    return new_user, True


def authenticate_user(email: str, password: str) -> dict | None:
    user = get_user_by_email(email)
    if user is None:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    return user


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_jwt_token(user: dict, expires_delta: timedelta | None = None) -> str:
    """Creates an RFC 7519 standard HS256 JWT containing user identity and expiration claims."""
    now = datetime.now(timezone.utc)
    delta = expires_delta or timedelta(days=SESSION_TTL_DAYS)
    expires_at = now + delta

    header = {
        "alg": "HS256",
        "typ": "JWT"
    }
    payload = {
        "sub": str(user["id"]),
        "user_id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "auth_provider": user.get("auth_provider", "local"),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(
        JWT_SECRET_KEY.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    signature_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_jwt_token(token: str) -> dict | None:
    """Decodes and validates an HS256 JWT. Returns payload if valid, None if invalid or expired."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(
            JWT_SECRET_KEY.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()

        actual_sig = _b64url_decode(signature_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        now_ts = int(datetime.now(timezone.utc).timestamp())
        if "exp" in payload and payload["exp"] < now_ts:
            return None

        return payload
    except Exception as exc:
        print(f"JWT decode error: {exc}")
        return None


def get_user_by_jwt(token: str) -> dict | None:
    """Validates JWT and retrieves user from database."""
    payload = decode_jwt_token(token)
    if not payload:
        return None

    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        return None

    try:
        return get_user_by_id(int(user_id))
    except (ValueError, TypeError):
        return None


def create_session(user_id: int) -> str:
    """Creates a JWT token and optionally registers session for fallback."""
    user = get_user_by_id(user_id)
    if user:
        token = create_jwt_token(user)
    else:
        token = secrets.token_urlsafe(32)

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(days=SESSION_TTL_DAYS)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO sessions (token, user_id, expires_at, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at;
                    """,
                    (token, user_id, expires_at, created_at),
                )
            conn.commit()
    except Exception as exc:
        print(f"Session fallback logging note: {exc}")

    return token


def delete_session(token: str) -> None:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE token = %s", (token,))
            conn.commit()
    except Exception as exc:
        print(f"Session delete note: {exc}")


def get_user_by_token(token: str) -> dict | None:
    """Attempts JWT decoding first; falls back to sessions table lookup."""
    user = get_user_by_jwt(token)
    if user is not None:
        return user

    now = datetime.now(timezone.utc)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE expires_at < %s", (now,))
                cur.execute(
                    """
                    SELECT u.* 
                    FROM sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.token = %s AND s.expires_at >= %s
                    """,
                    (token, now),
                )
                user = cur.fetchone()
            conn.commit()
        return user
    except Exception as exc:
        print(f"Session token lookup fallback note: {exc}")
        return None


def record_application_log(
    user_id: int,
    job_position: str,
    hr_email: str,
    subject: str,
    body: str,
) -> None:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO applications_log (user_id, job_position, hr_email, subject, body)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (user_id, job_position, hr_email, subject, body),
                )
            conn.commit()
    except Exception as exc:
        print(f"Log application warning: {exc}")


def get_user_application_logs(user_id: int, limit: int = 50) -> list[dict]:
    """Fetches past job applications dispatched by the user."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, job_position, hr_email, subject, body, created_at
                FROM applications_log
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()
            results = []
            for row in rows:
                created_at = row.get("created_at")
                results.append({
                    "id": row["id"],
                    "job_position": row["job_position"] or "Untitled Position",
                    "hr_email": row["hr_email"] or "",
                    "subject": row["subject"] or "",
                    "body": row["body"] or "",
                    "created_at": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
                })
            return results


def delete_application_log(user_id: int, log_id: int) -> bool:
    """Deletes a specific application log entry belonging to the user."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM applications_log WHERE id = %s AND user_id = %s RETURNING id;",
                (log_id, user_id),
            )
            deleted = cur.fetchone()
        conn.commit()
        return deleted is not None


def get_user_stats(user_id: int) -> dict:
    """Retrieves user statistics."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS total_sent FROM applications_log WHERE user_id = %s;",
                (user_id,),
            )
            row = cur.fetchone()
            total_sent = row["total_sent"] if row else 0

            cur.execute(
                """
                SELECT created_at FROM applications_log 
                WHERE user_id = %s ORDER BY created_at DESC LIMIT 1;
                """,
                (user_id,),
            )
            last_app = cur.fetchone()
            last_sent_str = ""
            if last_app and last_app.get("created_at"):
                dt = last_app["created_at"]
                last_sent_str = dt.isoformat() if isinstance(dt, datetime) else str(dt)

            return {
                "total_applications_sent": total_sent,
                "last_application_at": last_sent_str,
                "auth_type": "JWT",
            }


def update_user_name(user_id: int, name: str) -> dict | None:
    """Updates user display name."""
    clean_name = name.strip()
    if not clean_name:
        return None

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET name = %s WHERE id = %s RETURNING *;",
                (clean_name, user_id),
            )
            user = cur.fetchone()
        conn.commit()
    return user


def change_user_password(user_id: int, current_password: str, new_password: str) -> tuple[bool, str]:
    """Changes password for local auth users."""
    user = get_user_by_id(user_id)
    if not user:
        return False, "User not found"

    if user.get("auth_provider") != "local" or not user.get("password_hash"):
        return False, "Google OAuth accounts cannot change password here."

    if not verify_password(current_password, user["password_hash"]):
        return False, "Current password is incorrect."

    if len(new_password) < 6:
        return False, "New password must be at least 6 characters."

    new_hash = hash_password(new_password)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s;",
                (new_hash, user_id),
            )
        conn.commit()
    return True, "Password updated successfully."

