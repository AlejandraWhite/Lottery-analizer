# routers/viernes_analisis.py
#
# Análisis de terminaciones de 2 cifras (00-99) para la pantalla
# "Viernes análisis". Igual que routers/miercoles_analisis.py, pero para las
# loterías de los viernes: Risaralda, Medellín y Santander.
# Lee TODO el histórico de 4 cifras (ResultadoHistorico4) y devuelve:
#
#   - todas:      todas las loterías del histórico
#   - risaralda / medellin / santander: solo esa lotería
#   - viernes:    todas las loterías, pero solo los sorteos que fueron viernes
#   - por_viernes: cada viernes con los números (4 cifras) que cayeron

import unicodedata
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import models_historico4
from database import SessionLocal

router = APIRouter(prefix="/viernes", tags=["viernes-analisis"])

LOTERIAS_VIERNES = ("risaralda", "medellin", "santander")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _normalizar(texto):
    """Minúsculas y sin tildes: "Lotería de Medellín" -> "loteria de medellin"."""
    texto = unicodedata.normalize("NFD", texto or "")
    return "".join(c for c in texto if unicodedata.category(c) != "Mn").lower()


def _clave_loteria(nombre):
    """Clasifica el nombre guardado en el histórico en risaralda / medellin /
    santander. Devuelve None si es otra lotería."""
    n = _normalizar(nombre)
    for clave in LOTERIAS_VIERNES:
        if clave in n:
            return clave
    return None


@router.get("/loterias-historico")
def loterias_en_historico(db: Session = Depends(get_db)):
    """Diagnóstico: nombres de lotería que existen en el histórico y cómo se
    clasifican. Úsalo para verificar que Risaralda/Medellín/Santander se detectan bien."""
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
    por_loteria = {clave: defaultdict(list) for clave in LOTERIAS_VIERNES}
    viernes = defaultdict(list)
    por_viernes = defaultdict(list)
    total = 0
    total_viernes = 0

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

        if fecha.weekday() == 4:  # 0 = lunes ... 4 = viernes
            total_viernes += 1
            viernes[terminacion].append(iso)
            por_viernes[iso].append({"numero": numero, "loteria": loteria})

    def ordenar(d):
        return {k: sorted(v) for k, v in d.items()}

    lista_viernes = [
        {
            "fecha": iso,
            "caidas": sorted(caidas, key=lambda c: (c["loteria"] or "", c["numero"])),
        }
        for iso, caidas in sorted(por_viernes.items(), reverse=True)  # más reciente primero
    ]

    return {
        "total": total,
        "total_viernes": total_viernes,
        "todas": ordenar(todas),
        "risaralda": ordenar(por_loteria["risaralda"]),
        "medellin": ordenar(por_loteria["medellin"]),
        "santander": ordenar(por_loteria["santander"]),
        "viernes": ordenar(viernes),
        "por_viernes": lista_viernes,
    }