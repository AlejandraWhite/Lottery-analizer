import { useEffect, useState } from "react";
import {
  obtenerAnalisis,
  obtenerVistaExcel,
  importarExcel,
  sincronizarLoteria,
  eliminarResultado
} from "./api";
import TablaAnalisis from "./components/TablaAnalisis";
import TablaExcel from "./components/TablaExcel";
import GestorResultados from "./components/GestorResultados";
import "./index.css";

export default function App() {
  const [datos, setDatos] = useState([]);
  const [vistaExcel, setVistaExcel] = useState(null);
  const [ventana, setVentana] = useState("resumen"); // "resumen" | "excel"
  const [cargando, setCargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [orden, setOrden] = useState("terminacion");

  async function cargarTodo() {
    setCargando(true);
    try {
      const [analisis, vista] = await Promise.all([
        obtenerAnalisis(),
        obtenerVistaExcel(),
      ]);
      setDatos(analisis);
      setVistaExcel(vista);
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function manejarArchivo(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    setCargando(true);
    setMensaje("");

    try {
      const resultado = await importarExcel(archivo);
      setMensaje(resultado.mensaje);
      const vista = await obtenerVistaExcel();
      setDatos(resultado.analisis);
      setVistaExcel(vista);
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setCargando(false);
      evento.target.value = "";
    }
  }

  async function manejarSincronizar() {
    setSincronizando(true);
    setMensaje("");

    try {
      const resultado = await sincronizarLoteria();
      setMensaje(resultado.mensaje);
      const vista = await obtenerVistaExcel();
      setDatos(resultado.analisis);
      setVistaExcel(vista);
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setSincronizando(false);
    }
  }
  
  async function manejarEliminarResultado(id) {
  setCargando(true);
  setMensaje("");
  try {
    const data = await eliminarResultado(id);
    setMensaje(data.mensaje);
    setDatos(data.analisis);
    setVistaExcel(data.vista_excel);
  } catch (e) {
    setMensaje(e.message);
  } finally {
    setCargando(false);
  }
}

  return (
    <div className="contenedor">
      <h1>Lottery Analyzer</h1>

      <div className="barra-superior">
        <label className="subir-archivo">
          Subir Excel con resultados nuevos
          <input
            type="file"
            accept=".xlsx,.xlsm,.xltx,.xltm"
            onChange={manejarArchivo}
          />
        </label>

        <button onClick={manejarSincronizar} disabled={sincronizando}>
          {sincronizando ? "Sincronizando..." : "Sincronizar resultados"}
        </button>

        <div className="pestanas">
          <button
            className={ventana === "resumen" ? "activa" : ""}
            onClick={() => setVentana("resumen")}
          >
            Resumen
          </button>
          <button
            className={ventana === "excel" ? "activa" : ""}
            onClick={() => setVentana("excel")}
          >
            Vista columnas
          </button>
        </div>

        {ventana === "resumen" && (
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="terminacion">Ordenar por terminación</option>
            <option value="frecuencia">Ordenar por frecuencia</option>
          </select>
        )}
      </div>

      <GestorResultados
  onResultado={(data) => {
    setDatos(data.analisis);
    setVistaExcel(data.vista_excel);
  }}
/>

      {mensaje && <p className="mensaje">{mensaje}</p>}
      {cargando && <p className="cargando">Cargando...</p>}

      {ventana === "resumen" ? (
        <TablaAnalisis datos={datos} orden={orden} />
      ) : (
        <TablaExcel
  vista={vistaExcel}
  onEliminar={manejarEliminarResultado}
  cargando={cargando}
/>
      )}
    </div>
  );
}