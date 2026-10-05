from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, String, Text

from database import Base


class Jugada3(Base):
    __tablename__ = "jugadas_3"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=True)
    numeros = Column(Text, nullable=False)           # JSON: ["123", "456", ...]
    apuesta = Column(Float, default=0)
    multiplicador = Column(Float, default=0)
    encime = Column(Float, default=0)
    creada_en = Column(DateTime, default=datetime.utcnow)
    fecha_corte = Column(Date, nullable=True)
    estado = Column(String, default="pendiente")     # pendiente | evaluada
    vista = Column(Boolean, default=False)
    fecha_desde = Column(Date, nullable=True)
    fecha_hasta = Column(Date, nullable=True)
    dias_evaluados = Column(Integer, default=0)
    aciertos = Column(Text, default="[]")            # JSON: [{numero, fecha, loterias}]
    costo = Column(Float, default=0)
    premio = Column(Float, default=0)