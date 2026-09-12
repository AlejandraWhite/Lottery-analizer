from sqlalchemy import Column, Integer, DateTime, Text
from datetime import datetime

from database import Base


class EstadoUltimaCorridaScraping(Base):
    """
    Guarda un registro por cada corrida del orquestador de scrapers
    (manual o programada). El frontend consulta la más reciente al
    entrar a la app para mostrar qué loterías se actualizaron y cuáles
    no, sin depender de que alguien revise los logs del servidor.
    """
    __tablename__ = "estado_ultima_corrida_scraping"

    id = Column(Integer, primary_key=True, index=True)
    fecha_ejecucion = Column(DateTime, nullable=False, default=datetime.now)

    # Nombres de loterías separados por coma (ej "Lotería del Valle,Lotería del Meta").
    # No se espera que un nombre de lotería contenga comas.
    loterias_ok = Column(Text, nullable=False, default="")
    loterias_fallidas = Column(Text, nullable=False, default="")