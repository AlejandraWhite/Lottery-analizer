from database import engine, Base
import models


print("Creando tablas...")

Base.metadata.create_all(bind=engine)

print("✅ Tablas creadas correctamente")