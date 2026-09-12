"""
Busca filas duplicadas en Resultado: misma fecha + numero_completo +
loteria pero distinto id. Si esto imprime algo, esa es la causa de que
'última' haya terminado coincidiendo con 'penúltima'/'tercera' — cada
fila duplicada disparó registrar_nuevo_resultado una vez de más.

Solo reporta, no borra nada todavía.
"""

from sqlalchemy import func

from database import SessionLocal
from models import Resultado


def buscar_duplicados():
    db = SessionLocal()
    try:
        grupos = (
            db.query(
                Resultado.fecha,
                Resultado.numero_completo,
                Resultado.loteria,
                func.count(Resultado.id).label("cantidad"),
            )
            .group_by(Resultado.fecha, Resultado.numero_completo, Resultado.loteria)
            .having(func.count(Resultado.id) > 1)
            .all()
        )

        if not grupos:
            print("No hay duplicados exactos (fecha+numero_completo+loteria).")
            return

        print(f"Encontrados {len(grupos)} grupos duplicados:")
        for fecha, numero_completo, loteria, cantidad in grupos:
            ids = [
                r.id for r in db.query(Resultado).filter(
                    Resultado.fecha == fecha,
                    Resultado.numero_completo == numero_completo,
                    Resultado.loteria == loteria,
                ).all()
            ]
            print(f"  {fecha} {numero_completo} {loteria}: {cantidad} filas, ids={ids}")
    finally:
        db.close()


if __name__ == "__main__":
    buscar_duplicados()