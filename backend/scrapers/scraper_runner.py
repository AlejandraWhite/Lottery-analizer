# scraper_runner.py

from sqlalchemy.orm import Session

from services.analisis import registrar_nuevo_resultado
from services.miercoles import registrar_resultado_scraping_miercoles
from services.viernes import registrar_resultado_scraping_viernes
import unicodedata

LOTERIAS_MIERCOLES = ("Meta", "Valle", "Manizales")
LOTERIAS_VIERNES = ("Risaralda", "Medellin", "Santander")



def _sin_acentos(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    ).lower()

MAPA_LOTERIA_CORTA = {
    "meta": "Meta",
    "valle": "Valle",
    "manizales": "Manizales",
    "risaralda": "Risaralda",
    "medellin": "Medellin",
    "santander": "Santander",
}

def _loteria_corta(nombre_completo: str) -> Optional[str]:
    normalizado = _sin_acentos(nombre_completo)
    for clave, corta in MAPA_LOTERIA_CORTA.items():
        if clave in normalizado:
            return corta
    return None


def _repartir_a_pantalla_del_dia(db: Session, loteria_completa: str, fecha, numero_completo: str):
    corta = _loteria_corta(loteria_completa)
    if corta is None:
        return  # lotería que no tiene pantalla de día (Cundinamarca, Huila, etc.)

    terminacion = numero_completo[-2:]
    if corta in LOTERIAS_MIERCOLES:
        registrar_resultado_scraping_miercoles(db, corta, fecha, terminacion)
    elif corta in LOTERIAS_VIERNES:
        registrar_resultado_scraping_viernes(db, corta, fecha, terminacion)