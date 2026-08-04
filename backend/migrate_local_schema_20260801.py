"""Bring an existing local SQLite database up to the current model schema."""

from sqlalchemy import inspect, text

from database import Base, engine
import model.models  # noqa: F401 - registers all model tables with Base


SQLITE_COLUMNS = {
    "customers": {
        "block_source": "VARCHAR(20)",
        "block_reason": "TEXT",
        "blocked_at": "DATETIME",
        "temporary_access_started_at": "DATETIME",
        "temporary_access_until": "DATETIME",
        "temporary_access_reason": "TEXT",
        "restriction_updated_by": "VARCHAR(100)",
        "order_cutoff_day_offset": "INTEGER NOT NULL DEFAULT 1",
        "order_cutoff_time": "VARCHAR(5) NOT NULL DEFAULT '18:00'",
    },
    "orders": {
        "do_number": "VARCHAR(50)",
        "updated_at": "DATETIME",
        "version": "INTEGER NOT NULL DEFAULT 1",
        "is_late_override": "BOOLEAN NOT NULL DEFAULT 0",
    },
}


def migrate() -> None:
    if engine.url.drivername != "sqlite":
        raise RuntimeError("This migration is only for the local SQLite database")

    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, columns in SQLITE_COLUMNS.items():
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, definition in columns.items():
                if column_name not in existing:
                    connection.execute(
                        text(
                            f'ALTER TABLE "{table_name}" '
                            f'ADD COLUMN "{column_name}" {definition}'
                        )
                    )
                    print(f"Added {table_name}.{column_name}")

        connection.execute(text(
            "UPDATE orders "
            "SET do_number = 'DO-' || strftime('%Y%m%d', delivery_date) || '-' || printf('%04d', id) "
            "WHERE do_number IS NULL"
        ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_do_number ON orders(do_number)"
        ))

    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_whatsapp_groups_group_id "
            "ON customer_whatsapp_groups(group_id)"
        ))
    print("Local schema migration complete")


if __name__ == "__main__":
    migrate()
