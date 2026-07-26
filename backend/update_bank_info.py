from database import SessionLocal
from model.models import Customer

def update_bank_info():
    db = SessionLocal()
    try:
        updated = db.query(Customer).update({
            "bank_name": "CIMB BANK BERHAD",
            "bank_account_no": "8606211195"
        })
        db.commit()
        print(f"Successfully updated bank details for {updated} customers.")
    except Exception as e:
        db.rollback()
        print(f"Error updating bank details: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_bank_info()
