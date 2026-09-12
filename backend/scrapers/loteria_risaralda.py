from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaRisaraldaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería de Risaralda"
    slug_url = "loteria-de-risaralda"


if __name__ == "__main__":
    r = LoteriaRisaraldaScraper().obtener_ultimo_resultado(contexto=None)
    print(r)