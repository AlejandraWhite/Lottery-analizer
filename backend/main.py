from fastapi import FastAPI, UploadFile, File
from openpyxl import load_workbook
from io import BytesIO

app = FastAPI()


@app.get("/")
def inicio():
    return {"mensaje": "Lottery Analyzer API funcionando 🚀"}


@app.post("/excel/upload")
async def subir_excel(file: UploadFile = File(...)):
    # Leer el archivo
    contenido = await file.read()

    # Convertir los bytes en un archivo que openpyxl pueda leer
    archivo_excel = BytesIO(contenido)

    # Abrir el Excel sin modificarlo
    workbook = load_workbook(
        filename=archivo_excel,
        read_only=True,
        data_only=True
    )

    hojas = []

    for worksheet in workbook.worksheets:
        primeras_filas = []

        for row in worksheet.iter_rows(
            min_row=1,
            max_row=20,
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

    return {
        "mensaje": "Excel leído correctamente",
        "nombre_archivo": file.filename,
        "hojas": hojas
    }