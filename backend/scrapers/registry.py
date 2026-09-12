"""
Registro central de scrapers activos.

Las 13 loterías por resultadodelaloteria.com (Valle, Meta, Manizales,
Risaralda, Santander, Medellín, Cundinamarca, Huila, Tolima, Boyacá,
Cauca, Quindío, Cruz Roja) quedaron confirmadas con el mismo patrón de
texto (ver resultado_de_la_loteria.py) — ninguna necesita Playwright.

Extra de Colombia se deja FUERA a propósito: no tiene día de sorteo
fijo (irregular, generalmente el último sábado del mes), así que no
encaja con el filtro por día del orquestador. Si se necesita más
adelante, se puede correr aparte sin dias_sorteo.

Lotería de Bogotá NO tiene scraper: sigue cubierta por su dataset
individual en datos.gov.co (kntg-ytfw).
"""

from .loteria_valle import LoteriaValleScraper
from .loteria_meta import LoteriaMetaScraper
from .loteria_manizales import LoteriaManizalesScraper
from .loteria_risaralda import LoteriaRisaraldaScraper
from .loteria_santander import LoteriaSantanderScraper
from .loteria_medellin import LoteriaMedellinScraper
from .loteria_cundinamarca import LoteriaCundinamarcaScraper
from .loteria_huila import LoteriaHuilaScraper
from .loteria_tolima import LoteriaTolimaScraper
from .loteria_boyaca import LoteriaBoyacaScraper
from .loteria_cauca import LoteriaCaucaScraper
from .loteria_quindio import LoteriaQuindioScraper
from .loteria_cruz_roja import LoteriaCruzRojaScraper

SCRAPERS_ACTIVOS = [
    # Miércoles
    LoteriaMetaScraper(),
    LoteriaValleScraper(),
    LoteriaManizalesScraper(),
    # Viernes
    LoteriaRisaraldaScraper(),
    LoteriaMedellinScraper(),
    LoteriaSantanderScraper(),
    # Lunes
    LoteriaTolimaScraper(),
    LoteriaCundinamarcaScraper(),
    # Martes
    LoteriaHuilaScraper(),
    LoteriaCruzRojaScraper(),
    # Jueves
    LoteriaQuindioScraper(),
    # Sábado
    LoteriaBoyacaScraper(),
    LoteriaCaucaScraper(),
]

# Cubierta por dataset individual en datos.gov.co (sync_datasets_individuales.py):
# Lotería de Bogotá (kntg-ytfw)

# Dejada fuera a propósito (ver nota arriba):
# Extra de Colombia — sin día de sorteo fijo