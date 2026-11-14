import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_HOURS = 8
ALLOWED = {
    e.strip().lower()
    for e in os.getenv("ALLOWED_EMAILS", "").split(",")
    if e.strip()
}

if not GOOGLE_CLIENT_ID or not JWT_SECRET:
    raise RuntimeError("Set GOOGLE_CLIENT_ID and JWT_SECRET in backend/.env")

bearer = HTTPBearer(auto_error=False)


def verify_google_token(credential: str) -> dict:
    """Check that the token really came from Google for OUR app."""
    try:
        info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google sign-in.")

    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email is not verified.")

    email = info["email"].lower()
    if ALLOWED and email not in ALLOWED:
        raise HTTPException(status_code=403, detail="This account is not allowed to use the app.")

    return {"email": email, "name": info.get("name", email), "picture": info.get("picture")}


def create_token(user: dict) -> str:
    payload = {
        **user,
        "sub": str(user["id"]),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    """Use as a dependency on any endpoint that needs a signed-in user."""
    if creds is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    try:
        return jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")