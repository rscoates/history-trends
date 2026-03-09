from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .routers.auth import verify_token

security = HTTPBearer()


async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not verify_token(credentials.credentials):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return True
