# scrapers/loteria_boyaca.py
from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaBoyacaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería de Boyacá"
    slug_url = "loteria-de-boyaca"


if __name__ == "__main__":
    r = LoteriaBoyacaScraper().obtener_ultimo_resultado(contexto=None)
    print(r)