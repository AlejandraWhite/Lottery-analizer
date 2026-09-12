# scrapers/loteria_cauca.py
from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaCaucaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería del Cauca"
    slug_url = "loteria-del-cauca"


if __name__ == "__main__":
    r = LoteriaCaucaScraper().obtener_ultimo_resultado(contexto=None)
    print(r)