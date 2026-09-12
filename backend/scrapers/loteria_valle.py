# scrapers/loteria_valle.py — reemplazar TODO el archivo por esto
from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaValleScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería del Valle"
    slug_url = "loteria-del-valle"
    dias_sorteo = (3,)  # miércoles


if __name__ == "__main__":
    r = LoteriaValleScraper().obtener_ultimo_resultado()
    print(r)