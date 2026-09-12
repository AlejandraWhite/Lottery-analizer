from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaSantanderScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería de Santander"
    slug_url = "loteria-de-santander"


if __name__ == "__main__":
    r = LoteriaSantanderScraper().obtener_ultimo_resultado(contexto=None)
    print(r)