from datetime import date
from database import SessionLocal
from model.models import Customer, Order, Invoice, OrderDetail

db = SessionLocal()
try:
    customers = db.query(Customer).all()
    cust_map = {c.company_name: c for c in customers}
    
    # EPG
    epg_cust = cust_map.get("EPG 有限公司")
    if epg_cust:
        epg_orders = db.query(Order).filter(
            Order.customer_id == epg_cust.id,
            Order.delivery_date >= date.fromisoformat("2026-07-13"),
            Order.delivery_date <= date.fromisoformat("2026-07-17")
        ).all()
        
        print("EPG orders found:", len(epg_orders))
        if epg_orders:
            epg_total_amount = sum(sum(d.quantity * d.final_unit_price for d in o.details) for o in epg_orders)
            epg_inv = Invoice(
                invoice_number="INV-KL-EPG-20260719001",
                customer_id=epg_cust.id,
                start_date=date.fromisoformat("2026-07-13"),
                end_date=date.fromisoformat("2026-07-17"),
                total_amount=epg_total_amount,
                payment_status="unpaid"
            )
            db.add(epg_inv)
            db.commit()
            db.refresh(epg_inv)
            print("Created EPG invoice:", epg_inv.invoice_number, "Amount:", epg_total_amount)
            
            for o in epg_orders:
                o.invoice_id = epg_inv.id
                o.status = "billed"
            db.commit()

    # GSP
    gsp_cust = cust_map.get("GSP 集团")
    if gsp_cust:
        gsp_orders = db.query(Order).filter(
            Order.customer_id == gsp_cust.id,
            Order.delivery_date >= date.fromisoformat("2026-07-13"),
            Order.delivery_date <= date.fromisoformat("2026-07-16")
        ).all()
        
        print("GSP orders found:", len(gsp_orders))
        if gsp_orders:
            gsp_total_amount = sum(sum(d.quantity * d.final_unit_price for d in o.details) for o in gsp_orders)
            gsp_inv = Invoice(
                invoice_number="INV-KL-GSP-20260719002",
                customer_id=gsp_cust.id,
                start_date=date.fromisoformat("2026-07-13"),
                end_date=date.fromisoformat("2026-07-16"),
                total_amount=gsp_total_amount,
                payment_status="paid"
            )
            db.add(gsp_inv)
            db.commit()
            db.refresh(gsp_inv)
            print("Created GSP invoice:", gsp_inv.invoice_number, "Amount:", gsp_total_amount)
            
            for o in gsp_orders:
                o.invoice_id = gsp_inv.id
                o.status = "billed"
            db.commit()
except Exception as e:
    print("Error:", e)
    db.rollback()
finally:
    db.close()
