from database import SessionLocal
from model.models import Invoice

def migrate_tdo_numbers():
    db = SessionLocal()
    try:
        invoices = db.query(Invoice).all()
        migrated_count = 0
        for inv in invoices:
            old_no = inv.invoice_number
            if old_no.startswith("INV-KL-") or old_no.startswith("DO-SUM-"):
                created_date = inv.created_at.strftime("%Y%m%d") if inv.created_at else "20260726"
                new_no = f"TDO-{created_date}-{inv.id:04d}"
                inv.invoice_number = new_no
                migrated_count += 1
                print(f"Migrated: {old_no} -> {new_no}")
        
        db.commit()
        print(f"Migration completed! Total {migrated_count} records updated.")
    except Exception as e:
        db.rollback()
        print(f"Migration error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_tdo_numbers()
