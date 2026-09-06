"""
Scraper de loteriadelmeta.gov.co

Este sitio SÍ trae el número del último sorteo directo en el HTML de la
portada (no depende de JavaScript), así que requests + bs4 es suficiente.
Estructura observada en la portada (sept 2026):

    ## Sorteo 4864
    Septiembre 02 2026
    ## PREMIO MAYOR
    ## Número
    9  1  6  4        <- cada dígito en su propio bloque de texto
    ## Serie
    1  1  3            <- se ignora, no se necesita

NOTA: si Lotería del Valle rediseña la portada, esto puede dejar de
matchear. La función _parsear_texto() está separada del fetch justamente
para poder testearla con HTML guardado en un fixture sin hacer requests.
"""

import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from .base import LoteriaScraper, ResultadoScrapeado

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}


def _parsear_fecha_es(texto: str) -> Optional[date]:
    """'Septiembre 02 2026' -> date(2026, 9, 2)"""
    m = re.search(r"([A-Za-zñÑ]+)\s+(\d{1,2})\s+(\d{4})", texto)
    if not m:
        return None
    mes = MESES.get(m.group(1).strip().lower())
    if not mes:
        return None
    return date(int(m.group(3)), mes, int(m.group(2)))


def _parsear_texto(texto: str) -> Optional[ResultadoScrapeado]:
    """
    Recibe el texto plano de la página (BeautifulSoup.get_text) y extrae
    sorteo, fecha, número y serie. Aislado del fetch para poder testear.
    """
    sorteo_m = re.search(r"Sorteo\s+(\d+)", texto)
    fecha_m = re.search(r"([A-Za-zñÑ]+\s+\d{1,2}\s+\d{4})", texto)
    # Entre "Número" y "Serie" puede haber marcado markdown ("## ") o
    # etiquetas HTML de por medio, por eso el patrón es permisivo (.*?) y
    # luego se filtran solo los dígitos. La serie se ignora del todo — no
    # se necesita, solo el número de 4 cifras.
    numero_m = re.search(r"N[uú]mero(.*?)Serie", texto, re.DOTALL)

    if not (fecha_m and numero_m):
        return None

    fecha = _parsear_fecha_es(fecha_m.group(1))
    if not fecha:
        return None

    numero_completo = "".join(re.findall(r"\d", numero_m.group(1)))

    if not numero_completo:
        return None

    return ResultadoScrapeado(
        loteria="Lotería del Valle",
        fecha=fecha,
        numero_completo=numero_completo,
        sorteo=sorteo_m.group(1) if sorteo_m else None,
    )


class LoteriaValleScraper(LoteriaScraper):
    nombre_loteria = "Lotería del Valle"
    url = "https://loteriadelvalle.com"

    def obtener_ultimo_resultado(self, contexto=None) -> Optional[ResultadoScrapeado]:
        # Este sitio es estático — no necesita el navegador Playwright
        # (parámetro "contexto" recibido pero ignorado, solo por cumplir
        # la interfaz común). Se deja con requests porque ya funciona y
        # es más rápido que abrir una pestaña de navegador para esto.
        resp = requests.get(self.url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")
        # separator="\n" para que cada bloque/dígito quede en su propia "línea",
        # igual que en el HTML fuente
        texto = soup.get_text(separator="\n")
        return _parsear_texto(texto)


if __name__ == "__main__":
    r = LoteriaValleScraper().obtener_ultimo_resultado(contexto=None)
    print(r)