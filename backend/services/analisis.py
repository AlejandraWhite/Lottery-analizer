# lottery-analyzer/backend/services/analisis.py
import requests

from models import Resultado, Archivo, ContadorTerminacion, EstadoTerminacion

DATOS_GOV_URL = "https://www.datos.gov.co/resource/i3kx-3zps.json"

NOMBRE_ARCHIVO_SINCRONIZACION = "Sincronización automática API datos.gov.co"

from datetime import datetime, date, timedelta
from io import BytesIO

from openpyxl import load_workbook
from sqlalchemy.orm import Session
from sqlalchemy import func

class ResultadoNoEncontrado(Exception):
    pass


class ResultadoDemasiadoAntiguo(Exception):
    pass


def eliminar_resultado(db: Session, resultado_id: int, dias_limite: int = 7):
    resultado = db.query(Resultado).filter(Resultado.id == resultado_id).first()
    if resultado is None:
        raise ResultadoNoEncontrado("Resultado no encontrado")

    antiguedad = datetime.now() - resultado.creado_en
    if antiguedad > timedelta(days=dias_limite):
        raise ResultadoDemasiadoAntiguo(
            "Solo se pueden eliminar resultados agregados hace menos de una semana"
        )

    revertir_registro_resultado(db, resultado)
    db.delete(resultado)
    db.commit()

def _a_texto_numerico(valor) -> str:
    """Convierte el valor de una celda (int, float, str) a solo dígitos,
    sin arrastrar el '.0' que openpyxl agrega a los floats."""
    if isinstance(valor, float):
        valor = int(round(valor))
    texto = str(valor).strip()
    if texto.endswith(".0"):
        texto = texto[:-2]
    return "".join(ch for ch in texto if ch.isdigit()) or "0"


def normalizar_numero(numero) -> str:
    return _a_texto_numerico(numero).zfill(2)[-2:]


def normalizar_numero_completo(numero) -> str:
    return _a_texto_numerico(numero).zfill(4)[-4:]


def obtener_ultimas_dos(numero_completo: str) -> str:
    numero = normalizar_numero_completo(numero_completo)
    return numero[-2:]


def convertir_resultado(resultado):
    if resultado is None:
        return None

    numero_completo = normalizar_numero_completo(resultado.numero_completo)
    ultimas_dos = obtener_ultimas_dos(numero_completo)

    return {
        "id": resultado.id,
        "fecha": resultado.fecha.isoformat() if resultado.fecha else None,
        "numero_completo": numero_completo,
        "ultimas_dos": ultimas_dos,
        "loteria": getattr(resultado, "loteria", None),
        "creado_en": resultado.creado_en.isoformat() if getattr(resultado, "creado_en", None) else None,
    }


def obtener_resultados(
    db: Session,
    terminacion: str = None,
    loteria: str = None,
    limite: int = 50,
):
    query = db.query(Resultado)

    if terminacion:
        query = query.filter(Resultado.numero == normalizar_numero(terminacion))
    if loteria:
        query = query.filter(Resultado.loteria == loteria)

    return (
        query
        .order_by(Resultado.fecha.desc(), Resultado.id.desc())
        .limit(limite)
        .all()
    )
# =========================================================
# ESTADO POR TERMINACIÓN (última / penúltima / tercera)
# =========================================================

def obtener_o_crear_estado(db: Session, terminacion: str) -> EstadoTerminacion:
    estado = (
        db.query(EstadoTerminacion)
        .filter(EstadoTerminacion.terminacion == terminacion)
        .first()
    )
    if estado is None:
        estado = EstadoTerminacion(terminacion=terminacion)
        db.add(estado)
    return estado


def registrar_nuevo_resultado(db: Session, resultado: Resultado):
    terminacion = resultado.numero
    estado = obtener_o_crear_estado(db, terminacion)

    anterior_ultima_id = estado.ultima_id
    anterior_penultima_id = estado.penultima_id

    if anterior_penultima_id is not None:
        estado.antepenultima_id = anterior_penultima_id

    if anterior_ultima_id is not None:
        estado.tercera_id = anterior_ultima_id

    estado.penultima_id = anterior_ultima_id
    estado.ultima_id = resultado.id

    incrementar_contador(db, terminacion)

def analizar_numero(db: Session, numero: str):
    numero = normalizar_numero(numero)
    estado = (
        db.query(EstadoTerminacion)
        .filter(EstadoTerminacion.terminacion == numero)
        .first()
    )
    return {
        "numero": numero,
        "ultima": convertir_resultado(estado.ultima) if estado else None,
        "penultima": convertir_resultado(estado.penultima) if estado else None,
        "tercera": convertir_resultado(estado.tercera) if estado else None,
        "antepenultima": convertir_resultado(estado.antepenultima) if estado else None,
    }
def analizar_todos_los_numeros(db: Session):
    analisis = {}
    for i in range(100):
        numero = f"{i:02d}"
        analisis[numero] = analizar_numero(db, numero)
    return analisis


def construir_analisis_completo(db: Session):
    analisis = analizar_todos_los_numeros(db)
    frecuencias = calcular_frecuencias(db)

    for numero in analisis:
        analisis[numero]["veces_que_caen"] = frecuencias[numero]

    return analisis


# =========================================================
# IMPORTACIÓN DE RESULTADOS NUEVOS DESDE EXCEL
# =========================================================

def parsear_fecha(valor) -> date:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor

    texto = str(valor).strip()
    for formato in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue

    raise ValueError(f"No se pudo interpretar la fecha: {valor!r}")


def importar_resultados_excel(db: Session, archivo_id: int, contenido_excel: bytes):
    wb = load_workbook(filename=BytesIO(contenido_excel), data_only=True)
    ws = wb.active

    filas = list(ws.iter_rows(values_only=True))
    if not filas:
        return []

    encabezado = filas[0]
    nombres_loterias = [
        str(celda).strip() if celda else f"Columna {i + 1}"
        for i, celda in enumerate(encabezado[1:], start=1)
    ]

    entradas = []

    for fila in filas[1:]:
        if not fila or fila[0] is None:
            continue

        fecha = parsear_fecha(fila[0])

        for indice, celda in enumerate(fila[1:]):
            if celda is None or str(celda).strip() == "":
                continue

            numero_completo = normalizar_numero_completo(celda)
            loteria = (
                nombres_loterias[indice]
                if indice < len(nombres_loterias)
                else "Sin especificar"
            )
            entradas.append((fecha, numero_completo, loteria))

    # Orden cronológico: indispensable para que "última/penúltima/tercera"
    # queden bien armadas al registrar cada resultado
    entradas.sort(key=lambda e: e[0])

    nuevos = []

    for fecha, numero_completo, loteria in entradas:
        ya_existe = (
            db.query(Resultado)
            .filter(
                Resultado.fecha == fecha,
                Resultado.numero_completo == numero_completo,
                Resultado.loteria == loteria,
            )
            .first()
        )
        if ya_existe:
            continue

        resultado = Resultado(
            archivo_id=archivo_id,
            fecha=fecha,
            numero=obtener_ultimas_dos(numero_completo),
            numero_completo=numero_completo,
            loteria=loteria,
        )
        db.add(resultado)
        db.flush()

        registrar_nuevo_resultado(db, resultado)
        nuevos.append(resultado)

    db.commit()
    for r in nuevos:
        db.refresh(r)

    return nuevos


def parsear_fecha_datos_gov(texto: str) -> date:
    try:
        return datetime.fromisoformat(texto.replace("Z", "")).date()
    except ValueError:
        return parsear_fecha(texto)


def obtener_o_crear_archivo_sincronizacion(db: Session) -> Archivo:
    archivo = (
        db.query(Archivo)
        .filter(Archivo.nombre == NOMBRE_ARCHIVO_SINCRONIZACION)
        .first()
    )
    if archivo:
        return archivo

    ahora = datetime.now()
    archivo = Archivo(
        nombre=NOMBRE_ARCHIVO_SINCRONIZACION,
        nombre_original=NOMBRE_ARCHIVO_SINCRONIZACION,
        fecha_creacion=ahora,
        fecha_actualizacion=ahora,
    )
    db.add(archivo)
    db.commit()
    db.refresh(archivo)

    return archivo


def obtener_fecha_ultimo_sincronizado(db: Session):
    """
    Última fecha con resultados traídos por la API (ignora el bloque
    'Histórico' que viene del excel manual del señor).
    """
    return (
        db.query(func.max(Resultado.fecha))
        .filter(Resultado.loteria != "Histórico")
        .scalar()
    )


def sincronizar_desde_api_datos_gov(db: Session, dias_por_defecto: int = 30):
    ultima_fecha = obtener_fecha_ultimo_sincronizado(db)
    if isinstance(ultima_fecha, datetime):
        ultima_fecha = ultima_fecha.date()

    hoy = date.today()
    fecha_inicio = ultima_fecha if ultima_fecha else hoy - timedelta(days=dias_por_defecto)

    archivo = obtener_o_crear_archivo_sincronizacion(db)

    entradas = []
    offset = 0
    tamano_pagina = 1000

    while True:
        respuesta = requests.get(
            DATOS_GOV_URL,
            params={
                "$where": "tipo_de_premio = 'Mayor'",
                "$order": ":id DESC",   # o quita el $order y pagina con $offset normal
                "$limit": tamano_pagina,
                "$offset": offset,
            },
            timeout=15,
        )
        respuesta.raise_for_status()
        pagina = respuesta.json()

        if not pagina:
            break

        for registro in pagina:
            if registro.get("tipo_de_premio") != "Mayor":
                continue

            numero_billete = registro.get("numero_billete_ganador")
            fecha_texto = registro.get("fecha_del_sorteo")
            loteria = registro.get("loter_a", "Desconocida")

            if not numero_billete or not fecha_texto:
                continue

            fecha = parsear_fecha_datos_gov(fecha_texto)

            # Filtra aquí, en Python, con la fecha ya parseada
            if fecha < fecha_inicio or fecha > hoy:
                continue

            numero_completo = normalizar_numero_completo(numero_billete)
            entradas.append((fecha, numero_completo, loteria))

        if len(pagina) < tamano_pagina:
            break
        offset += tamano_pagina

    entradas.sort(key=lambda e: e[0])

    nuevos = []

    for fecha, numero_completo, loteria in entradas:
        ya_existe = (
            db.query(Resultado)
            .filter(
                Resultado.fecha == fecha,
                Resultado.numero_completo == numero_completo,
                Resultado.loteria == loteria,
            )
            .first()
        )
        if ya_existe:
            continue

        resultado = Resultado(
            archivo_id=archivo.id,
            fecha=fecha,
            numero=obtener_ultimas_dos(numero_completo),
            numero_completo=numero_completo,
            loteria=loteria,
        )
        db.add(resultado)
        db.flush()

        registrar_nuevo_resultado(db, resultado)
        nuevos.append(resultado)

    db.commit()
    for r in nuevos:
        db.refresh(r)

    return nuevos


# =========================================================
# IMPORTACIÓN DEL HISTÓRICO (siembra el estado inicial)
# =========================================================

def _leer_columna_fecha_numero(ws, columna_fecha, columna_numero, fila_inicio):
    pares = []
    for fila in range(fila_inicio, ws.max_row + 1):
        celda_fecha = ws[f"{columna_fecha}{fila}"].value
        celda_numero = ws[f"{columna_numero}{fila}"].value

        if celda_fecha is None or celda_numero is None:
            continue

        try:
            fecha = parsear_fecha(celda_fecha)
            numero_completo = normalizar_numero_completo(celda_numero)
        except (ValueError, TypeError):
            continue

        pares.append((fecha, numero_completo))

    return pares


def importar_historico_excel(
    db: Session,
    archivo_id: int,
    contenido_excel: bytes,
    grupos_columnas=(("B", "C"), ("G", "H"), ("K", "L")),
    fila_inicio: int = 4,
    loteria_por_defecto: str = "Histórico",
    columna_amarilla_numero: str = "O",
    columna_amarilla_cantidad: str = "P",
    fila_inicio_amarilla: int = 4,
):
    """
    Siembra el estado inicial (última/penúltima/tercera) tal como está
    en el Excel del señor:

        grupo 1 (B/C) -> "última"    por terminación
        grupo 2 (G/H) -> "penúltima" por terminación
        grupo 3 (K/L) -> "tercera"   por terminación
    """
    wb = load_workbook(filename=BytesIO(contenido_excel), data_only=True)
    ws = wb.active

    columnas_ultima, columnas_penultima, columnas_tercera = grupos_columnas

    pares_ultima = _leer_columna_fecha_numero(ws, *columnas_ultima, fila_inicio)
    pares_penultima = _leer_columna_fecha_numero(ws, *columnas_penultima, fila_inicio)
    pares_tercera = _leer_columna_fecha_numero(ws, *columnas_tercera, fila_inicio)

    nuevos = []

    def _guardar_resultado(fecha, numero_completo):
        numero_completo = normalizar_numero_completo(numero_completo)
        existente = (
            db.query(Resultado)
            .filter(
                Resultado.fecha == fecha,
                Resultado.numero_completo == numero_completo,
            )
            .first()
        )
        if existente:
            return existente

        resultado = Resultado(
            archivo_id=archivo_id,
            fecha=fecha,
            numero=obtener_ultimas_dos(numero_completo),
            numero_completo=numero_completo,
            loteria=loteria_por_defecto,
        )
        db.add(resultado)
        db.flush()
        nuevos.append(resultado)
        return resultado

    resultados_ultima = {}
    for fecha, numero_completo in pares_ultima:
        r = _guardar_resultado(fecha, numero_completo)
        resultados_ultima[obtener_ultimas_dos(numero_completo)] = r

    resultados_penultima = {}
    for fecha, numero_completo in pares_penultima:
        r = _guardar_resultado(fecha, numero_completo)
        resultados_penultima[obtener_ultimas_dos(numero_completo)] = r

    resultados_tercera = {}
    for fecha, numero_completo in pares_tercera:
        r = _guardar_resultado(fecha, numero_completo)
        terminacion = obtener_ultimas_dos(numero_completo)
        resultados_tercera[terminacion] = r

    for i in range(100):
        terminacion = f"{i:02d}"
        estado = obtener_o_crear_estado(db, terminacion)

        if terminacion in resultados_ultima:
            estado.ultima_id = resultados_ultima[terminacion].id
        if terminacion in resultados_penultima:
            estado.penultima_id = resultados_penultima[terminacion].id
        if terminacion in resultados_tercera:
            estado.tercera_id = resultados_tercera[terminacion].id

    contadores_iniciales = _leer_tabla_amarilla(
        ws,
        columna_numero=columna_amarilla_numero,
        columna_cantidad=columna_amarilla_cantidad,
        fila_inicio=fila_inicio_amarilla,
    )
    for terminacion, cantidad in contadores_iniciales.items():
        fijar_contador_inicial(db, terminacion, cantidad)

    db.commit()
    for r in nuevos:
        db.refresh(r)

    return nuevos

# =========================================================
# VISTA PARA EL FRONTEND
# =========================================================
def _construir_grupo(analisis: dict, clave_dato: str, incluir_cantidad: bool = False):
    """Arma grupo_a/b/d ordenados por la fecha propia de cada posición."""
    filas = []

    for numero, dato in analisis.items():
        posicion = dato[clave_dato]
        if posicion is None or posicion["fecha"] is None:
            continue

        fila = {
            "id": posicion["id"],
            "terminacion": numero,
            "fecha": posicion["fecha"],
            "numero_completo": posicion["numero_completo"],
            "creado_en": posicion["creado_en"],
        }
        if incluir_cantidad:
            fila["cantidad"] = dato["veces_que_caen"]

        filas.append((posicion["fecha"], fila))

    filas.sort(key=lambda par: par[0])
    return [fila for _, fila in filas]


def _construir_grupo_tercera(analisis: dict):
    """
    Se ordena por la fecha de 'última' de la MISMA terminación (no por
    la fecha propia de 'tercera', ni por un timestamp de procesamiento).
    Así, la fila i de esta columna siempre corresponde a la misma
    terminación que la fila i de 'última', sin importar en qué orden
    real se insertaron los datos en la base (histórico, sync diario,
    manual, etc.).
    """
    filas = []

    for numero, dato in analisis.items():
        tercera = dato["tercera"]
        ultima = dato["ultima"]
        if tercera is None or ultima is None or ultima["fecha"] is None:
            continue

        orden = ultima["fecha"]

        filas.append((orden, {
            "terminacion": numero,
            "fecha": tercera["fecha"],
            "numero_completo": tercera["numero_completo"],
        }))

    filas.sort(key=lambda par: par[0])
    return [fila for _, fila in filas]


def construir_vista_excel(db: Session):
    analisis = construir_analisis_completo(db)

    return {
        "grupo_a": _construir_grupo(analisis, "ultima", incluir_cantidad=True),
        "grupo_b": _construir_grupo(analisis, "penultima"),
        "grupo_c": _construir_grupo_tercera(analisis),
        "grupo_d": _construir_grupo(analisis, "antepenultima"),
        "tabla_amarilla": [
            {"terminacion": t, "cantidad": d["veces_que_caen"]}
            for t, d in sorted(
                analisis.items(), key=lambda kv: kv[1]["veces_que_caen"], reverse=True
            )
        ],
    }
# =========================================================
# CONTADORES (columna amarilla / "veces que caen")
# =========================================================

def obtener_o_crear_contador(db: Session, terminacion: str) -> ContadorTerminacion:
    contador = (
        db.query(ContadorTerminacion)
        .filter(ContadorTerminacion.terminacion == terminacion)
        .first()
    )
    if contador is None:
        contador = ContadorTerminacion(terminacion=terminacion, cantidad=0)
        db.add(contador)
    return contador


def incrementar_contador(db: Session, terminacion: str):
    contador = obtener_o_crear_contador(db, terminacion)
    contador.cantidad += 1
    return contador


def fijar_contador_inicial(db: Session, terminacion: str, cantidad: int):
    contador = obtener_o_crear_contador(db, terminacion)
    if cantidad > contador.cantidad:
        contador.cantidad = cantidad
    return contador


def calcular_frecuencias(db: Session):
    contadores = {c.terminacion: c.cantidad for c in db.query(ContadorTerminacion).all()}
    return {f"{i:02d}": contadores.get(f"{i:02d}", 0) for i in range(100)}


def _leer_tabla_amarilla(ws, columna_numero="O", columna_cantidad="P", fila_inicio=4):
    valores = {}
    for fila in range(fila_inicio, ws.max_row + 1):
        celda_numero = ws[f"{columna_numero}{fila}"].value
        celda_cantidad = ws[f"{columna_cantidad}{fila}"].value

        if celda_numero is None or celda_cantidad is None:
            continue

        try:
            terminacion = normalizar_numero(celda_numero)
            cantidad = int(celda_cantidad)
        except (ValueError, TypeError):
            continue

        valores[terminacion] = cantidad

    return valores

NOMBRE_ARCHIVO_MANUAL = "Ingreso manual"


def obtener_o_crear_archivo_manual(db: Session) -> Archivo:
    archivo = (
        db.query(Archivo)
        .filter(Archivo.nombre == NOMBRE_ARCHIVO_MANUAL)
        .first()
    )
    if archivo:
        return archivo

    ahora = datetime.now()
    archivo = Archivo(
        nombre=NOMBRE_ARCHIVO_MANUAL,
        nombre_original=NOMBRE_ARCHIVO_MANUAL,
        fecha_creacion=ahora,
        fecha_actualizacion=ahora,
    )
    db.add(archivo)
    db.commit()
    db.refresh(archivo)
    return archivo


def registrar_resultado_manual(db: Session, fecha_texto: str, numero: str, loteria: str = "Manual"):
    """
    Inserta un único resultado manual (para pruebas) y actualiza el
    estado de última/penúltima/tercera + el contador de esa terminación,
    igual que si viniera de un excel o de la sincronización.
    """
    fecha = parsear_fecha(fecha_texto)
    numero_completo = normalizar_numero_completo(numero)

    ya_existe = (
        db.query(Resultado)
        .filter(
            Resultado.fecha == fecha,
            Resultado.numero_completo == numero_completo,
            Resultado.loteria == loteria,
        )
        .first()
    )
    if ya_existe:
        raise ValueError("Ese resultado ya existe (misma fecha, número y lotería)")

    archivo = obtener_o_crear_archivo_manual(db)

    resultado = Resultado(
        archivo_id=archivo.id,
        fecha=fecha,
        numero=obtener_ultimas_dos(numero_completo),
        numero_completo=numero_completo,
        loteria=loteria,
    )
    db.add(resultado)
    db.flush()

    registrar_nuevo_resultado(db, resultado)

    db.commit()
    db.refresh(resultado)

    return resultado

def decrementar_contador(db: Session, terminacion: str):
    contador = obtener_o_crear_contador(db, terminacion)
    if contador.cantidad > 0:
        contador.cantidad -= 1
    return contador


def obtener_resultado_por_id(db: Session, resultado_id: int):
    resultado = db.query(Resultado).filter(Resultado.id == resultado_id).first()
    if resultado is None:
        raise ValueError("Resultado no encontrado")
    return resultado

def revertir_registro_resultado(db: Session, resultado: Resultado):
    terminacion = resultado.numero
    estado = obtener_o_crear_estado(db, terminacion)

    if estado.ultima_id == resultado.id:
        estado.ultima_id = estado.penultima_id
        estado.penultima_id = estado.antepenultima_id
        estado.tercera_id = estado.antepenultima_id
        estado.tercera_actualizado_en = None
        estado.tercera_orden = None
        estado.antepenultima_id = None
    elif estado.penultima_id == resultado.id:
        # penúltima y tercera son espejo del mismo resultado
        estado.penultima_id = None
        estado.tercera_id = None
        estado.tercera_actualizado_en = None
        estado.tercera_orden = None
    elif estado.antepenultima_id == resultado.id:
        estado.antepenultima_id = None

    decrementar_contador(db, terminacion)

    # analisis.py
def existe_resultado_global(db: Session, fecha, numero_completo: str) -> bool:
    """
    Antes de insertar en la tabla general (la que alimenta vista
    columnas) solo nos importa fecha + número completo, NO la
    lotería. Si la misma jugada llega por dos vías con una etiqueta
    de lotería distinta, no debe registrarse dos veces — eso era lo
    que duplicaba última/penúltima/tercera.
    """
    return (
        db.query(Resultado)
        .filter(Resultado.fecha == fecha, Resultado.numero_completo == numero_completo)
        .first()
        is not None
    )


def reconstruir_estado_terminacion(db: Session):
    db.query(EstadoTerminacion).delete()
    db.query(ContadorTerminacion).delete()
    db.flush()

    resultados = (
        db.query(Resultado)
        .order_by(Resultado.fecha.asc(), Resultado.id.asc())
        .all()
    )

    vistos = set()
    for resultado in resultados:
        clave = (resultado.fecha, resultado.numero_completo)
        if clave in vistos:
            continue
        vistos.add(clave)
        registrar_nuevo_resultado(db, resultado)

    db.commit()