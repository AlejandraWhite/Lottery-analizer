# routers/combinaciones_terminaciones.py
#
# Combinaciones de terminaciones (2 cifras) que cayeron JUNTAS el mismo día.
#
#   - Días con 3 loterías (miércoles y viernes): tríos de terminaciones
#     (sin importar el orden: 12-45-78 = 45-12-78). Posibles: C(100,3) = 161.700
#   - Días con 2 loterías: parejas de terminaciones. Posibles: C(100,2) = 4.950
#
# Un "día con N loterías" es una fecha del histórico de 4 cifras que tiene
# exactamente N sorteos (se ignoran filas repetidas de la misma lotería/número).
# Si en ese día dos terminaciones son iguales (p. ej. 12-12-45) el día no entra
# en el conteo de combinaciones distintas y se reporta aparte.
#
# El endpoint devuelve solo las combinaciones que SÍ han caído; el frontend
# genera todas las posibles y calcula las que nunca han caído.

from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models_historico4
from database import SessionLocal

router = APIRouter(prefix="/combinaciones", tags=["combinaciones"])

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/terminaciones")
def combinaciones_terminaciones(db: Session = Depends(get_db)):
    H = models_historico4.ResultadoHistorico4
    filas = (
        db.query(H.fecha, H.numero, H.loteria)
        .filter(H.numero.isnot(None), H.fecha.isnot(None))
        .all()
    )

    por_fecha = defaultdict(set)
    for fecha, numero, loteria in filas:
        if len(numero) != 4 or not numero.isdigit():
            continue  # filas raras (asteriscos, etc.)
        if isinstance(fecha, datetime):
            fecha = fecha.date()
        por_fecha[fecha].add((numero, loteria))

    trios = defaultdict(list)
    parejas = defaultdict(list)
    dias_3 = dias_2 = 0
    repetidas_3 = repetidas_2 = 0
    distribucion = {"3": defaultdict(int), "2": defaultdict(int)}

    for fecha, sorteos in sorted(por_fecha.items()):
        n = len(sorteos)
        if n not in (2, 3):
            continue

        distribucion[str(n)][DIAS[fecha.weekday()]] += 1
        terminaciones = [numero[-2:] for numero, _ in sorteos]
        distintas = sorted(set(terminaciones))
        iso = fecha.isoformat()

        if n == 3:
            dias_3 += 1
            if len(distintas) == 3:
                trios["-".join(distintas)].append(iso)
            else:
                repetidas_3 += 1
        else:
            dias_2 += 1
            if len(distintas) == 2:
                parejas["-".join(distintas)].append(iso)
            else:
                repetidas_2 += 1

    return {
        "dias_3": dias_3,
        "dias_2": dias_2,
        "dias_3_con_repetidas": repetidas_3,
        "dias_2_con_repetidas": repetidas_2,
        "distribucion": {k: dict(v) for k, v in distribucion.items()},
        "trios": [{"c": c, "f": f} for c, f in trios.items()],
        "parejas": [{"c": c, "f": f} for c, f in parejas.items()],
    }