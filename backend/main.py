from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from openpyxl import load_workbook
from datetime import datetime
from io import BytesIO

import crud
from database import SessionLocal


app = FastAPI()


# =========================================================
# CONEXIÓN A BASE DE DATOS
# =========================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# =========================================================
# INICIO
# =========================================================

@app.get("/")
def inicio():
    return {
        "mensaje": "Lottery Analyzer API funcionando 🚀"
    }


# =========================================================
# CREAR ARCHIVO
# =========================================================

@app.post("/archivos")
def crear_archivo(
    nombre: str,
    nombre_original: str,
    db: Session = Depends(get_db)
):
    ahora = datetime.now()

    archivo = crud.crear_archivo(
        db,
        nombre=nombre,
        nombre_original=nombre_original,
        fecha_creacion=ahora,
        fecha_actualizacion=ahora
    )

    return archivo


# =========================================================
# LISTAR ARCHIVOS
# =========================================================

@app.get("/archivos")
def listar_archivos(
    db: Session = Depends(get_db)
):
    return crud.obtener_archivos(db)


# =========================================================
# OBTENER ARCHIVO
# =========================================================

@app.get("/archivos/{archivo_id}")
def obtener_archivo(
    archivo_id: int,
    db: Session = Depends(get_db)
):
    archivo = crud.obtener_archivo(db, archivo_id)

    if not archivo:
        raise HTTPException(
            status_code=404,
            detail="Archivo no encontrado"
        )

    return archivo


# =========================================================
# ELIMINAR ARCHIVO
# =========================================================

@app.delete("/archivos/{archivo_id}")
def eliminar_archivo(
    archivo_id: int,
    db: Session = Depends(get_db)
):
    archivo = crud.eliminar_archivo(db, archivo_id)

    if not archivo:
        raise HTTPException(
            status_code=404,
            detail="Archivo no encontrado"
        )

    return {
        "mensaje": "Archivo eliminado correctamente"
    }


# =========================================================
# SUBIR Y LEER EXCEL
# =========================================================

@app.post("/excel/upload")
async def subir_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # VALIDAR EXTENSIÓN
    # -----------------------------------------------------

    if not file.filename.lower().endswith(
        (".xlsx", ".xlsm", ".xltx", ".xltm")
    ):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe ser un Excel válido"
        )

    # -----------------------------------------------------
    # LEER ARCHIVO
    # -----------------------------------------------------

    contenido = await file.read()

    try:
        workbook = load_workbook(
            filename=BytesIO(contenido),
            read_only=True,
            data_only=True
        )

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="No se pudo leer el archivo Excel"
        )

    # -----------------------------------------------------
    # INFORMACIÓN DE LAS HOJAS
    # -----------------------------------------------------

    hojas = []

    for worksheet in workbook.worksheets:

        primeras_filas = []

        for row in worksheet.iter_rows(
            min_row=1,
            max_row=5,
            values_only=True
        ):
            primeras_filas.append(list(row))

        hojas.append({
            "nombre": worksheet.title,
            "filas": worksheet.max_row,
            "columnas": worksheet.max_column,
            "primeras_filas": primeras_filas
        })

    workbook.close()

    # -----------------------------------------------------
    # CREAR REGISTRO DEL ARCHIVO
    # -----------------------------------------------------

    ahora = datetime.now()

    archivo = crud.crear_archivo(
        db,
        nombre=file.filename,
        nombre_original=file.filename,
        fecha_creacion=ahora,
        fecha_actualizacion=ahora
    )

    # -----------------------------------------------------
    # RESPUESTA
    # -----------------------------------------------------

    return {
        "mensaje": "Excel leído y guardado correctamente",
        "archivo_id": archivo.id,
        "nombre_archivo": file.filename,
        "hojas": hojas
    }