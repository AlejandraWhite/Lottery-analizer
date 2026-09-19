"""
routers/historico4.py
"""

import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import extract, func, nullslast, select
from sqlalchemy.orm import Session, aliased
from sqlalchemy.orm import Session

from database import SessionLocal
from models_historico4 import ResultadoHistorico4 as R
from services import historico4 as servicio

router = APIRouter(prefix="/historico-4-cifras", tags=["histórico 4 cifras"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/importar-excel")
async def importar_excel_historico_4(
    file: UploadFile = File(...),
    reemplazar: bool = False,
    fila_inicial: int = 1,   # pon 2 si la fila 1 es encabezado
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith((".xlsx", ".xlsm", ".xltx", ".xltm")):
        raise HTTPException(status_code=400, detail="El archivo debe ser un Excel válido")

    contenido = await file.read()

    try:
        insertadas, con_obs = servicio.importar_historico(
            db, contenido, file.filename,
            reemplazar=reemplazar, fila_inicial=fila_inicial,
        )
    except servicio.HistoricoYaImportado as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo procesar el archivo: {e}")

    return {
        "mensaje": (
            f"{insertadas} filas importadas (no se omitió ninguna)"
            + (f", {len(con_obs)} con observaciones" if con_obs else "")
        ),
        "filas_importadas": insertadas,
        "con_observaciones": con_obs[:500],
        "total_con_observaciones": len(con_obs),
        "resumen": servicio.resumen_historico(db),
    }


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    return servicio.resumen_historico(db)


@router.get("")
def listar(
    limite: int = 100,
    offset: int = 0,
    numero: str | None = None,   # lo que se escribe en la búsqueda global (1 a 4 cifras)
    modo: str = "cualquiera",    # "cualquiera" | "ultimas2"
    fecha: str | None = None,    # "09/09" o "09/09/2026"
    db: Session = Depends(get_db),
):
    consulta = db.query(R)

    if numero:
        q = "".join(ch for ch in numero if ch.isdigit())[:4]
        if q:
            if modo == "ultimas2":
                consulta = consulta.filter(R.numero.like(f"%{q.zfill(2)}"))
            else:
                consulta = consulta.filter(R.numero.like(f"%{q}%"))

    if fecha:
        m = re.fullmatch(r"\s*(\d{1,2})/(\d{1,2})(?:/(\d{4}))?\s*", fecha)
        if m:
            consulta = consulta.filter(
                extract("day", R.fecha) == int(m.group(1)),
                extract("month", R.fecha) == int(m.group(2)),
            )
            if m.group(3):
                consulta = consulta.filter(extract("year", R.fecha) == int(m.group(3)))

    total = consulta.count()

    # Para filas del Excel sin fecha reconocida (fila_excel no nulo,
    # fecha nula): se ordenan usando la fecha de la fila anterior más
    # cercana EN EL EXCEL (mismo fila_excel <= la suya) que sí tenga
    # fecha válida. Así quedan en su posición original dentro del
    # histórico, sin inventarles ni sobrescribirles la fecha real.
    R2 = aliased(R)
    fecha_heredada = (
        select(func.max(R2.fecha))
        .where(R2.fila_excel.isnot(None))
        .where(R2.fila_excel <= R.fila_excel)
        .where(R2.fecha.isnot(None))
        .correlate(R)
        .scalar_subquery()
    )
    orden_fecha = func.coalesce(R.fecha, fecha_heredada)

    filas = (
        consulta.order_by(
            nullslast(orden_fecha.desc()),
            nullslast(R.fila_excel.desc()),
            R.id.desc(),
        )
        .offset(offset)
        .limit(limite)
        .all()
    )
    return {
        "total": total,
        "limite": limite,
        "offset": offset,
        "items": [
            {
                "id": f.id,
                "fila_excel": f.fila_excel,
                "fecha": f.fecha.isoformat() if f.fecha else None,
                "numero": f.numero,
                "loteria": f.loteria,
                "columnas_extra": f.columnas_extra,
                "observacion": f.observacion,
            }
            for f in filas
        ],
    }