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
from datetime import timedelta
from fastapi import Query

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

@router.get("/permutantes-3")
def permutantes_3(db: Session = Depends(get_db)):
    return servicio.conteos_permutantes_3(db)


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

# ---------------- Prueba hacia atrás (backtest) de la selección de 3 cifras ----------------

UVT_2026 = 52374
TOPE_RETENCION = 48 * UVT_2026  # 2.513.952


def _premio_por_acierto(apuesta, multiplicador, encime, iva):
    # base + encime (% sobre la apuesta sin IVA), menos retención del 20% si supera 48 UVT
    sin_iva = apuesta / (1 + iva / 100)
    bruto = apuesta * multiplicador + sin_iva * encime / 100
    retencion = bruto * 0.2 if bruto > TOPE_RETENCION else 0
    return bruto - retencion


def _redondear(x):  # igual que Math.round de JavaScript
    return int(x + 0.5)


def _metas(total):
    # mismo reparto que el frontend: 108 / 40 / 2 para 150
    total = max(0, min(1000, total))
    pacha = _redondear(total * 2 / 150)
    repetidos = _redondear(total * 40 / 150)
    return total - pacha - repetidos, repetidos, pacha


def _seleccionar(conteos, ultimas, dia, dias_reciente, total):
    """La misma regla de la pantalla: los que más han caído, sin los que
    cayeron en los últimos `dias_reciente` días (las pacha no llevan ese filtro)."""
    limite = dia - timedelta(days=dias_reciente)
    n_dif, n_rep, n_pacha = _metas(total)

    por_tipo = {1: [], 2: [], 3: []}  # dígitos distintos: 3 = diferentes, 2 = un repetido, 1 = pacha
    for i in range(1000):
        num = f"{i:03d}"
        por_tipo[len(set(num))].append((num, conteos.get(num, 0), ultimas.get(num)))

    def elegir(lista, cuantos, filtrar_recientes):
        if filtrar_recientes:
            lista = [t for t in lista if not (t[2] and t[2] >= limite)]
        lista = sorted(lista, key=lambda t: (-t[1], t[2].isoformat() if t[2] else "", t[0]))
        return [t[0] for t in lista[:cuantos]]

    return (
        elegir(por_tipo[3], n_dif, True)
        + elegir(por_tipo[2], n_rep, True)
        + elegir(por_tipo[1], n_pacha, False)
    )


@router.get("/backtest-3")
def backtest_3(
    dias: int = Query(90, ge=1, le=730),
    total: int = Query(150, ge=1, le=1000),
    dias_reciente: int = Query(365, ge=0, le=3650),
    apuesta: float = 3000,
    multiplicador: float = 400,
    encime: float = 80,
    iva: float = 19,
    db: Session = Depends(get_db),
):
    filas = (
        db.query(R.fecha, R.numero)
        .filter(R.fecha.isnot(None), R.numero.isnot(None))
        .order_by(R.fecha)
        .all()
    )

    # fecha -> números de 3 cifras que cayeron ese día (los 3 últimos dígitos del de 4)
    por_dia = {}
    for fecha, numero in filas:
        if len(numero) != 4 or not numero.isdigit():
            continue
        if hasattr(fecha, "hour"):  # por si la columna es datetime
            fecha = fecha.date()
        por_dia.setdefault(fecha, []).append(numero[-3:])

    fechas = sorted(por_dia)
    a_evaluar = set(fechas[-dias:])
    premio_uno = _premio_por_acierto(apuesta, multiplicador, encime, iva)

    conteos, ultimas = {}, {}
    detalle = []

    for dia in fechas:
        cayeron = set(por_dia[dia])

        if dia in a_evaluar:
            # selección con los datos de ANTES de este día
            jugados = _seleccionar(conteos, ultimas, dia, dias_reciente, total)
            ganadores = sorted(n for n in jugados if n in cayeron)
            detalle.append({
                "fecha": dia.isoformat(),
                "jugados": len(jugados),
                "cayeron": len(cayeron),
                "aciertos": len(ganadores),
                "ganadores": ganadores,
                "esperado_azar": round(len(jugados) * len(cayeron) / 1000, 3),
                "costo": apuesta * len(jugados),
                "premio": premio_uno * len(ganadores),
            })

        # recién ahora se agrega el día a lo "conocido"
        for n in por_dia[dia]:
            conteos[n] = conteos.get(n, 0) + 1
            ultimas[n] = dia

    jugado = sum(d["costo"] for d in detalle)
    ganado = sum(d["premio"] for d in detalle)

    return {
        "premio_por_acierto": premio_uno,
        "resumen": {
            "dias_evaluados": len(detalle),
            "dias_con_premio": sum(1 for d in detalle if d["aciertos"] > 0),
            "aciertos": sum(d["aciertos"] for d in detalle),
            "aciertos_esperados_azar": round(sum(d["esperado_azar"] for d in detalle), 2),
            "jugado": jugado,
            "ganado": ganado,
            "neto": ganado - jugado,
        },
        "detalle": list(reversed(detalle)),  # el más reciente primero
    }