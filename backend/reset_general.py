# reset_general.py
from database import SessionLocal  # ajustá al nombre real de tu sessionmaker
from models import Archivo, Resultado, EstadoTerminacion, ContadorTerminacion

def borrar_todo(db):
    db.query(EstadoTerminacion).delete()
    db.query(ContadorTerminacion).delete()
    db.query(Resultado).delete()
    db.query(Archivo).delete()
    db.commit()
    print("Borrado completo. Listo para volver a subir los excels y re-sincronizar.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        borrar_todo(db)
    finally:
        db.close()