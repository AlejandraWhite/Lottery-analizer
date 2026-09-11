from database import engine, Base
import models            # tus modelos existentes (no se tocan, no se recrean)
import models_miercoles  # los nuevos

Base.metadata.create_all(bind=engine)

print("Listo: tablas creadas (las que ya existían no se tocan).")