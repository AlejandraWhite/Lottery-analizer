from sqlalchemy import text
from database import engine


try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version()"))
        version = result.fetchone()[0]

        print("✅ CONEXIÓN EXITOSA")
        print(version)

except Exception as e:
    print("❌ ERROR DE CONEXIÓN")
    print(e)