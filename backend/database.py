import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# Render, Supabase y la mayoría de proveedores en la nube dan una sola
# variable DATABASE_URL. Si existe, la usamos directamente.
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Algunos proveedores (Supabase incluido) entregan el URL con el
    # prefijo "postgres://", pero SQLAlchemy 2.x requiere "postgresql://"
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    # Forzamos el driver psycopg2 explícitamente
    if DATABASE_URL.startswith("postgresql://") and "+psycopg2" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
else:
    # Fallback para desarrollo local con variables sueltas
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

# pool_pre_ping evita errores por conexiones que la base de datos
# gratuita (Supabase/Render) cierra tras un rato de inactividad
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()