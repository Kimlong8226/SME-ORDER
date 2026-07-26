from database import SessionLocal
from model.models import Customer

def update_customer_cycles():
    db = SessionLocal()
    try:
        updated = db.query(Customer).update({"billing_cycle": "14"})
        db.commit()
        print(f"Successfully updated billing_cycle to 14 days for {updated} customers.")
    except Exception as e:
        db.rollback()
        print(f"Error updating billing_cycle: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_customer_cycles()
