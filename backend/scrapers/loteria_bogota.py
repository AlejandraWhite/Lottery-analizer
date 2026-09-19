from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaBogotaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería de Bogotá"
    slug_url = "loteria-de-bogota"
    dias_sorteo = [4]  # jueves


if __name__ == "__main__":
    r = LoteriaBogotaScraper().obtener_ultimo_resultado(contexto=None)
    print(r)