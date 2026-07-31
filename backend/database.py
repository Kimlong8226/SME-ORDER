import os
import socket
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# 强制在 Vercel Serverless 环境下优先使用 IPv4，防止 IPv6 直连报 Cannot assign requested address 错误
orig_getaddrinfo = socket.getaddrinfo
def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if family == 0 or family == socket.AF_UNSPEC:
        family = socket.AF_INET
    return orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = patched_getaddrinfo

# 加载环境变量
load_dotenv()

# 数据库文件，默认回退到 SQLite
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./central_kitchen.db")

# 如果是 postgresql 数据库，不需要 check_same_thread 参数
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    # 自动将 Supabase 仅限 IPv6 的直连域名重写为支持 Vercel IPv4 Serverless 的 Pooler 域名
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300
    )
else:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    获取数据库 Session 的依赖函数
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
