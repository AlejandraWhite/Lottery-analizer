from database import Base, engine
from models import Archivo, Resultado, ContadorTerminacion

print("Creando tablas...")

Base.metadata.create_all(bind=engine)

print("✅ Tablas creadas correctamente")