from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


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


class Resultado(Base):
    __tablename__ = "resultados"

    id = Column(Integer, primary_key=True, index=True)

    archivo_id = Column(
        Integer,
        ForeignKey("archivos.id"),
        nullable=False
    )

    fecha = Column(DateTime, nullable=False)
    numero = Column(String(2), nullable=False)
    loteria = Column(String(100), nullable=False)

    archivo = relationship(
        "Archivo",
        back_populates="resultados"
    )