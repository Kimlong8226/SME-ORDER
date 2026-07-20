import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load env
load_dotenv()

# Add search path for packages
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "model"))

from database import Base
from model.models import (
    StaffUser, Customer, CustomerUser, DeliverySite, 
    PackageTemplate, AddonTemplate, CustomerPackage, 
    CustomerAddon, MealSection, Order, OrderDetail, Invoice
)

def run_migration():
    sqlite_url = "sqlite:///./central_kitchen.db"
    supabase_url = os.getenv("DATABASE_URL")
    
    if not supabase_url:
        print("ERROR: DATABASE_URL not found in env!")
        return

    print("--- Initializing database engines ---")
    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    supabase_engine = create_engine(supabase_url)

    # 1. Create tables
    print("--- Creating table structures in Supabase ---")
    Base.metadata.create_all(bind=supabase_engine)
    print("Table schema created successfully!")

    # 2. Open Sessions
    SqliteSession = sessionmaker(bind=sqlite_engine)
    SupabaseSession = sessionmaker(bind=supabase_engine)
    
    db_lite = SqliteSession()
    db_supabase = SupabaseSession()

    try:
        tables_to_migrate = [
            (StaffUser, "staff_users"),
            (Customer, "customers"),
            (CustomerUser, "customer_users"),
            (DeliverySite, "delivery_sites"),
            (PackageTemplate, "package_templates"),
            (AddonTemplate, "addon_templates"),
            (CustomerPackage, "customer_packages"),
            (CustomerAddon, "customer_addons"),
            (MealSection, "meal_sections"),
            (Invoice, "invoices"),
            (Order, "orders"),
            (OrderDetail, "order_details")
        ]

        # NOTE: 先清空所有表（按反向依赖顺序），避免重复迁移时 UniqueViolation
        print("--- Clearing existing Supabase data before migration ---")
        clear_order = [
            "order_details", "orders", "invoices", "meal_sections",
            "customer_addons", "customer_packages", "addon_templates",
            "package_templates", "delivery_sites", "customer_users",
            "customers", "staff_users"
        ]
        from sqlalchemy import text
        with supabase_engine.connect() as conn:
            for tbl in clear_order:
                try:
                    conn.execute(text(f"TRUNCATE TABLE {tbl} CASCADE"))
                    print(f"  Cleared: {tbl}")
                except Exception:
                    pass  # 表不存在时跳过
            conn.commit()
        print("Existing data cleared!")

        for model_class, table_name in tables_to_migrate:
            print(f"Migrating table {table_name}...")
            
            # Fetch SQLite records
            items = db_lite.query(model_class).all()
            if not items:
                print(f"Table {table_name} is empty, skipping.")
                continue
            
            # Bulk insert
            db_supabase.rollback()
            for item in items:
                db_lite.expunge(item)
                from sqlalchemy.orm import make_transient
                make_transient(item)
                db_supabase.add(item)
            
            db_supabase.commit()
            print(f"Successfully migrated {len(items)} records to {table_name}.")

            # Update serial sequences for PostgreSQL auto-increment IDs
            if supabase_url.startswith("postgresql"):
                try:
                    with supabase_engine.connect() as conn:
                        conn.execute(text(
                            f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1)) FROM {table_name};"
                        ))
                        conn.commit()
                except Exception:
                    pass  # 没有 serial sequence 的表跳过

        print("SUCCESS: Data migration completed successfully!")

    except Exception as e:
        db_supabase.rollback()
        print(f"ERROR: Exception occurred during migration: {e}")
        raise e
    finally:
        db_lite.close()
        db_supabase.close()

if __name__ == "__main__":
    run_migration()
