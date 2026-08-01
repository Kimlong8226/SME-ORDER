"""Central, server-authoritative customer ordering and credit rules."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session, selectinload

from api.audit_utils import write_audit_log
from model.models import (
    AUDIT_ACTION_CUSTOMER_BLOCK,
    AUDIT_ACTION_CUSTOMER_UNBLOCK,
    Customer,
    Order,
    OrderDetail,
    PaymentRecord,
)


MALAYSIA_TZ = timezone(timedelta(hours=8), name="Asia/Kuala_Lumpur")
ORDER_CUTOFF_TIME = time(18, 0)
ORDER_GRACE_MINUTES = 10
TEMP_ACCESS_CALENDAR_DAYS = 2
TEMP_ACCESS_DELIVERY_DAYS = 7
MONEY_EPSILON = 0.005


def malaysia_now() -> datetime:
    return datetime.now(MALAYSIA_TZ)


def ensure_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def to_iso_local(value: datetime | None) -> str | None:
    aware = ensure_aware_utc(value)
    return aware.astimezone(MALAYSIA_TZ).isoformat() if aware else None


def parse_billing_cycle(value: str | None) -> int:
    try:
        days = int(str(value or "30").replace("天", "").strip())
        return days if days > 0 else 30
    except (TypeError, ValueError):
        return 30


def order_cutoff_window(delivery_date: date, now: datetime | None = None) -> dict[str, Any]:
    current = (now or malaysia_now()).astimezone(MALAYSIA_TZ)
    cutoff_date = delivery_date - timedelta(days=1)
    cutoff_at = datetime.combine(cutoff_date, ORDER_CUTOFF_TIME, tzinfo=MALAYSIA_TZ)
    grace_deadline = cutoff_at + timedelta(minutes=ORDER_GRACE_MINUTES)

    if current < cutoff_at:
        phase = "open"
    elif current <= grace_deadline:
        phase = "grace"
    else:
        phase = "closed"

    return {
        "server_now": current.isoformat(),
        "timezone": "Asia/Kuala_Lumpur",
        "cutoff_at": cutoff_at.isoformat(),
        "grace_deadline": grace_deadline.isoformat(),
        "phase": phase,
        "can_start_session": phase == "open",
        "is_delivery_day_or_past": delivery_date <= current.date(),
    }


def _order_amount(order: Order) -> float:
    return round(sum(max(0, d.quantity or 0) * max(0.0, d.final_unit_price or 0.0) for d in order.details), 2)


def calculate_customer_financials(
    db: Session,
    customer: Customer,
    today: date | None = None,
) -> dict[str, Any]:
    """Apply confirmed payments FIFO to the oldest non-cancelled DOs."""
    current_date = today or malaysia_now().date()
    cycle_days = parse_billing_cycle(customer.billing_cycle)
    orders = (
        db.query(Order)
        .options(selectinload(Order.details))
        .filter(Order.customer_id == customer.id, Order.status != "cancelled")
        .order_by(Order.delivery_date.asc(), Order.id.asc())
        .all()
    )
    confirmed_payments = sum(
        max(0.0, payment.amount or 0.0)
        for payment in db.query(PaymentRecord).filter(
            PaymentRecord.customer_id == customer.id,
            PaymentRecord.payment_date <= current_date,
        ).all()
    )

    remaining_payment = confirmed_payments
    total_charges = 0.0
    overdue_amount = 0.0
    oldest_overdue_due_date: date | None = None
    order_balances: list[dict[str, Any]] = []

    for order in orders:
        amount = _order_amount(order)
        total_charges += amount
        applied = min(amount, remaining_payment)
        remaining_payment -= applied
        outstanding = max(0.0, amount - applied)
        due_date = order.delivery_date + timedelta(days=cycle_days)
        is_overdue = due_date < current_date and outstanding > MONEY_EPSILON
        if is_overdue:
            overdue_amount += outstanding
            if oldest_overdue_due_date is None or due_date < oldest_overdue_due_date:
                oldest_overdue_due_date = due_date
        order_balances.append({
            "order_id": order.id,
            "amount": round(amount, 2),
            "applied_payment": round(applied, 2),
            "outstanding": round(outstanding, 2),
            "due_date": due_date,
            "is_overdue": is_overdue,
        })

    return {
        "billing_cycle_days": cycle_days,
        "total_charges": round(total_charges, 2),
        "confirmed_payments": round(confirmed_payments, 2),
        "outstanding_balance": round(max(0.0, total_charges - confirmed_payments), 2),
        "credit_balance": round(max(0.0, confirmed_payments - total_charges), 2),
        "overdue_amount": round(overdue_amount, 2),
        "oldest_overdue_due_date": oldest_overdue_due_date,
        "order_balances": order_balances,
    }


def temporary_access_is_active(customer: Customer, now: datetime | None = None) -> bool:
    until = ensure_aware_utc(customer.temporary_access_until)
    return bool(until and until >= (now or datetime.now(timezone.utc)).astimezone(timezone.utc))


def temporary_access_expiry(now: datetime | None = None) -> datetime:
    current = (now or malaysia_now()).astimezone(MALAYSIA_TZ)
    final_date = current.date() + timedelta(days=TEMP_ACCESS_CALENDAR_DAYS - 1)
    return datetime.combine(final_date, time(23, 59, 59, 999999), tzinfo=MALAYSIA_TZ)


def sync_customer_access(
    db: Session,
    customer: Customer,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Synchronize automatic overdue freeze/unfreeze without overriding manual blocks."""
    current_local = (now or malaysia_now()).astimezone(MALAYSIA_TZ)
    current_utc = current_local.astimezone(timezone.utc)
    financial = calculate_customer_financials(db, customer, current_local.date())
    has_overdue = financial["overdue_amount"] > MONEY_EPSILON

    if has_overdue and not customer.is_blocked:
        customer.is_blocked = True
        customer.block_source = "overdue"
        customer.block_reason = f"账龄到期欠款 RM {financial['overdue_amount']:.2f} 未清还"
        customer.blocked_at = current_utc
        customer.restriction_updated_by = "系统"
        write_audit_log(
            db=db,
            action_type=AUDIT_ACTION_CUSTOMER_BLOCK,
            description=f"系统因到期欠款自动冻结客户 {customer.company_name}",
            operator_name="系统",
            operator_role="system",
            target_id=customer.id,
            target_label=customer.company_name,
            extra_data={
                "source": "overdue",
                "reason": customer.block_reason,
                "overdue_amount": financial["overdue_amount"],
                "oldest_overdue_due_date": str(financial["oldest_overdue_due_date"] or ""),
            },
        )
    elif not has_overdue and customer.is_blocked and customer.block_source == "overdue":
        previous_reason = customer.block_reason
        previous_temporary_access_until = customer.temporary_access_until
        customer.is_blocked = False
        customer.block_source = None
        customer.block_reason = None
        customer.temporary_access_started_at = None
        customer.temporary_access_until = None
        customer.temporary_access_reason = None
        customer.restriction_updated_by = "系统"
        write_audit_log(
            db=db,
            action_type=AUDIT_ACTION_CUSTOMER_UNBLOCK,
            description=f"系统因到期欠款已清还自动解除客户 {customer.company_name} 的冻结",
            operator_name="系统",
            operator_role="system",
            target_id=customer.id,
            target_label=customer.company_name,
            extra_data={
                "source": "overdue_cleared",
                "previous_reason": previous_reason,
                "previous_temporary_access_until": to_iso_local(previous_temporary_access_until),
            },
        )

    temp_active = temporary_access_is_active(customer, current_utc)
    effective_is_blocked = bool(customer.is_blocked and not temp_active)
    return {
        **financial,
        "is_blocked": bool(customer.is_blocked),
        "effective_is_blocked": effective_is_blocked,
        "temporary_access_active": temp_active,
        "temporary_access_started_at": to_iso_local(customer.temporary_access_started_at),
        "temporary_access_until": to_iso_local(customer.temporary_access_until),
        "max_order_delivery_date": (
            current_local.date() + timedelta(days=TEMP_ACCESS_DELIVERY_DAYS)
            if temp_active else None
        ),
        "block_source": customer.block_source,
        "block_reason": customer.block_reason,
        "blocked_at": to_iso_local(customer.blocked_at),
    }
