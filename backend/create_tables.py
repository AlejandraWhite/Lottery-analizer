from database import Base, engine
from models import Archivo, Resultado, ContadorTerminacion, EstadoTerminacion
import models_miercoles
import models_viernes
import models_scraping

print("Creando tablas...")

Base.metadata.create_all(bind=engine)

print("✅ Tablas creadas correctamente")