# scrapers/loteria_meta.py — reemplazar TODO el archivo por esto
from .resultado_de_la_loteria import ResultadoDeLaLoteriaScraper


class LoteriaMetaScraper(ResultadoDeLaLoteriaScraper):
    nombre_loteria = "Lotería del Meta"
    slug_url = "loteria-del-meta"
    dias_sorteo = (3,)  # miércoles


if __name__ == "__main__":
    r = LoteriaMetaScraper().obtener_ultimo_resultado()
    print(r)