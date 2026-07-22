import os
from database import SessionLocal
from model.models import Order, OrderDetail, Invoice

def clean_database():
    print("=== 开始清理生产环境数据库 ===")
    db = SessionLocal()
    
    try:
        # 1. 物理删除 Invoice
        deleted_invoices = db.query(Invoice).delete()
        print(f"✓ 成功删除 {deleted_invoices} 条发票 (Invoice) 记录")
        
        # 2. 物理删除 OrderDetail
        deleted_details = db.query(OrderDetail).delete()
        print(f"✓ 成功删除 {deleted_details} 条订单明细 (OrderDetail) 记录")
        
        # 3. 物理删除 Order
        deleted_orders = db.query(Order).delete()
        print(f"✓ 成功删除 {deleted_orders} 条订单 (Order) 记录")
        
        db.commit()
        print("✅ 数据库清理完成，生产环境已重置至干净状态！")
    except Exception as e:
        db.rollback()
        print(f"✗ 数据库清理失败: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    clean_database()
