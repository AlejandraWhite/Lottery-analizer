from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship

from database import Base
from datetime import datetime


class Archivo(Base):
    __tablename__ = "archivos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    nombre_original = Column(String(255), nullable=False)
    fecha_creacion = Column(DateTime, nullable=False)
    fecha_actualizacion = Column(DateTime, nullable=False)

    resultados = relationship(
        "Resultado",
        back_populates="archivo",
        cascade="all, delete-orphan"
    )


class ContadorTerminacion(Base):
    __tablename__ = "contadores_terminacion"

    terminacion = Column(String(2), primary_key=True)
    cantidad = Column(Integer, nullable=False, default=0)


class Resultado(Base):
    __tablename__ = "resultados"

    id = Column(Integer, primary_key=True, index=True)

    archivo_id = Column(
        Integer,
        ForeignKey("archivos.id"),
        nullable=False
    )

    fecha = Column(Date, nullable=False)
    numero = Column(String(2), nullable=False)
    numero_completo = Column(String(4), nullable=False)
    loteria = Column(String(100), nullable=False)
    creado_en = Column(DateTime, nullable=False, default=datetime.now)

    archivo = relationship(
        "Archivo",
        back_populates="resultados"
    )


class EstadoTerminacion(Base):
    __tablename__ = "estados_terminacion"

    terminacion = Column(String(2), primary_key=True)

    ultima_id = Column(Integer, ForeignKey("resultados.id"), nullable=True)
    penultima_id = Column(Integer, ForeignKey("resultados.id"), nullable=True)
    tercera_id = Column(Integer, ForeignKey("resultados.id"), nullable=True)
    antepenultima_id = Column(Integer, ForeignKey("resultados.id"), nullable=True)  # NUEVO

    tercera_actualizado_en = Column(DateTime, nullable=True)

    ultima = relationship("Resultado", foreign_keys=[ultima_id])
    penultima = relationship("Resultado", foreign_keys=[penultima_id])
    tercera = relationship("Resultado", foreign_keys=[tercera_id])
    antepenultima = relationship("Resultado", foreign_keys=[antepenultima_id])  # NUEVO