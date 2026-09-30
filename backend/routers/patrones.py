"""
routers/patrones.py

Registrar en main.py, junto a los demás routers:
    from routers import patrones
    app.include_router(patrones.router)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from services import patrones as servicio

router = APIRouter(prefix="/patrones", tags=["patrones"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/intervalos")
def intervalos(cifras: int = 2, permutante: bool = False, db: Session = Depends(get_db)):
    try:
        return servicio.intervalos(db, cifras, permutante)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dia-semana")
def dia_semana(cifras: int = 2, permutante: bool = False, db: Session = Depends(get_db)):
    try:
        return servicio.por_dia_semana(db, cifras, permutante)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/posicion")
def posicion(db: Session = Depends(get_db)):
    return servicio.por_posicion(db)


@router.get("/recomendados")
def recomendados(dia: int | None = None, db: Session = Depends(get_db)):
    """dia: 0 = lunes ... 6 = domingo. Si no se envía, usa el día de hoy del servidor."""
    try:
        return servicio.recomendados(db, dia)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/prueba-historica")
def prueba_historica(cifras: int = 2, db: Session = Depends(get_db)):
    try:
        return servicio.prueba_historica(db, cifras)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))