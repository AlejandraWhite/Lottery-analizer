"""
PLANTILLA — copia este archivo como scrapers/loteria_<nombre>.py y complétalo
para cada uno de los 12 sitios pendientes (ver registry.py -> SCRAPERS_PENDIENTES).

Instalación (una sola vez):
    pip install playwright
    playwright install chromium     # descarga el navegador, ~150MB

Flujo para completar cada sitio:

1. Abre el sitio en Chrome normal, click derecho -> Inspeccionar sobre el
   número del último resultado. Identifica un selector CSS que lo agarre
   (una clase, un id, o al menos un contenedor padre reconocible).

2. Reemplaza SELECTOR_NUMERO abajo con eso. Si no hay un selector limpio,
   usa el plan B: leer todo el texto de la página (page.inner_text("body"))
   y aplicar un regex, como se hizo en loteria_valle.py — funciona pero es
   más frágil ante rediseños del sitio.

3. Corre el scraper solo (python -m scrapers.loteria_XXX) para probarlo
   antes de agregarlo a SCRAPERS_ACTIVOS en registry.py.

4. Si el sitio tiene protección anti-bot fuerte (Cloudflare "verificando
   que eres humano", CAPTCHA): Playwright headless a veces no basta.
   Antes de rendirte, prueba con headless=False primero para ver qué
   pantalla te muestra el sitio, y si lo pide, considera:
   - Aumentar el timeout / esperar a un selector específico en vez de
     "networkidle" (algunos WAF meten un retraso artificial).
   - playwright-stealth (librería) para disimular las señales típicas
     de automatización.
   - Como último recurso, esa lotería queda "manual" (alguien la revisa
     y la carga a mano) — es un caso raro pero puede pasar.
"""

import re
from datetime import date
from typing import Optional

from playwright.sync_api import BrowserContext

from .base import LoteriaScraper, ResultadoScrapeado

SELECTOR_NUMERO = ".resultado-ultimo-sorteo"   # <- TODO: reemplazar por el selector real


class LoteriaXXXScraper(LoteriaScraper):
    nombre_loteria = "Lotería de Meta"          # <- cambiar
    url = "https://loteriadelmeta.gov.co"        # <- cambiar

    def obtener_ultimo_resultado(self, contexto: BrowserContext) -> Optional[ResultadoScrapeado]:
        page = contexto.new_page()
        try:
            page.goto(self.url, wait_until="networkidle", timeout=20000)

            # --- Plan A: selector directo (preferido, más robusto) ---
            elemento = page.locator(SELECTOR_NUMERO).first
            if elemento.count() == 0:
                return None
            texto_numero = elemento.inner_text()

            numero_completo = "".join(re.findall(r"\d", texto_numero))
            if not numero_completo:
                return None

            return ResultadoScrapeado(
                loteria=self.nombre_loteria,
                fecha=date.today(),   # TODO: extraer la fecha real del sorteo
                numero_completo=numero_completo,
            )
        finally:
            page.close()


if __name__ == "__main__":
    from playwright.sync_api import sync_playwright
    from .base import USER_AGENT_NAVEGADOR

    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        contexto = navegador.new_context(user_agent=USER_AGENT_NAVEGADOR, locale="es-CO")
        print(LoteriaXXXScraper().obtener_ultimo_resultado(contexto))
        navegador.close()