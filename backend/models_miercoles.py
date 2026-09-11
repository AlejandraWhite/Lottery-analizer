from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class ArchivoMiercoles(Base):
    __tablename__ = "archivos_miercoles"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    nombre_original = Column(String(255), nullable=False)
    fecha_creacion = Column(DateTime, nullable=False)
    fecha_actualizacion = Column(DateTime, nullable=False)

    resultados = relationship(
        "ResultadoMiercoles",
        back_populates="archivo",
        cascade="all, delete-orphan",
    )


class ResultadoMiercoles(Base):
    __tablename__ = "resultados_miercoles"

    id = Column(Integer, primary_key=True, index=True)
    archivo_id = Column(Integer, ForeignKey("archivos_miercoles.id"), nullable=False)

    fecha = Column(Date, nullable=False)
    numero = Column(String(2), nullable=False)      # últimas 2 cifras
    loteria = Column(String(50), nullable=False)     # "Meta" | "Valle" | "Manizales"
    creado_en = Column(DateTime, nullable=False, default=datetime.now)

    # --- nuevas, solo se llenan para Meta ---
    cantidad = Column(Integer, nullable=True)
    fecha_pen = Column(Date, nullable=True)
    numero_pen = Column(String(2), nullable=True)

    archivo = relationship("ArchivoMiercoles", back_populates="resultados")


class ContadorTerminacionMiercoles(Base):
    __tablename__ = "contadores_terminacion_miercoles"

    loteria = Column(String(50), primary_key=True)
    terminacion = Column(String(2), primary_key=True)
    cantidad = Column(Integer, nullable=False, default=0)

class EstadoTerminacionMiercoles(Base):
    __tablename__ = "estados_terminacion_miercoles"

    loteria = Column(String(50), primary_key=True)
    terminacion = Column(String(2), primary_key=True)

    ultima_id = Column(Integer, ForeignKey("resultados_miercoles.id"), nullable=True)
    penultima_id = Column(Integer, ForeignKey("resultados_miercoles.id"), nullable=True)
    antepenultima_id = Column(Integer, ForeignKey("resultados_miercoles.id"), nullable=True)  # <-- nuevo

    ultima = relationship("ResultadoMiercoles", foreign_keys=[ultima_id])
    penultima = relationship("ResultadoMiercoles", foreign_keys=[penultima_id])
    antepenultima = relationship("ResultadoMiercoles", foreign_keys=[antepenultima_id])  # <-- nuevo


    