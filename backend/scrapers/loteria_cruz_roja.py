from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaCruzRojaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería de la Cruz Roja"
    slug_url = "loteria-de-la-cruz-roja"


if __name__ == "__main__":
    r = LoteriaCruzRojaScraper().obtener_ultimo_resultado(contexto=None)
    print(r)