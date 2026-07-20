"""
数据库迁移脚本：创建 customer_meal_sections 表（记录客户与开通餐次的关联）
"""
import sqlite3

DB_PATH = "central_kitchen.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 创建 customer_meal_sections 关联表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customer_meal_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        meal_section_id INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
        FOREIGN KEY (meal_section_id) REFERENCES meal_sections (id) ON DELETE CASCADE,
        UNIQUE(customer_id, meal_section_id)
    )
    """)
    conn.commit()
    print("✅ 已成功创建 customer_meal_sections 关联表")

    # 初始化默认开通：让现有客户默认开通所有已配置了套餐分类的餐次 (9, 10, 11, 12, 13, 14)
    cursor.execute("SELECT id FROM customers")
    customers = [row[0] for row in cursor.fetchall()]
    
    cursor.execute("SELECT id FROM meal_sections WHERE allowed_categories != ''")
    sections = [row[0] for row in cursor.fetchall()]

    for cid in customers:
        for sid in sections:
            try:
                cursor.execute(
                    "INSERT OR IGNORE INTO customer_meal_sections (customer_id, meal_section_id) VALUES (?, ?)",
                    (cid, sid)
                )
            except Exception as e:
                pass
    conn.commit()
    print(f"✅ 已为 {len(customers)} 个现有客户初始化了默认开通餐次")

    conn.close()
    print("迁移完成")

if __name__ == "__main__":
    migrate()
