"""
Corre todos los scrapers activos y guarda los resultados nuevos en la BD.

Se lanza UN SOLO navegador Playwright (headless) y se comparte entre los
scrapers vía BrowserContext — evita abrir/cerrar un navegador por cada
sitio. En la práctica, todos los scrapers activos heredan de
ResultadoDeLaLoteriaScraper (requests + bs4), así que el navegador ni
se usa hoy — se deja el soporte por si algún día agregas un sitio que
sí lo necesite.

AVISO DE FALLOS: arma un ReporteScraping al final de la corrida y emite
UNA línea con logger.error bien visible cuando algo falló.

FILTRO POR DÍA + FESTIVOS: antes de correr, se filtra SCRAPERS_ACTIVOS a
los que sortean hoy (según dias_sorteo de cada scraper), incluyendo los
que su día normal cayó festivo en los últimos DIAS_GRACIA_POST_FESTIVO
días (se aplazan al siguiente día hábil). También se evita re-scrapear
una lotería si ya existe un resultado de hoy en la BD.

REPARTO A MIÉRCOLES/VIERNES: además de guardar cada resultado en la
tabla general (la que alimenta "vista columnas"), si la lotería es una
de las 6 que tienen pantalla propia (Meta/Valle/Manizales para
miércoles, Risaralda/Medellín/Santander para viernes), también se
registra ahí — usando solo la terminación de 2 cifras, como ya hacían
esas pantallas.
"""

import logging
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple

import holidays
from playwright.sync_api import sync_playwright
from sqlalchemy.orm import Session

from .base import ResultadoScrapeado, USER_AGENT_NAVEGADOR
from .registry import SCRAPERS_ACTIVOS

from models import Resultado
from crud import obtener_o_crear_archivo_sincronizacion, crear_resultado_scraping
from services.analisis import registrar_nuevo_resultado
from services.miercoles import registrar_resultado_scraping_miercoles
from services.viernes import registrar_resultado_scraping_viernes

logger = logging.getLogger("scrapers")

FESTIVOS_CO = holidays.CO()
DIAS_GRACIA_POST_FESTIVO = 3


@dataclass
class ReporteScraping:
    """
    Resumen claro de qué loterías se pudieron leer y cuáles no en una
    corrida.
    """
    exitosos: List[str] = field(default_factory=list)
    fallidos: List[str] = field(default_factory=list)

    @property
    def hubo_fallos(self) -> bool:
        return len(self.fallidos) > 0

    @property
    def total(self) -> int:
        return len(self.exitosos) + len(self.fallidos)

    def resumen_texto(self) -> str:
        base = f"Scraping de loterías: {len(self.exitosos)} OK, {len(self.fallidos)} fallidas de {self.total} activas."
        if self.fallidos:
            base += " NO se pudieron leer: " + ", ".join(self.fallidos) + "."
        return base


# =========================================================
# REPARTO A LAS PANTALLAS DE MIÉRCOLES / VIERNES
# =========================================================

LOTERIAS_MIERCOLES = ("Meta", "Valle", "Manizales")
LOTERIAS_VIERNES = ("Risaralda", "Medellin", "Santander")

MAPA_LOTERIA_CORTA = {
    "meta": "Meta",
    "valle": "Valle",
    "manizales": "Manizales",
    "risaralda": "Risaralda",
    "medellin": "Medellin",
    "santander": "Santander",
}


def _sin_acentos(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    ).lower()


def _loteria_corta(nombre_completo: str) -> Optional[str]:
    """
    'Lotería del Meta' -> 'Meta', 'Lotería del Valle' -> 'Valle', etc.
    Devuelve None si la lotería no tiene pantalla propia (Cundinamarca,
    Huila, Tolima, Boyacá, Cauca, Quindío, Cruz Roja).
    """
    normalizado = _sin_acentos(nombre_completo)
    for clave, corta in MAPA_LOTERIA_CORTA.items():
        if clave in normalizado:
            return corta
    return None


def _repartir_a_pantalla_del_dia(db: Session, loteria_completa: str, fecha, numero_completo: str):
    corta = _loteria_corta(loteria_completa)
    if corta is None:
        return

    terminacion = numero_completo[-2:]
    if corta in LOTERIAS_MIERCOLES:
        registrar_resultado_scraping_miercoles(db, corta, fecha, terminacion)
    elif corta in LOTERIAS_VIERNES:
        registrar_resultado_scraping_viernes(db, corta, fecha, terminacion)


# =========================================================
# EJECUCIÓN DE SCRAPERS
# =========================================================

def _ya_tenemos_resultado_de_hoy(db: Session, nombre_loteria: str) -> bool:
    """
    True si ya existe en la BD un resultado de esta lotería con fecha de
    hoy. Evita repetir la petición HTTP si el scheduler corre más de una
    vez el mismo día, o si el reintento por festivo ya trajo el
    resultado en una corrida anterior.
    """
    existe = (
        db.query(Resultado)
        .filter(Resultado.loteria == nombre_loteria, Resultado.fecha == date.today())
        .first()
    )
    return existe is not None


def _scrapers_de_hoy(db: Session) -> List:
    """
    Filtra SCRAPERS_ACTIVOS a los que sortean hoy, MÁS los que su día
    normal cayó festivo en los últimos DIAS_GRACIA_POST_FESTIVO días, Y
    que aún no tengan resultado de hoy guardado.
    """
    hoy = date.today()
    dia_iso_hoy = hoy.isoweekday()  # lunes=1 ... domingo=7

    de_hoy = []
    for scraper in SCRAPERS_ACTIVOS:
        if _ya_tenemos_resultado_de_hoy(db, scraper.nombre_loteria):
            continue

        if not scraper.dias_sorteo or dia_iso_hoy in scraper.dias_sorteo:
            de_hoy.append(scraper)
            continue

        for delta in range(1, DIAS_GRACIA_POST_FESTIVO + 1):
            dia_pasado = hoy - timedelta(days=delta)
            if dia_pasado.isoweekday() in scraper.dias_sorteo and dia_pasado in FESTIVOS_CO:
                de_hoy.append(scraper)
                break

    saltados = [
        s.nombre_loteria for s in SCRAPERS_ACTIVOS
        if s not in de_hoy and not _ya_tenemos_resultado_de_hoy(db, s.nombre_loteria)
    ]
    if saltados:
        logger.info("Hoy no sortean (se saltan): %s", ", ".join(saltados))
    return de_hoy


def _ejecutar_scrapers(db: Session, scrapers: List) -> Tuple[List[ResultadoScrapeado], ReporteScraping]:
    """Corre la lista de scrapers dada y arma el ReporteScraping."""
    resultados: List[ResultadoScrapeado] = []
    reporte = ReporteScraping()

    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        try:
            contexto = navegador.new_context(user_agent=USER_AGENT_NAVEGADOR, locale="es-CO")
            for scraper in scrapers:
                resultado = scraper.ejecutar_seguro(contexto)
                if resultado is None:
                    reporte.fallidos.append(scraper.nombre_loteria)
                    logger.warning(
                        "Sin resultado para %s (revisar scraper o sitio caído)",
                        scraper.nombre_loteria,
                    )
                    continue
                reporte.exitosos.append(scraper.nombre_loteria)
                resultados.append(resultado)
        finally:
            navegador.close()

    if reporte.hubo_fallos:
        logger.error("⚠️ %s", reporte.resumen_texto())
    else:
        logger.info("✅ %s", reporte.resumen_texto())

    return resultados, reporte


# =========================================================
# SINCRONIZACIÓN (día a día)
# =========================================================

def sincronizar_desde_scraping(db: Session) -> Tuple[List[Resultado], ReporteScraping]:
    archivo = obtener_o_crear_archivo_sincronizacion(db)
    nuevos: List[Resultado] = []

    scrapers_hoy = _scrapers_de_hoy(db)
    resultados_scrapeados, reporte = _ejecutar_scrapers(db, scrapers_hoy)

    for r in resultados_scrapeados:
        numero_completo = r.numero_completo.zfill(4)

        ya_existe = (
            db.query(Resultado)
            .filter(
                Resultado.fecha == r.fecha,
                Resultado.numero_completo == numero_completo,
                # sin filtro por lotería a propósito: la misma jugada no
                # debe registrarse dos veces aunque llegue etiquetada
                # distinto por otra vía (excel, API, manual)
            )
            .first()
        )
        if ya_existe:
            continue

        resultado = Resultado(
            archivo_id=archivo.id,
            fecha=r.fecha,
            numero=numero_completo[-2:],
            numero_completo=numero_completo,
            loteria=r.loteria,
        )
        db.add(resultado)
        db.flush()

        registrar_nuevo_resultado(db, resultado)
        _repartir_a_pantalla_del_dia(db, r.loteria, r.fecha, numero_completo)
        nuevos.append(resultado)

    db.commit()
    for r in nuevos:
        db.refresh(r)

    return nuevos, reporte


# =========================================================
# BACKFILL HISTÓRICO
# =========================================================

def sincronizar_historico_desde_scraping(db: Session, dias_atras: int = 60) -> Tuple[List[Resultado], ReporteScraping]:
    archivo = obtener_o_crear_archivo_sincronizacion(db)
    limite = date.today() - timedelta(days=dias_atras)
    reporte = ReporteScraping()
    entradas = []

    for scraper in SCRAPERS_ACTIVOS:
        try:
            historico = scraper.obtener_historico(max_sorteos=30)
        except Exception:
            logger.exception("Fallo trayendo histórico de %s", scraper.nombre_loteria)
            reporte.fallidos.append(scraper.nombre_loteria)
            continue

        if not historico:
            reporte.fallidos.append(scraper.nombre_loteria)
            continue

        reporte.exitosos.append(scraper.nombre_loteria)
        for r in historico:
            if r.fecha < limite:
                continue
            entradas.append((r.fecha, r.numero_completo.zfill(4), r.loteria))

    entradas.sort(key=lambda e: e[0])  # cronológico, indispensable para el algoritmo

    nuevos: List[Resultado] = []
    for fecha, numero_completo, loteria in entradas:
        ya_existe = (
            db.query(Resultado)
            .filter(
                Resultado.fecha == fecha,
                Resultado.numero_completo == numero_completo,
            )
            .first()
        )
        if ya_existe:
            continue

        resultado = Resultado(
            archivo_id=archivo.id,
            fecha=fecha,
            numero=numero_completo[-2:],
            numero_completo=numero_completo,
            loteria=loteria,
        )
        db.add(resultado)
        db.flush()
        registrar_nuevo_resultado(db, resultado)
        _repartir_a_pantalla_del_dia(db, loteria, fecha, numero_completo)
        nuevos.append(resultado)

    db.commit()
    for r in nuevos:
        db.refresh(r)

    logger.info("Backfill histórico: %s", reporte.resumen_texto())
    return nuevos, reporte