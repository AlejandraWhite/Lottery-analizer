from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaHuilaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería del Huila"
    slug_url = "loteria-del-huila"


if __name__ == "__main__":
    r = LoteriaHuilaScraper().obtener_ultimo_resultado(contexto=None)
    print(r)