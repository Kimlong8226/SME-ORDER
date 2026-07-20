"""
数据库迁移脚本：为 meal_sections 表添加缺失的 sort_order 列，同时检查 customer_packages
"""
import sqlite3

DB_PATH = "central_kitchen.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. 检查并迁移 meal_sections
    cursor.execute("PRAGMA table_info(meal_sections)")
    cols_meal = [row[1] for row in cursor.fetchall()]
    print(f"当前 meal_sections 列: {cols_meal}")

    if "sort_order" not in cols_meal:
        cursor.execute(
            "ALTER TABLE meal_sections ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
        )
        conn.commit()
        print("✅ 已成功为 meal_sections 添加列: sort_order (默认值 = 0)")
    else:
        print("✅ 列 meal_sections.sort_order 已存在")

    if "allowed_categories" not in cols_meal:
        cursor.execute(
            "ALTER TABLE meal_sections ADD COLUMN allowed_categories VARCHAR(200) NOT NULL DEFAULT ''"
        )
        conn.commit()
        print("✅ 已成功为 meal_sections 添加列: allowed_categories (默认值 = '')")
    else:
        print("✅ 列 meal_sections.allowed_categories 已存在")

    # 2. 检查并迁移 customer_packages (防止覆盖或未加)
    cursor.execute("PRAGMA table_info(customer_packages)")
    cols_pkg = [row[1] for row in cursor.fetchall()]
    if "is_shown_to_customer" not in cols_pkg:
        cursor.execute(
            "ALTER TABLE customer_packages ADD COLUMN is_shown_to_customer INTEGER NOT NULL DEFAULT 1"
        )
        conn.commit()
        print("✅ 已成功为 customer_packages 添加列: is_shown_to_customer (默认值 = 1)")
    else:
        print("✅ 列 customer_packages.is_shown_to_customer 已存在")

    conn.close()
    print("数据库迁移执行完成。")

if __name__ == "__main__":
    migrate()
