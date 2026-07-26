import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError

from database import get_db
from model.models import StaffUser, CustomerUser, Customer
from schema.schemas import LoginRequest, TokenSchema

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = "central_kitchen_secret_key_antigravity_2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24小时

security = HTTPBearer(auto_error=False)

def get_current_user_payload(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供身份认证 Token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或过期的 Token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_superadmin(payload: dict = Depends(get_current_user_payload)):
    if payload.get("user_type") != "staff" or payload.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足：只有超级管理员 (superadmin) 才有权访问员工管理后台"
        )
    return payload

def get_password_hash(password: str) -> str:

    """
    使用 SHA256 算法生成稳健密码哈希
    """
    return hashlib.sha256((password + "central_kitchen_salt_2026").encode('utf-8')).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码
    """
    return get_password_hash(plain_password) == hashed_password

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=TokenSchema)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    统一登录接口：支持超级管理员、员工以及客户订餐员登录
    """
    try:
        # 1. 尝试匹配内部员工 (StaffUser)
        staff = db.query(StaffUser).filter(StaffUser.username == req.username).first()
        if staff and verify_password(req.password, staff.password_hash):
            if not staff.is_active:
                raise HTTPException(status_code=400, detail="账号已被禁用")
            token = create_access_token({
                "sub": staff.username,
                "user_type": "staff",
                "role": staff.role,
                "name": staff.full_name
            })
            return TokenSchema(
                access_token=token,
                user_type="staff",
                role=staff.role,
                username=staff.username,
                name=staff.full_name
            )

        # 2. 尝试匹配客户订餐员 (CustomerUser)
        c_user = db.query(CustomerUser).filter(CustomerUser.username == req.username).first()
        if c_user and verify_password(req.password, c_user.password_hash):
            if not c_user.is_active:
                raise HTTPException(status_code=400, detail="账号已被禁用")
            customer = db.query(Customer).filter(Customer.id == c_user.customer_id).first()
            token = create_access_token({
                "sub": c_user.username,
                "user_type": "customer",
                "role": "customer",
                "name": c_user.contact_name,
                "customer_id": c_user.customer_id,
                "is_blocked": customer.is_blocked if customer else False
            })
            return TokenSchema(
                access_token=token,
                user_type="customer",
                role="customer",
                username=c_user.username,
                name=f"{customer.company_name} ({c_user.contact_name})" if customer else c_user.contact_name,
                customer_id=c_user.customer_id,
                is_blocked=customer.is_blocked if customer else False
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        err_msg = f"Login Exception: {str(e)}\n{traceback.format_exc()}"
        print(err_msg)
        raise HTTPException(status_code=500, detail=f"Login Error: {str(e)}")
