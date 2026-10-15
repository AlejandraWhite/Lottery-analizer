# routers/miercoles_analisis.py
#
# Análisis de terminaciones de 2 cifras (00-99) para la pantalla
# "Miércoles análisis". Lee TODO el histórico de 4 cifras
# (ResultadoHistorico4) y devuelve, por terminación, las fechas en que cayó:
#
#   - todas:      todas las loterías del histórico
#   - meta / valle / manizales: solo esa lotería
#   - miercoles:  todas las loterías, pero solo los sorteos que fueron miércoles
#   - por_miercoles: cada miércoles con los números (4 cifras) que cayeron
#
# NOTA: las tablas ResultadoMiercoles solo conservan última/penúltima/
# antepenúltima por terminación (la cadena borra las más viejas), por eso
# el análisis completo se hace sobre el histórico de 4 cifras.

from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import models_historico4
from database import SessionLocal

router = APIRouter(prefix="/miercoles", tags=["miercoles-analisis"])

LOTERIAS_MIERCOLES = ("meta", "valle", "manizales")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _clave_loteria(nombre):
    """Clasifica el nombre guardado en el histórico ("Meta", "Lotería del Valle",
    "MANIZALES"...) en meta / valle / manizales. Devuelve None si es otra."""
    n = (nombre or "").lower()
    for clave in LOTERIAS_MIERCOLES:
        if clave in n:
            return clave
    return None


@router.get("/loterias-historico")
def loterias_en_historico(db: Session = Depends(get_db)):
    """Diagnóstico: nombres de lotería que existen en el histórico y cómo se
    clasifican. Úsalo para verificar que Meta/Valle/Manizales se detectan bien."""
    H = models_historico4.ResultadoHistorico4
    filas = (
        db.query(H.loteria, func.count(H.id))
        .group_by(H.loteria)
        .order_by(func.count(H.id).desc())
        .all()
    )
    return [
        {"loteria": nombre, "filas": cantidad, "clasificada_como": _clave_loteria(nombre)}
        for nombre, cantidad in filas
    ]


@router.get("/analisis-2cifras")
def analisis_2cifras(db: Session = Depends(get_db)):
    H = models_historico4.ResultadoHistorico4
    filas = (
        db.query(H.fecha, H.numero, H.loteria)
        .filter(H.numero.isnot(None), H.fecha.isnot(None))
        .all()
    )

    todas = defaultdict(list)
    por_loteria = {clave: defaultdict(list) for clave in LOTERIAS_MIERCOLES}
    miercoles = defaultdict(list)
    por_miercoles = defaultdict(list)
    total = 0
    total_miercoles = 0

    for fecha, numero, loteria in filas:
        if len(numero) != 4 or not numero.isdigit():
            continue  # filas raras (asteriscos, etc.)

        if isinstance(fecha, datetime):
            fecha = fecha.date()

        total += 1
        terminacion = numero[-2:]
        iso = fecha.isoformat()

        todas[terminacion].append(iso)

        clave = _clave_loteria(loteria)
        if clave:
            por_loteria[clave][terminacion].append(iso)

        if fecha.weekday() == 2:  # 0 = lunes ... 2 = miércoles
            total_miercoles += 1
            miercoles[terminacion].append(iso)
            por_miercoles[iso].append({"numero": numero, "loteria": loteria})

    def ordenar(d):
        return {k: sorted(v) for k, v in d.items()}

    lista_miercoles = [
        {
            "fecha": iso,
            "caidas": sorted(caidas, key=lambda c: (c["loteria"] or "", c["numero"])),
        }
        for iso, caidas in sorted(por_miercoles.items(), reverse=True)  # más reciente primero
    ]

    return {
        "total": total,
        "total_miercoles": total_miercoles,
        "todas": ordenar(todas),
        "meta": ordenar(por_loteria["meta"]),
        "valle": ordenar(por_loteria["valle"]),
        "manizales": ordenar(por_loteria["manizales"]),
        "miercoles": ordenar(miercoles),
        "por_miercoles": lista_miercoles,
    }