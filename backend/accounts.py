import re
import time

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from auth import create_token, current_user, verify_google_token
from db import Analysis, User, get_db
from sqlalchemy import delete, or_, select
from auth import create_token, verify_google_token
from db import User, get_db

router = APIRouter(prefix="/auth", tags=["auth"])

# Must start with a letter, so a username can never look like a phone number
USERNAME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{2,19}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

MAX_FAILS = 5
LOCK_SECONDS = 300
failed_attempts: dict[str, list[float]] = {}
DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt())


class RegisterIn(BaseModel):
    name: str
    username: str
    email: str
    phone: str | None = None
    password: str


class LoginIn(BaseModel):
    identifier: str
    password: str


class GoogleIn(BaseModel):
    credential: str


def normalize_phone(p: str) -> str | None:
    p = re.sub(r"[\s\-()]", "", p)
    return p if re.fullmatch(r"\+?\d{10,15}", p) else None


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def check_password(pw: str, hashed: str | None) -> bool:
    # Always run bcrypt, even for unknown users, so timing doesn't reveal who exists
    target = hashed.encode() if hashed else DUMMY_HASH
    try:
        ok = bcrypt.checkpw(pw.encode(), target)
    except ValueError:
        return False
    return ok and hashed is not None


def public(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "picture": user.picture,
    }


def session_for(user: User) -> dict:
    data = public(user)
    return {"token": create_token(data), "user": data}


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    name = body.name.strip()
    username = body.username.strip().lower()
    email = body.email.strip().lower()
    raw_phone = (body.phone or "").strip()
    phone = normalize_phone(raw_phone) if raw_phone else None
    pw = body.password

    if len(name) < 2:
        raise HTTPException(400, "Please enter your full name.")
    if not USERNAME_RE.match(username):
        raise HTTPException(400, "Username: 3-20 characters, start with a letter, use letters, numbers or underscore.")
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Please enter a valid email address.")
    if raw_phone and phone is None:
        raise HTTPException(400, "Enter a valid phone number (10-15 digits).")
    if len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        raise HTTPException(400, "Password must be at least 8 characters with letters and numbers.")
    if len(pw.encode()) > 72:
        raise HTTPException(400, "Password is too long (maximum 72 bytes).")

    conditions = [User.username == username, User.email == email]
    if phone:
        conditions.append(User.phone == phone)
    if db.scalar(select(User).where(or_(*conditions))):
        raise HTTPException(409, "An account with this username, email or phone already exists.")

    user = User(
        name=name, username=username, email=email, phone=phone,
        password_hash=hash_password(pw), provider="local",
    )
    try:
        db.add(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this username, email or phone already exists.")
    db.refresh(user)
    return session_for(user)


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    ident = body.identifier.strip().lower()
    now = time.time()

    # Basic brute-force protection: 5 wrong tries, then a 5 minute lock
    recent = [t for t in failed_attempts.get(ident, []) if now - t < LOCK_SECONDS]
    failed_attempts[ident] = recent
    if len(recent) >= MAX_FAILS:
        raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")

    phone = normalize_phone(ident)
    conditions = [User.username == ident, User.email == ident]
    if phone:
        conditions.append(User.phone == phone)
    user = db.scalar(select(User).where(or_(*conditions)))

    if not check_password(body.password, user.password_hash if user else None):
        failed_attempts.setdefault(ident, []).append(now)
        # Same message for "no such user" and "wrong password"
        raise HTTPException(401, "Invalid username, email, phone or password.")

    failed_attempts.pop(ident, None)
    return session_for(user)


@router.post("/google")
def google_login(body: GoogleIn, db: Session = Depends(get_db)):
    info = verify_google_token(body.credential)
    user = db.scalar(select(User).where(User.email == info["email"]))

    if user is None:
        user = User(
            name=info["name"], email=info["email"],
            picture=info.get("picture"), provider="google",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif user.password_hash:
        # An unverified password account already uses this email: don't merge them
        raise HTTPException(409, "This email is already registered with a password. Please sign in with your password.")

    return session_for(user)
# ---------- Account / settings ----------

class ProfileIn(BaseModel):
    name: str


class PasswordIn(BaseModel):
    current_password: str
    new_password: str


class DeleteIn(BaseModel):
    password: str | None = None


def password_problem(pw: str) -> str | None:
    if len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        return "Password must be at least 8 characters with letters and numbers."
    if len(pw.encode()) > 72:
        return "Password is too long (maximum 72 bytes)."
    return None


def get_current(claims: dict, db: Session) -> User:
    user_id = claims.get("id")
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(401, "Please sign in again.")
    return user


@router.get("/me")
def get_me(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    user = get_current(claims, db)
    return {
        **public(user),
        "provider": user.provider,
        "has_password": bool(user.password_hash),
        "created_at": user.created_at.replace(tzinfo=None).isoformat() + "Z",
    }


@router.patch("/profile")
def update_profile(body: ProfileIn, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    user = get_current(claims, db)
    name = body.name.strip()
    if len(name) < 2 or len(name) > 100:
        raise HTTPException(400, "Please enter a valid name (2-100 characters).")
    user.name = name
    db.commit()
    db.refresh(user)
    return session_for(user)


@router.post("/change-password")
def change_password(body: PasswordIn, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    user = get_current(claims, db)
    if not user.password_hash:
        raise HTTPException(400, "This account signs in with Google, so it has no password to change.")

    key = f"pw:{user.id}"
    now = time.time()
    recent = [t for t in failed_attempts.get(key, []) if now - t < LOCK_SECONDS]
    failed_attempts[key] = recent
    if len(recent) >= MAX_FAILS:
        raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")

    if not check_password(body.current_password, user.password_hash):
        failed_attempts.setdefault(key, []).append(now)
        raise HTTPException(401, "Current password is incorrect.")
    failed_attempts.pop(key, None)

    problem = password_problem(body.new_password)
    if problem:
        raise HTTPException(400, problem)
    if body.new_password == body.current_password:
        raise HTTPException(400, "The new password must be different from the current one.")

    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.delete("/account")
def delete_account(body: DeleteIn, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    user = get_current(claims, db)
    if user.password_hash:
        if not body.password or not check_password(body.password, user.password_hash):
            raise HTTPException(401, "Password is incorrect.")
    db.execute(delete(Analysis).where(Analysis.user_id == user.id))
    db.delete(user)
    db.commit()
    return {"ok": True}