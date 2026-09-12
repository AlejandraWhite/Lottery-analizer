from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class ArchivoViernes(Base):
    __tablename__ = "archivos_viernes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    nombre_original = Column(String(255), nullable=False)
    fecha_creacion = Column(DateTime, nullable=False)
    fecha_actualizacion = Column(DateTime, nullable=False)

    resultados = relationship(
        "ResultadoViernes",
        back_populates="archivo",
        cascade="all, delete-orphan",
    )


class ResultadoViernes(Base):
    __tablename__ = "resultados_viernes"

    id = Column(Integer, primary_key=True, index=True)
    archivo_id = Column(Integer, ForeignKey("archivos_viernes.id"), nullable=False)

    fecha = Column(Date, nullable=False)
    numero = Column(String(2), nullable=False)      # últimas 2 cifras
    loteria = Column(String(50), nullable=False)     # "Risaralda" | "Medellin" | "Santander"
    creado_en = Column(DateTime, nullable=False, default=datetime.now)

    # cantidad que trae el excel en la columna correspondiente (N/T/Z),
    # si viene vacía se calcula incrementando el contador anterior
    cantidad = Column(Integer, nullable=True)

    archivo = relationship("ArchivoViernes", back_populates="resultados")


class ContadorTerminacionViernes(Base):
    __tablename__ = "contadores_terminacion_viernes"

    loteria = Column(String(50), primary_key=True)
    terminacion = Column(String(2), primary_key=True)
    cantidad = Column(Integer, nullable=False, default=0)


class EstadoTerminacionViernes(Base):
    __tablename__ = "estados_terminacion_viernes"

    loteria = Column(String(50), primary_key=True)
    terminacion = Column(String(2), primary_key=True)

    ultima_id = Column(Integer, ForeignKey("resultados_viernes.id"), nullable=True)
    penultima_id = Column(Integer, ForeignKey("resultados_viernes.id"), nullable=True)
    antepenultima_id = Column(Integer, ForeignKey("resultados_viernes.id"), nullable=True)

    ultima = relationship("ResultadoViernes", foreign_keys=[ultima_id])
    penultima = relationship("ResultadoViernes", foreign_keys=[penultima_id])
    antepenultima = relationship("ResultadoViernes", foreign_keys=[antepenultima_id])