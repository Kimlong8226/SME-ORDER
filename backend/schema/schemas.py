from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import date, datetime

# --- Token & Login Schemas ---
class TokenSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_type: str  # staff | customer
    role: str       # superadmin | staff | customer
    username: str
    name: str
    customer_id: Optional[int] = None
    is_blocked: Optional[bool] = False

class LoginRequest(BaseModel):
    username: str
    password: str

# --- Staff User Schemas ---
class StaffUserBase(BaseModel):
    username: str
    full_name: str
    role: str = "staff"  # superadmin | staff
    is_active: bool = True

class StaffUserCreate(StaffUserBase):
    password: str

class StaffUserResponse(StaffUserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Delivery Site Schemas ---
class DeliverySiteBase(BaseModel):
    site_name: str
    address: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None

class DeliverySiteCreate(DeliverySiteBase):
    pass

class DeliverySiteResponse(DeliverySiteBase):
    id: int
    customer_id: int

    class Config:
        from_attributes = True

# --- Customer Schemas ---
class CustomerBase(BaseModel):
    company_name: str
    company_reg_no: Optional[str] = None
    phone: Optional[str] = None
    company_address: Optional[str] = None
    contact_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_name: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None
    billing_cycle: str = "30"
    is_blocked: bool = False

class CustomerCreate(CustomerBase):
    username: str  # 初始订餐员账号
    password: str  # 初始订餐员密码
    sites: List[DeliverySiteCreate] = []

class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime
    sites: List[DeliverySiteResponse] = []

    class Config:
        from_attributes = True

# --- Package & Addon Schemas ---
class PackageTemplateBase(BaseModel):
    name: str
    category: str = "饭盒"
    description: Optional[str] = None
    default_price: float = 0.0

class PackageTemplateCreate(PackageTemplateBase):
    pass

class PackageTemplateResponse(PackageTemplateBase):
    id: int

    class Config:
        from_attributes = True

class AddonTemplateBase(BaseModel):
    name: str
    default_price: float = 0.0
    description: Optional[str] = None  # 可选描述，例如：散装白饭、煮熟鸡蛋

class AddonTemplateCreate(AddonTemplateBase):
    pass

class AddonTemplateResponse(AddonTemplateBase):
    id: int

    class Config:
        from_attributes = True

class CustomerPackageAssign(BaseModel):
    package_template_id: int
    agreement_price: float

class CustomerPackageResponse(BaseModel):
    id: int
    customer_id: int
    package_template_id: int
    agreement_price: float
    template_name: str
    category: str
    is_shown_to_customer: bool = True  # 是否在顾客下单页面显示

    class Config:
        from_attributes = True

class CustomerAddonAssign(BaseModel):
    addon_template_id: int
    agreement_price: float

class CustomerAddonResponse(BaseModel):
    id: int
    customer_id: int
    addon_template_id: int
    agreement_price: float
    addon_name: str

    class Config:
        from_attributes = True

# --- Order Schemas ---
class OrderDetailCreate(BaseModel):
    meal_section_id: int
    customer_package_id: Optional[int] = None
    customer_addon_id: Optional[int] = None
    quantity: int
    remark: Optional[str] = None

class OrderCreateSingle(BaseModel):
    delivery_site_id: int
    delivery_date: date
    remark: Optional[str] = None
    details: List[OrderDetailCreate]

class MatrixItem(BaseModel):
    delivery_site_id: int
    meal_section_id: int
    customer_package_id: Optional[int] = None
    quantity: int
    remark: Optional[str] = None

class OrderCreateMatrix(BaseModel):
    delivery_date: date
    items: List[MatrixItem]

class OrderDetailResponse(BaseModel):
    id: int
    meal_section_name: str
    package_name: Optional[str] = None
    addon_name: Optional[str] = None
    quantity: int
    unit_price: Optional[float] = None  # 仅管理员可见
    remark: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    customer_id: int
    company_name: str
    delivery_site_id: int
    site_name: str
    delivery_date: date
    status: str
    remark: Optional[str] = None
    total_amount: Optional[float] = None  # 仅管理员可见
    details: List[OrderDetailResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True

# --- Calendar Summary Schema ---
class CalendarDaySummary(BaseModel):
    date_str: str
    total_orders_count: int
    total_portions_count: int
    customer_summaries: List[dict]


# --- Meal Section Schemas ---
class MealSectionBase(BaseModel):
    name: str
    sort_order: int = 0
    allowed_categories: str = ""  # 逗号分隔的套餐分类字符串

class MealSectionCreate(MealSectionBase):
    pass

class MealSectionResponse(MealSectionBase):
    id: int

    class Config:
        from_attributes = True


class CustomerMealSectionsUpdate(BaseModel):
    meal_section_ids: List[int]


