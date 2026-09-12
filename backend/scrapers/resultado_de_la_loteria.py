"""
Scraper genérico para loterías publicadas en resultadodelaloteria.com.

Ese sitio (de terceros, no oficial) publica el resultado de cada lotería
en una URL fija por lotería, con el mismo patrón de texto en todas:

    "El número ganador de Lotería de Manizales sorteo 4972 del
     miércoles 9 de septiembre de 2026 fue el 4628 serie 163 y quinta 3."

Confirmado igual para Meta y Manizales; por su menú de navegación,
también cubre: Valle, Risaralda, Santander, Cundinamarca, Huila, Tolima,
Boyacá, Cauca, Quindío, Cruz Roja y Extra de Colombia. Por eso en vez de
escribir un scraper Playwright distinto para cada una, esta clase
genérica sirve para todas las que compartan ese patrón — solo hace
falta el nombre de la lotería (tal cual aparece en la frase) y el slug
de la URL.

Es requests + bs4 (no Playwright): esta página no tiene protección
anti-bot ni depende de JS renderizado, así que es más simple y rápido
usarla directo, aunque el resto del proyecto haya decidido Playwright
para los sitios que sí lo necesitan (Medellín, o el oficial de Meta que
bloquea requests). Cada subclase sigue implementando la interfaz de
LoteriaScraper (recibe "contexto" por consistencia con el orquestador,
pero lo ignora).

NOTA: si resultadodelaloteria.com cambia la redacción de esa frase, se
rompe para TODAS las loterías que usen esta base a la vez — a cambio de
esa fragilidad compartida, se gana no mantener 12 parsers casi
idénticos. Si prefieres aislar el riesgo, cada lotería puede volver a
tener su propio scraper (como Valle contra el sitio oficial).
"""

import re
from datetime import date
from typing import List, Optional

import requests
from bs4 import BeautifulSoup

from .base import LoteriaScraper, ResultadoScrapeado

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}


def _patron_resultado(nombre_loteria: str) -> re.Pattern:
    """
    Arma el regex para una lotería específica. El nombre debe coincidir
    con el que usa resultadodelaloteria.com en su frase ("Lotería de
    Manizales", "Lotería del Meta", "Lotería del Valle", etc.) — se
    escapa por si tiene caracteres especiales de regex (no debería, pero
    por seguridad).
    """
    nombre_escapado = re.escape(nombre_loteria)
    return re.compile(
        rf"{nombre_escapado}\s+sorteo\s+(?P<sorteo>\d+)\s+del\s+\S+\s+"
        r"(?P<dia>\d{1,2})\s+de\s+(?P<mes>[a-záéíóúñ]+)\s+de\s+(?P<anio>\d{4})\s+"
        r"fue\s+el\s+(?P<numero>\d{3,4})",
        re.IGNORECASE,
    )


def _parsear_texto(texto: str, nombre_loteria: str) -> Optional[ResultadoScrapeado]:
    """Aislado del fetch para poder testear con texto de fixture."""
    patron = _patron_resultado(nombre_loteria)
    m = patron.search(texto)
    if not m:
        return None

    mes = MESES.get(m.group("mes").strip().lower())
    if not mes:
        return None

    fecha = date(int(m.group("anio")), mes, int(m.group("dia")))

    return ResultadoScrapeado(
        loteria=nombre_loteria,
        fecha=fecha,
        numero_completo=m.group("numero"),
        sorteo=m.group("sorteo"),
    )


_PATRON_FECHA_TABLA = re.compile(
    r"(?P<dia>\d{1,2})\s+de\s+(?P<mes>[a-záéíóúñ]+)\s+de\s+(?P<anio>\d{4})",
    re.IGNORECASE,
)


class ResultadoDeLaLoteriaScraper(LoteriaScraper):
    """
    Clase base parametrizable: cada lotería concreta solo define
    nombre_loteria y slug_url (el nombre_loteria debe coincidir EXACTO
    con como aparece en la frase del sitio, ej "Lotería de Manizales").
    """

    slug_url: str = ""  # ej "loteria-de-manizales"

    @property
    def url(self) -> str:
        return f"https://resultadodelaloteria.com/colombia/{self.slug_url}"

    def obtener_ultimo_resultado(self, contexto=None) -> Optional[ResultadoScrapeado]:
        # "contexto" (BrowserContext) se recibe por consistencia con el
        # orquestador pero se ignora: este sitio no necesita Playwright.
        resp = requests.get(self.url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "lxml")  # .content (bytes), no .text
        texto = soup.get_text(separator="\n")
        return _parsear_texto(texto, self.nombre_loteria)

    def obtener_historico(self, contexto=None, max_sorteos: Optional[int] = None) -> List[ResultadoScrapeado]:
        """
        Trae el histórico reciente desde la tabla "Sorteos más recientes"
        de la misma página del último resultado (normalmente cubre varios
        meses hacia atrás). Incluye también el resultado más reciente.
        max_sorteos: si se pasa, corta a los N más recientes.
        """
        resp = requests.get(self.url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "lxml")

        resultados: List[ResultadoScrapeado] = []

        texto_completo = soup.get_text(separator="\n")
        mas_reciente = _parsear_texto(texto_completo, self.nombre_loteria)
        if mas_reciente:
            resultados.append(mas_reciente)

        encabezado = soup.find(
            lambda t: t.name in ("h2", "h3") and "Sorteos más recientes" in t.get_text()
        )
        tabla = encabezado.find_next("table") if encabezado else None

        if tabla:
            for fila in tabla.find_all("tr")[1:]:  # saltar encabezado
                celdas = fila.find_all("td")
                if len(celdas) < 3:
                    continue
                m_fecha = _PATRON_FECHA_TABLA.search(celdas[1].get_text(" ", strip=True))
                if not m_fecha:
                    continue
                mes = MESES.get(m_fecha.group("mes").strip().lower())
                if not mes:
                    continue
                fecha = date(int(m_fecha.group("anio")), mes, int(m_fecha.group("dia")))

                negrita = celdas[2].find("strong") or celdas[2].find("b")
                numero_texto = negrita.get_text(strip=True) if negrita else None
                if not numero_texto or not numero_texto.isdigit():
                    continue

                resultados.append(ResultadoScrapeado(
                    loteria=self.nombre_loteria,
                    fecha=fecha,
                    numero_completo=numero_texto,
                    sorteo=celdas[0].get_text(strip=True) or None,
                ))

        return resultados[:max_sorteos] if max_sorteos else resultados