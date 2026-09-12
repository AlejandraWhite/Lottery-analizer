# scrapers/loteria_cundinamarca.py
from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper

class LoteriaCundinamarcaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería de Cundinamarca"
    slug_url = "loteria-de-cundinamarca"

if __name__ == "__main__":
    r = LoteriaCundinamarcaScraper().obtener_ultimo_resultado(contexto=None)
    print(r)