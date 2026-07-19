"""
一次性迁移脚本：给 addon_templates 表添加 description 列
若列已存在则跳过
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from database import engine
from sqlalchemy import text, inspect

def migrate():
    inspector = inspect(engine)
    # 检查表是否存在
    tables = inspector.get_table_names()
    if 'addon_templates' not in tables:
        # 表不存在说明还没初始化，直接用 SQLAlchemy create_all 建表
        from model import models
        models.Base.metadata.create_all(bind=engine)
        print("Tables created via create_all (description column included)")
        return

    # 表已存在，检查 description 列
    cols = [c['name'] for c in inspector.get_columns('addon_templates')]
    print("Existing columns:", cols)
    if 'description' not in cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE addon_templates ADD COLUMN description TEXT"))
            conn.commit()
        print("Added description column successfully")
    else:
        print("description column already exists, skipping")

if __name__ == '__main__':
    migrate()
