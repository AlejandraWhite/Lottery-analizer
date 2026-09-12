# scrapers/loteria_medellin.py
from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaMedellinScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería de Medellín"
    slug_url = "loteria-de-medellin"


if __name__ == "__main__":
    r = LoteriaMedellinScraper().obtener_ultimo_resultado(contexto=None)
    print(r)