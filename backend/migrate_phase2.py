
from sqlalchemy import inspect

from database import Base, engine
import models  # Registers all models with Base.metadata


def migrate():
    # Creates new tables without deleting existing tables or records.
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)

    changes = {
        "users": [
            (
                "is_active",
                "BOOLEAN NOT NULL DEFAULT 1",
            ),
        ],
        "payroll": [
            (
                "allowances",
                "FLOAT NOT NULL DEFAULT 0",
            ),
        ],
    }

    with engine.begin() as connection:
        for table_name, columns in changes.items():
            existing_columns = {
                column["name"]
                for column in inspect(connection).get_columns(table_name)
            }

            for column_name, column_definition in columns:
                if column_name not in existing_columns:
                    sql = (
                        f"ALTER TABLE {table_name} "
                        f"ADD COLUMN {column_name} {column_definition}"
                    )
                    connection.exec_driver_sql(sql)
                    print(f"Added {table_name}.{column_name}")
                else:
                    print(f"Already exists: {table_name}.{column_name}")

    print("Phase 2 database migration completed.")


if __name__ == "__main__":
    migrate()
