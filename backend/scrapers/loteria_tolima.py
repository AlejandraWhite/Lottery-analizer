from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaTolimaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería del Tolima"
    slug_url = "loteria-del-tolima"


if __name__ == "__main__":
    r = LoteriaTolimaScraper().obtener_ultimo_resultado(contexto=None)
    print(r)