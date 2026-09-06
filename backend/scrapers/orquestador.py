"""
Corre todos los scrapers activos y guarda los resultados nuevos en la BD,
siguiendo el mismo patrón de dedup que ya usas en
sincronizar_desde_api_datos_gov (fecha + numero_completo + loteria).

Se puede correr con el mismo scheduler (APScheduler) que ya tienes a las
7am para la sincronización de datos.gov.co — son complementarios, no
excluyentes.

Se lanza UN SOLO navegador Playwright (headless) y se comparte entre los
12 scrapers vía BrowserContext — evita abrir/cerrar un navegador por
cada sitio (mucho más lento). Cada scraper abre y cierra su propia
pestaña (page) dentro de ese contexto.

Ajusta los imports de "tu_app.models" / "tu_app.db" a los nombres reales
de tu proyecto — los dejé genéricos porque no tengo tu módulo de modelos.
"""

import logging
from typing import List

from playwright.sync_api import sync_playwright
from sqlalchemy.orm import Session

from .base import ResultadoScrapeado, USER_AGENT_NAVEGADOR
from .registry import SCRAPERS_ACTIVOS

# --- AJUSTAR a tu proyecto real ---
from modelos import Resultado                       # tu modelo SQLAlchemy
from utilidades import (                            # tus helpers existentes
    obtener_o_crear_archivo_sincronizacion,
    normalizar_numero_completo,
    obtener_ultimas_dos,
    registrar_nuevo_resultado,
)
# -----------------------------------

logger = logging.getLogger("scrapers")


def _ejecutar_todos_los_scrapers() -> List[ResultadoScrapeado]:
    """Lanza un único navegador y corre los 12 scrapers contra él."""
    resultados = []
    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        try:
            contexto = navegador.new_context(user_agent=USER_AGENT_NAVEGADOR, locale="es-CO")
            for scraper in SCRAPERS_ACTIVOS:
                resultado = scraper.ejecutar_seguro(contexto)
                if resultado is None:
                    logger.warning(
                        "Sin resultado para %s (revisar scraper o sitio caído)",
                        scraper.nombre_loteria,
                    )
                    continue
                resultados.append(resultado)
        finally:
            navegador.close()
    return resultados


def sincronizar_desde_scraping(db: Session) -> List[Resultado]:
    archivo = obtener_o_crear_archivo_sincronizacion(db)
    nuevos: List[Resultado] = []

    for resultado_scrapeado in _ejecutar_todos_los_scrapers():
        numero_completo = normalizar_numero_completo(resultado_scrapeado.numero_completo)

        ya_existe = (
            db.query(Resultado)
            .filter(
                Resultado.fecha == resultado_scrapeado.fecha,
                Resultado.numero_completo == numero_completo,
                Resultado.loteria == resultado_scrapeado.loteria,
            )
            .first()
        )
        if ya_existe:
            continue

        nuevo = Resultado(
            archivo_id=archivo.id,
            fecha=resultado_scrapeado.fecha,
            numero=obtener_ultimas_dos(numero_completo),
            numero_completo=numero_completo,
            loteria=resultado_scrapeado.loteria,
        )
        db.add(nuevo)
        db.flush()
        registrar_nuevo_resultado(db, nuevo)
        nuevos.append(nuevo)

    db.commit()
    for r in nuevos:
        db.refresh(r)

    return nuevos