"""
Registro central. A medida que completes cada scraper (usando
_plantilla_playwright.py como base), impórtalo aquí y agrégalo a
SCRAPERS_ACTIVOS.

Bogotá y Medellín tienen dataset propio en datos.gov.co
(sync_datasets_individuales.py) — PERO revisa Medellín pronto: su
data_updated_at está en 2026-06-02 (~3 meses de atraso a la fecha),
la misma señal que tenía Santander antes de confirmarse que estaba
desactualizado. Si se confirma lo mismo, Medellín también vuelve acá.

Las 12 loterías restantes se decidió scrapearlas todas con Playwright
(no requests+bs4) porque varias necesitan JS renderizado (Medellín) o
tienen protección anti-bot básica (Meta) — un solo patrón para las 12
es más simple que mantener dos técnicas distintas.
"""

from .loteria_valle import LoteriaValleScraper

SCRAPERS_ACTIVOS = [
    LoteriaValleScraper(),
    # LoteriaMetaScraper(),          # pendiente — bot-detection, probar Playwright
    # LoteriaManizalesScraper(),     # pendiente
    # LoteriaCundinamarcaScraper(),  # pendiente — descartado el dataset (era de premios pagados, no número)
    # LotecruzScraper(),             # pendiente
    # LoteriaHuilaScraper(),         # pendiente
    # LoteriaTolimaScraper(),        # pendiente — descartado el dataset (solo cubre 2022)
    # LoteriaBoyacaScraper(),        # pendiente
    # LoteriaCaucaScraper(),         # pendiente
    # LoteriaSantanderScraper(),     # pendiente — dataset confirmado obsoleto (sorteo 5060 vs 5085 real)
    # LoteriaRisaraldaScraper(),     # pendiente
    # LoteriaQuindioScraper(),       # pendiente
    # ExtraDeColombiaScraper(),      # pendiente
]

# Cubiertas por dataset individual en datos.gov.co (sync_datasets_individuales.py):
# Lotería de Bogotá, Lotería de Medellín (esta última: VERIFICAR pronto, ver nota arriba)

SCRAPERS_PENDIENTES = [
    "loteriadelmeta.gov.co (bot-detection con requests; probar Playwright headless)",
    "loteriademanizales.com",
    "loteriadecundinamarca.com.co",
    "lotecruz.org.co",
    "loteriadelhuila.com",
    "loteriadeltolima.com",
    "loteriadeboyaca.gov.co",
    "loteriadelcauca.gov.co",
    "loteriasantander.gov.co (dataset datos.gov.co confirmado obsoleto)",
    "loteriadelrisaralda.com",
    "loteriaquindio.com.co",
    "extradecolombia.com.co",
]