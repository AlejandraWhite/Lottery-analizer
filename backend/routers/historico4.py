"""
routers/historico4.py
"""

import json
import re


from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import extract, func, nullslast, select
from sqlalchemy.orm import Session, aliased
from typing import Literal, Optional
from database import SessionLocal
from models_historico4 import ResultadoHistorico4 as R
from services import historico4 as servicio
from datetime import timedelta
from fastapi import Query
from models_jugada3 import Jugada3

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

@router.get("/fechas-3")
def fechas_por_combinacion_3(db: Session = Depends(get_db)):
    """Para cada número de 3 cifras (últimos 3 dígitos del de 4), todas las
    fechas en que cayó, en orden. El frontend calcula los intervalos."""
    filas = (
        db.query(R.fecha, R.numero)
        .filter(R.fecha.isnot(None), R.numero.isnot(None))
        .order_by(R.fecha)
        .all()
    )

    fechas = {}
    total = 0
    for fecha, numero in filas:
        if len(numero) != 4 or not numero.isdigit():
            continue
        if hasattr(fecha, "hour"):  # por si la columna es datetime
            fecha = fecha.date()
        fechas.setdefault(numero[-3:], []).append(fecha.isoformat())
        total += 1

    return {"total": total, "fechas": fechas}

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


class MetasIn(BaseModel):
    diferentes: int = Field(108, ge=0, le=1000)
    repetidos: int = Field(40, ge=0, le=1000)
    pacha: int = Field(2, ge=0, le=1000)


class Backtest3In(BaseModel):
    dias: int = Field(90, ge=1, le=730)
    criterio: Literal["frecuentes", "ratio", "atraso", "sinCaer", "mezcla"] = "frecuentes"
    min_veces: int = Field(3, ge=1, le=1000)
    dias_reciente: int = Field(365, ge=0, le=3650)
    repartir: bool = True
    metas: MetasIn = MetasIn()
    total: int = Field(150, ge=1, le=1000)
    pct_frecuencia: int = Field(50, ge=0, le=100)
    apuesta: float = 3000
    multiplicador: float = 400
    encime: float = 80
    iva: float = 19


TODOS = [f"{i:03d}" for i in range(1000)]
TIPO = {n: len(set(n)) for n in TODOS}  # 3 = diferentes, 2 = un repetido, 1 = pacha


def _estadisticas_dia(dia, cuenta, primera, ultima):
    """Stats de cada número usando SOLO lo conocido antes de `dia`."""
    filas = []
    for n in TODOS:
        c = cuenta.get(n, 0)
        ult = ultima.get(n)
        sin = (dia - ult).days if ult else None
        prom = (ult - primera[n]).days / (c - 1) if c >= 2 else None
        filas.append({
            "n": n,
            "tipo": TIPO[n],
            "cantidad": c,
            "ultima": ult,
            "sin": sin,
            "prom": prom,
            "veces": sin / prom if prom and sin is not None else None,
            "atraso": sin - prom if prom is not None and sin is not None else None,
        })
    return filas


def _elegibles(crit, filas, dia, d):
    limite = dia.toordinal() - d.dias_reciente

    if crit == "frecuentes":
        lista = [
            f for f in filas
            if not (f["tipo"] != 1 and f["ultima"] and f["ultima"].toordinal() >= limite)
        ]
        lista.sort(key=lambda f: (-f["cantidad"], f["ultima"].isoformat() if f["ultima"] else "", f["n"]))
    elif crit == "sinCaer":
        lista = [f for f in filas if f["sin"] is not None and f["cantidad"] >= 1]
        lista.sort(key=lambda f: (-f["sin"], f["n"]))
    else:  # ratio / atraso
        campo = "veces" if crit == "ratio" else "atraso"
        lista = [
            f for f in filas
            if f["prom"] is not None and f["cantidad"] >= d.min_veces and f[campo] is not None
        ]
        lista.sort(key=lambda f: (-f[campo], f["n"]))
    return lista


def _seleccionar_dia(filas, dia, d, tipo, cuantos):
    delTipo = filas if tipo is None else [f for f in filas if f["tipo"] == tipo]
    if d.criterio == "mezcla":
        nf = round(cuantos * d.pct_frecuencia / 100)
        a = _elegibles("frecuentes", delTipo, dia, d)[:nf]
        usados = {f["n"] for f in a}
        b = [f for f in _elegibles("ratio", delTipo, dia, d) if f["n"] not in usados]
        return [f["n"] for f in a + b[: cuantos - len(a)]]
    return [f["n"] for f in _elegibles(d.criterio, delTipo, dia, d)[:cuantos]]


@router.post("/backtest-3")
def backtest_3(d: Backtest3In, db: Session = Depends(get_db)):
    filas = (
        db.query(R.fecha, R.numero)
        .filter(R.fecha.isnot(None), R.numero.isnot(None))
        .order_by(R.fecha)
        .all()
    )

    por_dia = {}
    for fecha, numero in filas:
        if len(numero) != 4 or not numero.isdigit():
            continue
        if hasattr(fecha, "hour"):
            fecha = fecha.date()
        por_dia.setdefault(fecha, []).append(numero[-3:])

    fechas = sorted(por_dia)
    a_evaluar = set(fechas[-d.dias:])
    premio_uno = _premio_por_acierto(d.apuesta, d.multiplicador, d.encime, d.iva)

    cuenta, primera, ultima = {}, {}, {}
    detalle = []

    for dia in fechas:
        cayeron = set(por_dia[dia])

        if dia in a_evaluar:
            stats = _estadisticas_dia(dia, cuenta, primera, ultima)  # solo datos previos
            if d.repartir:
                jugados = (
                    _seleccionar_dia(stats, dia, d, 3, d.metas.diferentes)
                    + _seleccionar_dia(stats, dia, d, 2, d.metas.repetidos)
                    + _seleccionar_dia(stats, dia, d, 1, d.metas.pacha)
                )
            else:
                jugados = _seleccionar_dia(stats, dia, d, None, d.total)

            ganadores = sorted(n for n in jugados if n in cayeron)
            detalle.append({
                "fecha": dia.isoformat(),
                "jugados": len(jugados),
                "cayeron": len(cayeron),
                "aciertos": len(ganadores),
                "ganadores": ganadores,
                "esperado_azar": round(len(jugados) * len(cayeron) / 1000, 3),
                "costo": d.apuesta * len(jugados),
                "premio": premio_uno * len(ganadores),
            })

        # recién ahora el día pasa a ser "conocido"
        for n in cayeron:
            cuenta[n] = cuenta.get(n, 0) + 1
            primera.setdefault(n, dia)
            ultima[n] = dia

    jugado = sum(x["costo"] for x in detalle)
    ganado = sum(x["premio"] for x in detalle)

    return {
        "premio_por_acierto": premio_uno,
        "resumen": {
            "dias_evaluados": len(detalle),
            "dias_con_premio": sum(1 for x in detalle if x["aciertos"] > 0),
            "aciertos": sum(x["aciertos"] for x in detalle),
            "aciertos_esperados_azar": round(sum(x["esperado_azar"] for x in detalle), 2),
            "jugado": jugado,
            "ganado": ganado,
            "neto": ganado - jugado,
        },
        "detalle": list(reversed(detalle)),
    }

class JugadaIn(BaseModel):
    numeros: list[str] = Field(..., min_length=1, max_length=1000)
    nombre: Optional[str] = None
    apuesta: float = 3000
    multiplicador: float = 400
    encime: float = 80


def _a_fecha(f):
    return f.date() if hasattr(f, "hour") else f


def _evaluar(j: Jugada3, db: Session):
    """Si ya llegaron resultados posteriores a fecha_corte, evalúa la jugada y la cierra."""
    if j.estado != "pendiente":
        return

    q = db.query(R.fecha, R.numero, R.loteria).filter(
        R.fecha.isnot(None), R.numero.isnot(None)
    )
    if j.fecha_corte:
        q = q.filter(R.fecha > j.fecha_corte)

    jugados = set(json.loads(j.numeros))
    dias = set()
    hits = {}  # (numero, fecha) -> [loterias]
    for fecha, numero, loteria in q.all():
        if len(numero) != 4 or not numero.isdigit():
            continue
        fecha = _a_fecha(fecha)
        dias.add(fecha)
        n3 = numero[-3:]
        if n3 in jugados:
            hits.setdefault((n3, fecha), [])
            if loteria and loteria not in hits[(n3, fecha)]:
                hits[(n3, fecha)].append(loteria)

    if not dias:
        return  # todavía no llegan resultados nuevos

    premio_uno = _premio_por_acierto(j.apuesta, j.multiplicador, j.encime, 19)
    aciertos = [
        {"numero": n, "fecha": f.isoformat(), "loterias": l}
        for (n, f), l in sorted(hits.items(), key=lambda x: (x[0][1], x[0][0]))
    ]

    j.estado = "evaluada"
    j.fecha_desde = min(dias)
    j.fecha_hasta = max(dias)
    j.dias_evaluados = len(dias)
    j.aciertos = json.dumps(aciertos)
    j.costo = j.apuesta * len(jugados) * len(dias)
    j.premio = premio_uno * len(aciertos)


def _jugada_a_dict(j: Jugada3):
    numeros = json.loads(j.numeros)
    return {
        "id": j.id,
        "nombre": j.nombre,
        "numeros": numeros,
        "cantidad_numeros": len(numeros),
        "apuesta": j.apuesta,
        "multiplicador": j.multiplicador,
        "encime": j.encime,
        "creada_en": j.creada_en.isoformat() if j.creada_en else None,
        "fecha_corte": j.fecha_corte.isoformat() if j.fecha_corte else None,
        "estado": j.estado,
        "vista": j.vista,
        "fecha_desde": j.fecha_desde.isoformat() if j.fecha_desde else None,
        "fecha_hasta": j.fecha_hasta.isoformat() if j.fecha_hasta else None,
        "dias_evaluados": j.dias_evaluados,
        "aciertos": json.loads(j.aciertos or "[]"),
        "costo": j.costo,
        "premio": j.premio,
        "neto": (j.premio or 0) - (j.costo or 0),
    }


@router.post("/jugadas-3")
def guardar_jugada_3(datos: JugadaIn, db: Session = Depends(get_db)):
    numeros = sorted({n for n in datos.numeros if len(n) == 3 and n.isdigit()})
    if not numeros:
        raise HTTPException(status_code=400, detail="No hay números válidos de 3 cifras")

    ultima = db.query(func.max(R.fecha)).scalar()
    j = Jugada3(
        nombre=(datos.nombre or "").strip() or None,
        numeros=json.dumps(numeros),
        apuesta=datos.apuesta,
        multiplicador=datos.multiplicador,
        encime=datos.encime,
        fecha_corte=_a_fecha(ultima) if ultima else None,
    )
    db.add(j)
    db.commit()
    db.refresh(j)
    return _jugada_a_dict(j)


@router.get("/jugadas-3")
def listar_jugadas_3(db: Session = Depends(get_db)):
    jugadas = db.query(Jugada3).order_by(Jugada3.creada_en.desc()).all()
    for j in jugadas:
        _evaluar(j, db)  # evalúa las pendientes contra los resultados nuevos
    db.commit()
    return [_jugada_a_dict(j) for j in jugadas]


@router.delete("/jugadas-3/{jugada_id}")
def eliminar_jugada_3(jugada_id: int, db: Session = Depends(get_db)):
    j = db.get(Jugada3, jugada_id)
    if not j:
        raise HTTPException(status_code=404, detail="Jugada no encontrada")
    db.delete(j)
    db.commit()
    return {"ok": True}


@router.post("/jugadas-3/{jugada_id}/vista")
def marcar_jugada_3_vista(jugada_id: int, db: Session = Depends(get_db)):
    j = db.get(Jugada3, jugada_id)
    if not j:
        raise HTTPException(status_code=404, detail="Jugada no encontrada")
    j.vista = True
    db.commit()
    return {"ok": True}