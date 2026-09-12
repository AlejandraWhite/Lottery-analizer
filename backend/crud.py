from sqlalchemy.orm import Session
from datetime import datetime
from models import Archivo, Resultado


# =========================================================
# CRUD DE ARCHIVO
# =========================================================

def crear_archivo(
    db: Session,
    nombre: str,
    nombre_original: str,
    fecha_creacion,
    fecha_actualizacion
):
    archivo = Archivo(
        nombre=nombre,
        nombre_original=nombre_original,
        fecha_creacion=fecha_creacion,
        fecha_actualizacion=fecha_actualizacion
    )

    db.add(archivo)
    db.commit()
    db.refresh(archivo)

    return archivo


def obtener_archivos(db: Session):
    return db.query(Archivo).order_by(Archivo.id.desc()).all()


def obtener_archivo(db: Session, archivo_id: int):
    return db.query(Archivo).filter(
        Archivo.id == archivo_id
    ).first()


def actualizar_archivo(
    db: Session,
    archivo_id: int,
    nombre: str,
    fecha_actualizacion
):
    archivo = obtener_archivo(db, archivo_id)

    if not archivo:
        return None

    archivo.nombre = nombre
    archivo.fecha_actualizacion = fecha_actualizacion

    db.commit()
    db.refresh(archivo)

    return archivo


def eliminar_archivo(db: Session, archivo_id: int):
    archivo = obtener_archivo(db, archivo_id)

    if not archivo:
        return None

    db.delete(archivo)
    db.commit()

    return archivo


# =========================================================
# CRUD DE RESULTADO
# =========================================================

def crear_resultado(
    db: Session,
    archivo_id: int,
    fecha,
    numero: str,
    loteria: str
):
    resultado = Resultado(
        archivo_id=archivo_id,
        fecha=fecha,
        numero=numero,
        loteria=loteria
    )

    db.add(resultado)
    db.commit()
    db.refresh(resultado)

    return resultado


def obtener_resultados(db: Session, archivo_id: int):
    return db.query(Resultado).filter(
        Resultado.archivo_id == archivo_id
    ).order_by(Resultado.fecha.asc()).all()


def obtener_resultado(db: Session, resultado_id: int):
    return db.query(Resultado).filter(
        Resultado.id == resultado_id
    ).first()


def actualizar_resultado(
    db: Session,
    resultado_id: int,
    fecha,
    numero: str,
    loteria: str
):
    resultado = obtener_resultado(db, resultado_id)

    if not resultado:
        return None

    resultado.fecha = fecha
    resultado.numero = numero
    resultado.loteria = loteria

    db.commit()
    db.refresh(resultado)

    return resultado


def eliminar_resultado(db: Session, resultado_id: int):
    resultado = obtener_resultado(db, resultado_id)

    if not resultado:
        return None

    db.delete(resultado)
    db.commit()

    return resultado

def obtener_o_crear_archivo_sincronizacion(db: Session) -> Archivo:
    """
    El scraping no viene de un Excel subido, pero Resultado exige
    archivo_id. Se reutiliza siempre el mismo archivo "marcador".
    """
    NOMBRE_MARCADOR = "sincronizacion_scraping"
    archivo = db.query(Archivo).filter(Archivo.nombre == NOMBRE_MARCADOR).first()
    if archivo:
        return archivo

    ahora = datetime.now()
    return crear_archivo(
        db,
        nombre=NOMBRE_MARCADOR,
        nombre_original="Sincronización automática (scraping)",
        fecha_creacion=ahora,
        fecha_actualizacion=ahora,
    )


def crear_resultado_scraping(db: Session, archivo_id: int, fecha, numero_completo: str, loteria: str):
    """Como crear_resultado, pero guardando también numero_completo (4 cifras)."""
    resultado = Resultado(
        archivo_id=archivo_id,
        fecha=fecha,
        numero=numero_completo[-2:],
        numero_completo=numero_completo,
        loteria=loteria,
    )
    db.add(resultado)
    db.commit()
    db.refresh(resultado)
    return resultado