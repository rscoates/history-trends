from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from jose import jwt

from ..config import settings
from ..schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

ALGORITHM = "HS256"


def create_access_token() -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"exp": expire, "sub": "user"}, settings.SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub") == "user"
    except Exception:
        return False


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    if req.password != settings.APP_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_access_token()
    return TokenResponse(access_token=token)


@router.get("/verify")
async def verify(token: str):
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"valid": True}
