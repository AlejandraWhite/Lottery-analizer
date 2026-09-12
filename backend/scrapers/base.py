
"""
Contrato base para los scrapers de loterías.

Cada lotería (Valle, Meta, Boyacá, etc.) implementa su propia subclase de
LoteriaScraper. El orquestador (orquestador.py) no sabe nada de HTML: solo
llama a obtener_ultimo_resultado(contexto) y espera un ResultadoScrapeado
o None.

Esto es intencional: si el HTML de una lotería cambia, o el sitio se cae,
solo se rompe ESA clase. Las otras 11 siguen funcionando.

Por qué Playwright para todos (y no requests+bs4 para "los fáciles"):
- Medellín necesita JS renderizado -> requests no sirve.
- Meta bloqueó requests por bot-detection -> un navegador real (headless)
  suele pasar esa barrera porque no es un fingerprint tan obvio como
  el de la librería requests.
- Mantener un solo patrón para las 12 loterías es más simple que tener
  dos técnicas distintas conviviendo.

El "contexto" (BrowserContext de Playwright) lo crea y cierra UNA vez el
orquestador, compartido entre los 12 scrapers — así no se abre un
navegador nuevo por cada sitio (lento). Cada scraper solo abre su propia
pestaña (page) dentro de ese contexto compartido.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Optional, TYPE_CHECKING
import logging

if TYPE_CHECKING:
    from playwright.sync_api import BrowserContext

logger = logging.getLogger("scrapers")


@dataclass
class ResultadoScrapeado:
    loteria: str            # nombre normalizado, ej "Lotería del Valle"
    fecha: date              # fecha del sorteo
    numero_completo: str     # ej "9164" (con ceros a la izquierda si aplica)
    sorteo: Optional[str] = None   # número de sorteo, si el sitio lo expone
    # Nota: se descarta la serie a propósito — solo se necesita el número de 4 cifras.

    def normalizado(self) -> str:
        """numero_completo siempre con el mismo largo, para comparar/dedupe."""
        return self.numero_completo.zfill(4)


class LoteriaScraper(ABC):
    """Interfaz que debe implementar cada scraper individual."""

    # Sobreescribir en cada subclase
    nombre_loteria: str = "SIN_NOMBRE"
    url: str = ""

    # Días de sorteo en formato ISO:
    # lunes=1 ... domingo=7.
    # None significa que el scraper no tiene un calendario específico
    # definido y, por tanto, puede ejecutarse cualquier día.
    dias_sorteo = None

    def obtener_historico(self, max_sorteos: int = 30):
        """
        Fallback por defecto: si la subclase no tiene una fuente de
        histórico real, devolvemos el último resultado (vía
        obtener_ultimo_resultado) como lista de un solo elemento, para
        que al menos quede sincronizado con lo más reciente. Las
        subclases con fuente de histórico real (ver
        ResultadoDeLaLoteriaScraper) sobreescriben este método.
        """
        try:
            ultimo = self.obtener_ultimo_resultado(contexto=None)
        except Exception:
            logger.exception("Fallo trayendo último resultado de %s (%s)", self.nombre_loteria, self.url)
            return []
        return [ultimo] if ultimo else []

    @abstractmethod
    def obtener_ultimo_resultado(self, contexto: "BrowserContext") -> Optional[ResultadoScrapeado]:
        """
        Recibe un BrowserContext de Playwright ya abierto (compartido entre
        todos los scrapers) y debe devolver el resultado del último sorteo
        publicado, o None si no se pudo obtener (sitio caído, bot-detection
        más agresivo de lo esperado, cambio de HTML, etc). 

        IMPORTANTE: nunca debe lanzar una excepción no controlada — el
        orquestador espera que cada scraper maneje sus propios errores y
        devuelva None en caso de fallo, para no tumbar la corrida completa.
        Cada scraper es responsable de abrir y cerrar su propia página
        (contexto.new_page() / page.close()).
        """
        raise NotImplementedError

    def ejecutar_seguro(self, contexto: "BrowserContext") -> Optional[ResultadoScrapeado]:
        """Wrapper que garantiza que un error en un scraper no rompa el resto."""
        try:
            return self.obtener_ultimo_resultado(contexto)
        except Exception:
            logger.exception("Fallo scrapeando %s (%s)", self.nombre_loteria, self.url)
            return None


# User-Agent "de navegador real" para el contexto de Playwright — aunque
# Playwright ya usa un motor de navegador real, algunos sitios igual miran
# el User-Agent, así que conviene fijarlo explícitamente en vez de dejar
# el default de Playwright (que a veces se identifica como "HeadlessChrome").
USER_AGENT_NAVEGADOR = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

