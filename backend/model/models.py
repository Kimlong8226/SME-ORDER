from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Date, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# NOTE: 审计日志操作类型常量
AUDIT_ACTION_ORDER_CREATE = "ORDER_CREATE"
AUDIT_ACTION_ORDER_UPDATE = "ORDER_UPDATE"
AUDIT_ACTION_ORDER_DELETE = "ORDER_DELETE"
AUDIT_ACTION_ORDER_STATUS_CHANGE = "ORDER_STATUS_CHANGE"
AUDIT_ACTION_CUSTOMER_UPDATE = "CUSTOMER_UPDATE"
AUDIT_ACTION_CUSTOMER_BLOCK = "CUSTOMER_BLOCK"
AUDIT_ACTION_CUSTOMER_UNBLOCK = "CUSTOMER_UNBLOCK"
AUDIT_ACTION_CUSTOMER_TEMP_ACCESS = "CUSTOMER_TEMP_ACCESS"
AUDIT_ACTION_CUSTOMER_TEMP_ACCESS_END = "CUSTOMER_TEMP_ACCESS_END"
AUDIT_ACTION_PAYMENT_CREATE = "PAYMENT_CREATE"
AUDIT_ACTION_PAYMENT_DELETE = "PAYMENT_DELETE"

class StaffUser(Base):
    """
    内部工作账号（包含超级管理员 Superadmin 和普通员工 Staff）
    """
    __tablename__ = "staff_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="staff")  # superadmin | staff
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Customer(Base):
    """
    企业客户主档
    包含公司注册号、税号、银行资料以及暂停下单开关
    """
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(150), nullable=False, index=True)
    company_reg_no = Column(String(50), nullable=True)  # 公司注册号码
    phone = Column(String(30), nullable=True)
    company_address = Column(Text, nullable=True)  # 公司账单地址
    contact_name = Column(String(100), nullable=True)  # 主负责人
    bank_account_no = Column(String(50), nullable=True)  # 公司银行账号
    bank_name = Column(String(100), nullable=True)  # 银行名称
    email = Column(String(100), nullable=True)
    tax_number = Column(String(50), nullable=True)  # 公司税号
    billing_cycle = Column(String(20), default="30")  # 7, 14, 30, 45, 60 天
    is_blocked = Column(Boolean, default=False)  # 欠款屏蔽/暂停下单开关
    block_source = Column(String(20), nullable=True)  # manual | overdue
    block_reason = Column(Text, nullable=True)
    blocked_at = Column(DateTime(timezone=True), nullable=True)
    temporary_access_started_at = Column(DateTime(timezone=True), nullable=True)
    temporary_access_until = Column(DateTime(timezone=True), nullable=True)
    temporary_access_reason = Column(Text, nullable=True)
    restriction_updated_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关联
    sites = relationship("DeliverySite", back_populates="customer", cascade="all, delete-orphan")
    users = relationship("CustomerUser", back_populates="customer", cascade="all, delete-orphan")
    packages = relationship("CustomerPackage", back_populates="customer", cascade="all, delete-orphan")
    addons = relationship("CustomerAddon", back_populates="customer", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer")
    payments = relationship("PaymentRecord", back_populates="customer", cascade="all, delete-orphan")


class CustomerUser(Base):
    """
    客户端登录账号（专门的订餐员）
    """
    __tablename__ = "customer_users"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    contact_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="users")

class DeliverySite(Base):
    """
    配送分点/分工厂 (一个客户可有多个地点，如 GSP 旗下 tmn tek, sinergy)
    """
    __tablename__ = "delivery_sites"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    site_name = Column(String(100), nullable=False)  # 工厂/分点名称
    address = Column(Text, nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)

    customer = relationship("Customer", back_populates="sites")
    orders = relationship("Order", back_populates="site")

class PackageTemplate(Base):
    """
    基础套餐模板（后台统一创建维护，如：日式饭盒、Buffet、2菜1肉1水果）
    """
    __tablename__ = "package_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), default="饭盒")  # 饭盒 / Buffet / 大型供餐
    description = Column(Text, nullable=True)
    default_price = Column(Float, default=0.0)

class AddonTemplate(Base):
    """
    附加项模板（如：加饭、加汤、加蛋）
    """
    __tablename__ = "addon_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    default_price = Column(Float, default=0.0)
    description = Column(Text, nullable=True)  # 可选描述，如：熟鸡蛋 1 粒


class CustomerPackage(Base):
    """
    指派给客户的套餐与协议价
    """
    __tablename__ = "customer_packages"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    package_template_id = Column(Integer, ForeignKey("package_templates.id"), nullable=False)
    agreement_price = Column(Float, nullable=False)  # 针对该客户的协议单价（订餐员隐藏）
    is_active = Column(Boolean, default=True)  # 软删除标记，False = 已删除
    # NOTE: 控制该套餐是否在顾客下单页面中显示（勾选=显示，取消勾选=隐藏）
    is_shown_to_customer = Column(Boolean, default=True)

    customer = relationship("Customer", back_populates="packages")
    template = relationship("PackageTemplate")

class CustomerAddon(Base):
    """
    指派给客户的附加选项与协议价
    """
    __tablename__ = "customer_addons"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    addon_template_id = Column(Integer, ForeignKey("addon_templates.id"), nullable=False)
    agreement_price = Column(Float, nullable=False)

    customer = relationship("Customer", back_populates="addons")
    template = relationship("AddonTemplate")

class CustomerMealSection(Base):
    """
    客户开通的下单餐次关联表
    """
    __tablename__ = "customer_meal_sections"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    meal_section_id = Column(Integer, ForeignKey("meal_sections.id"), nullable=False)

    customer = relationship("Customer")
    meal_section = relationship("MealSection")

class MealSection(Base):
    """
    餐次定义（早班早餐、夜班早餐、午餐、晚餐、宵夜、3am餐食等）
    """
    __tablename__ = "meal_sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)  # 如: 早班早餐, 午餐, 宵夜
    sort_order = Column(Integer, default=0)
    allowed_categories = Column(String(200), default="")  # 以逗号分隔的分类名称，如 "饭盒,大型供餐"


class Order(Base):
    """
    订单主表
    """
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    delivery_site_id = Column(Integer, ForeignKey("delivery_sites.id"), nullable=False)
    delivery_date = Column(Date, nullable=False, index=True)
    status = Column(String(30), default="submitted")  # submitted | confirmed | in_production | delivered | billed | cancelled
    remark = Column(Text, nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    version = Column(Integer, nullable=False, default=1)
    is_late_override = Column(Boolean, nullable=False, default=False)

    customer = relationship("Customer", back_populates="orders")
    site = relationship("DeliverySite", back_populates="orders")
    details = relationship("OrderDetail", back_populates="order", cascade="all, delete-orphan")

class OrderDetail(Base):
    """
    订单明细（某个餐次下的某个套餐/附加项及订餐数量）
    """
    __tablename__ = "order_details"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    meal_section_id = Column(Integer, ForeignKey("meal_sections.id"), nullable=False)
    customer_package_id = Column(Integer, ForeignKey("customer_packages.id"), nullable=True)
    customer_addon_id = Column(Integer, ForeignKey("customer_addons.id"), nullable=True)
    quantity = Column(Integer, nullable=False, default=0)
    final_unit_price = Column(Float, nullable=False, default=0.0)  # 下单时的单价归档
    remark = Column(String(100), nullable=True)  # 比如: "加饭5份"

    order = relationship("Order", back_populates="details")
    meal_section = relationship("MealSection")
    customer_package = relationship("CustomerPackage")
    customer_addon = relationship("CustomerAddon")

class Invoice(Base):
    """
    对账账单
    """
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_amount = Column(Float, nullable=False, default=0.0)
    payment_status = Column(String(20), default="unpaid")  # unpaid | paid | overdue
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """
    系统审计日志
    记录所有关键业务操作：订单创建/修改/删除/状态变更、客户信息修改等
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # 操作类型：ORDER_CREATE / ORDER_UPDATE / ORDER_DELETE / ORDER_STATUS_CHANGE / CUSTOMER_UPDATE
    action_type = Column(String(50), nullable=False, index=True)

    # 目标对象（订单 ID 或客户 ID 等）
    target_id = Column(Integer, nullable=True, index=True)

    # 人类可读的目标标签，如 "KM-26/07/26/002" 或客户公司名称
    target_label = Column(String(200), nullable=True)

    # 操作描述（供前端直接展示）
    description = Column(Text, nullable=False)

    # 操作人信息
    operator_name = Column(String(100), nullable=False)
    operator_role = Column(String(20), nullable=False)  # superadmin | staff | customer

    # 可选：序列化 JSON 字符串存储变更快照（如旧状态 -> 新状态）
    extra_data = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class PaymentRecord(Base):
    """
    客户还款/打款记录
    用于核销客户的 DO 应付金额，计算实际未结清欠款 (Outstanding Balance)
    """
    __tablename__ = "payment_records"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    payment_date = Column(Date, nullable=False, index=True)
    amount = Column(Float, nullable=False, default=0.0)
    payment_method = Column(String(50), default="Bank Transfer")  # Bank Transfer | Cheque | Cash | Other
    reference_no = Column(String(100), nullable=True)  # 汇款参考号/支票号
    allocated_dos_text = Column(Text, nullable=True)  # 存储关联核销的 DO 编号字符串，例如 "DO-20260726-0001, DO-20260726-0002"
    remark = Column(Text, nullable=True)  # 备注说明
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="payments")


class OrderEditSession(Base):
    """一次性的顾客下单/修改资格，用于证明顾客在下午 6 点前已开始操作。"""
    __tablename__ = "order_edit_sessions"

    id = Column(String(36), primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    delivery_date = Column(Date, nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

