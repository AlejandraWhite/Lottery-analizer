from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaManizalesScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería de Manizales"
    slug_url = "loteria-de-manizales"


if __name__ == "__main__":
    r = LoteriaManizalesScraper().obtener_ultimo_resultado(contexto=None)
    print(r)