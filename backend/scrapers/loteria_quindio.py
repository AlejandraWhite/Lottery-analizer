# scrapers/loteria_quindio.py
from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaQuindioScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería del Quindío"
    slug_url = "loteria-del-quindio"


if __name__ == "__main__":
    r = LoteriaQuindioScraper().obtener_ultimo_resultado(contexto=None)
    print(r)