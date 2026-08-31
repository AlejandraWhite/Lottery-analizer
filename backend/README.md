🎰 Lottery Analyzer

Aplicación de escritorio para automatizar el análisis y organización de resultados de loterías a partir de archivos Excel.

El objetivo del proyecto es que el usuario pueda cargar o mantener archivos de análisis y que el sistema se encargue automáticamente de organizar los números, fechas y cantidades de apariciones según las reglas definidas.

📌 Objetivo del proyecto

Actualmente el análisis se realiza manualmente en Excel.

El programa busca automatizar este proceso:

Obtener los resultados de las loterías.
Identificar los números que han caído.
Registrar la fecha en que cayó cada número.
Registrar cuántas veces ha caído cada número.
Identificar la última, penúltima y antepenúltima aparición.
Organizar automáticamente las columnas según la lógica utilizada actualmente en Excel.
Guardar los archivos y análisis para que el usuario no tenga que cargarlos nuevamente cada vez.
Permitir tener varios archivos de análisis guardados.
Permitir asignar nombres a los diferentes archivos/análisis.
Mostrar la información de forma clara y fácil de entender.
🏗️ Tecnologías
Frontend
React
JavaScript
HTML
CSS
Backend
Python 3.14.7
FastAPI
Uvicorn
OpenPyXL
SQLAlchemy
PostgreSQL
Base de datos
PostgreSQL 16.11
📁 Estructura inicial del proyecto
lottery-analyzer/
│
├── frontend/
│   └── React
│
├── backend/
│   │
│   ├── .venv/
│   │
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── create_tables.py
│   ├── test_db.py
│   ├── requirements.txt
│   └── .env
│
└── README.md
🐍 Configuración del Backend

El backend utiliza un entorno virtual de Python.

Desde:

cd lottery-analyzer/backend

se creó el entorno virtual:

python -m venv .venv

Para activarlo desde Git Bash:

source .venv/Scripts/activate

Cuando está activo aparece:

(.venv)

al inicio de la terminal.

📦 Dependencias

Las principales dependencias instaladas son:

python -m pip install fastapi uvicorn openpyxl

Para permitir la carga de archivos mediante FastAPI:

python -m pip install python-multipart

Para trabajar con PostgreSQL:

python -m pip install sqlalchemy psycopg2-binary python-dotenv

Las dependencias instaladas se guardan en:

requirements.txt

Para actualizarlo:

python -m pip freeze > requirements.txt
🗄️ PostgreSQL

La aplicación utiliza PostgreSQL como base de datos.

La versión actualmente instalada y utilizada es:

PostgreSQL 16.11

La base de datos creada para el proyecto se llama:

lottery_analyzer

La base de datos se creó utilizando pgAdmin.

🔐 Variables de entorno

Las credenciales de PostgreSQL se almacenan en un archivo .env.

Ejemplo:

DATABASE_HOST=localhost
DATABASE_CLIENT=postgres
DATABASE_PORT=5432
DATABASE_NAME=lottery_analyzer
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=TU_CONTRASEÑA

⚠️ El archivo .env NO debe subirse a GitHub porque contiene información privada.

Se debe agregar al .gitignore:

.env
.venv/
__pycache__/
🔌 Conexión con PostgreSQL

El archivo:

backend/database.py

contiene la configuración de conexión.

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_HOST = os.getenv("DATABASE_HOST", "localhost")
DATABASE_PORT = os.getenv("DATABASE_PORT", "5432")
DATABASE_NAME = os.getenv("DATABASE_NAME")
DATABASE_USERNAME = os.getenv("DATABASE_USERNAME")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")

DATABASE_URL = (
    f"postgresql+psycopg2://"
    f"{DATABASE_USERNAME}:{DATABASE_PASSWORD}"
    f"@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_NAME}"
)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()
🧪 Prueba de conexión

Se creó:

backend/test_db.py

para comprobar que Python puede conectarse correctamente con PostgreSQL.

La prueba realizada devolvió:

✅ CONEXIÓN EXITOSA
PostgreSQL 16.11, compiled by Visual C++ build 1944, 64-bit

Por lo tanto, la conexión entre FastAPI/Python y PostgreSQL funciona correctamente.

🧱 Modelos de la base de datos

Actualmente tenemos dos modelos principales:

Archivo

Representa cada archivo/análisis guardado por el usuario.

class Archivo(Base):
    __tablename__ = "archivos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    nombre_original = Column(String(255), nullable=False)
    fecha_creacion = Column(DateTime, nullable=False)
    fecha_actualizacion = Column(DateTime, nullable=False)

La tabla permite guardar:

ID del archivo.
Nombre asignado por el usuario.
Nombre original del Excel.
Fecha de creación.
Fecha de última actualización.
Resultado

Representa cada resultado de lotería asociado a un archivo.

class Resultado(Base):
    __tablename__ = "resultados"

    id = Column(Integer, primary_key=True, index=True)

    archivo_id = Column(
        Integer,
        ForeignKey("archivos.id"),
        nullable=False
    )

    fecha = Column(DateTime, nullable=False)
    numero = Column(String(2), nullable=False)
    loteria = Column(String(100), nullable=False)

Cada resultado guarda:

ID.
Archivo al que pertenece.
Fecha del resultado.
Número de dos cifras.
Nombre de la lotería.
🔗 Relación entre tablas

Un archivo puede tener muchos resultados.

La relación es:

archivos
   │
   └── resultados
          ├── resultado
          ├── resultado
          ├── resultado
          └── ...

En SQLAlchemy:

resultados = relationship(
    "Resultado",
    back_populates="archivo",
    cascade="all, delete-orphan"
)

Esto permitirá que al eliminar un archivo también puedan eliminarse sus resultados asociados.

📊 Excel

El sistema ya puede recibir archivos .xlsx mediante FastAPI.

Endpoint:

POST /excel/upload

El endpoint utiliza:

from openpyxl import load_workbook

para leer el Excel.

Actualmente puede:

Recibir el archivo.
Abrirlo.
Detectar las hojas.
Detectar cantidad de filas.
Detectar cantidad de columnas.
Leer las primeras filas.
Devolver la estructura encontrada.

Ejemplo de respuesta:

{
    "mensaje": "Excel leído correctamente",
    "nombre_archivo": "ANALISIS PARA ALEJANDRA.xlsx",
    "hojas": [
        {
            "nombre": "Hoja1",
            "filas": 103,
            "columnas": 16
        }
    ]
}
🎯 Estructura actual del Excel

El archivo utilizado actualmente tiene una hoja principal:

Hoja1

con:

103 filas
16 columnas

La estructura contiene información como:

FECHA






CANT
PENULTIMA
veces que caen

También existen:

Hoja2
Hoja3

pero actualmente están vacías.

🎰 Loterías que se analizarán
Miércoles
Valle
Manizales
Meta
Viernes
Risaralda
Medellín
Santander

El sistema deberá poder trabajar con estas loterías y almacenar sus resultados.

🧠 Lógica principal del análisis

La lógica que actualmente se realiza manualmente en Excel deberá convertirse posteriormente en código.

De forma general:

Se obtiene un número ganador.
Se identifica el número de dos cifras.
Se busca ese número dentro de los registros existentes.
Se identifica cuándo apareció anteriormente.
Se determina cuál es la aparición más antigua.
Se mueve/reorganiza la información según la regla establecida.
Se actualizan las columnas correspondientes.
Se actualiza la cantidad total de veces que ha aparecido el número.
Se guarda el nuevo estado del análisis.
El proceso queda listo para el siguiente resultado.

La lógica exacta de reorganización de las columnas todavía debe implementarse y probarse con el Excel real.

🖥️ Funcionamiento esperado

La aplicación final tendrá una interfaz donde el usuario podrá:

1. Crear un análisis

Por ejemplo:

Análisis Alejandra
2. Cargar un Excel inicial

El sistema leerá la información existente.

3. Guardar el análisis

La información quedará almacenada en PostgreSQL.

4. Actualizar resultados

Cuando aparezcan nuevos resultados de las loterías, el sistema podrá incorporar automáticamente la información.

5. Organizar las columnas

El backend aplicará automáticamente las reglas utilizadas actualmente de forma manual.

6. Consultar los análisis

El usuario podrá tener varios análisis guardados:

Análisis Alejandra
Análisis Enero 2027
Análisis Prueba

Cada uno conservará su información independientemente.

🔮 API de resultados de loterías

Una de las siguientes etapas será investigar si existen APIs confiables que permitan obtener automáticamente los resultados de:

Valle
Manizales
Meta
Risaralda
Medellín
Santander

La idea es evitar que el usuario tenga que escribir manualmente cada número ganador.

El flujo ideal será:

API de resultados
        ↓
Nuevo resultado
        ↓
Backend FastAPI
        ↓
PostgreSQL
        ↓
Aplicar lógica de análisis
        ↓
Actualizar información
        ↓
Frontend React
🚧 Estado actual
✅ Completado

Crear proyecto React.

Crear backend con FastAPI.

Crear entorno virtual de Python.

Instalar FastAPI.

Instalar Uvicorn.

Instalar OpenPyXL.

Instalar python-multipart.

Crear endpoint para subir Excel.

Leer estructura del Excel.

Instalar SQLAlchemy.

Configurar PostgreSQL.

Crear base de datos lottery_analyzer.

Comprobar conexión con PostgreSQL.

Crear tablas.

Crear modelos Archivo y Resultado.

⏳ Pendiente

Crear API CRUD para los archivos.

Guardar los Excel/análisis en la base de datos.

Definir cómo almacenar la estructura del análisis.

Implementar la lógica de reorganización de columnas.

Crear sistema para actualizar resultados.

Investigar APIs de resultados de loterías.

Conectar React con FastAPI.

Crear interfaz para cargar/crear análisis.

Crear vista clara de las columnas.

Permitir cambiar el nombre de los análisis.

Permitir varios análisis independientes.

Automatizar la actualización.

Crear aplicación de escritorio.

▶️ Ejecutar el backend

Desde:

cd lottery-analyzer/backend

activar el entorno:

source .venv/Scripts/activate

Ejecutar FastAPI:

python -m uvicorn main:app --reload

La API estará disponible en:

http://127.0.0.1:8000

La documentación interactiva de FastAPI está en:

http://127.0.0.1:8000/docs
📝 Nota importante

El proyecto todavía está en fase de desarrollo.

La prioridad antes de construir toda la interfaz es definir correctamente la lógica que transforma y organiza las columnas, porque esa será la parte principal del sistema.

Una vez definida esa lógica, podremos convertirla en funciones de Python y hacer que PostgreSQL guarde permanentemente el estado de cada análisis.