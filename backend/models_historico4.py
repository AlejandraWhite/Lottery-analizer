from sqlalchemy import Column, Integer, String, Date, JSON, Text

from database import Base  # ajusta si tu Base vive en otro módulo


class ResultadoHistorico4(Base):
    """
    Histórico de números de 4 cifras (Excel de ~20 años, desde 2006).

    Nada del Excel se descarta: si una celda trae algo raro (fecha con
    texto pegado, número con asterisco, fila sin número...) la fila se
    guarda igual y la rareza queda anotada en `observacion`.

    - fecha / numero vienen de las columnas B y C. Pueden ser NULL solo
      cuando el Excel realmente no permite saberlos (ver observacion).
    - columnas_extra guarda tal cual lo que haya en D..J.
    - Los números que caen después (manual / scraping / API) entran con
      fila_excel = NULL y columnas_extra = NULL.
    """

    __tablename__ = "resultados_historico_4cifras"

    id = Column(Integer, primary_key=True, index=True)
    fila_excel = Column(Integer, nullable=True)
    nombre_archivo = Column(String, nullable=True)
    fecha = Column(Date, nullable=True, index=True)
    numero = Column(String(20), nullable=True, index=True)
    loteria = Column(String, nullable=True)
    columnas_extra = Column(JSON(none_as_null=True), nullable=True)
    observacion = Column(Text, nullable=True)