"""
审计日志写入工具函数
集中管理日志写入逻辑，避免在各 API 中重复代码
"""
import json
from datetime import datetime
from sqlalchemy.orm import Session

from model.models import AuditLog


def write_audit_log(
    db: Session,
    action_type: str,
    description: str,
    operator_name: str,
    operator_role: str,
    target_id: int | None = None,
    target_label: str | None = None,
    extra_data: dict | None = None,
) -> None:
    """
    写入一条审计日志记录
    
    :param db: 数据库 session
    :param action_type: 操作类型常量，如 ORDER_CREATE / ORDER_UPDATE 等
    :param description: 人类可读的操作描述
    :param operator_name: 操作人姓名
    :param operator_role: 操作人角色 (superadmin / staff / customer)
    :param target_id: 目标对象 ID（订单 ID 或客户 ID 等）
    :param target_label: 目标对象的可读标签（如订单编号字符串）
    :param extra_data: 附加信息字典，将被序列化为 JSON 存储
    """
    log = AuditLog(
        action_type=action_type,
        target_id=target_id,
        target_label=target_label,
        description=description,
        operator_name=operator_name,
        operator_role=operator_role,
        extra_data=json.dumps(extra_data, ensure_ascii=False) if extra_data else None,
        created_at=datetime.utcnow(),
    )
    db.add(log)
    # NOTE: 不在此处 commit，由调用方统一 commit，保证原子性
