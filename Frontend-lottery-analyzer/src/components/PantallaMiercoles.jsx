import { useEffect, useState, useCallback } from "react";
import { importarExcelMiercoles, obtenerVistaMiercoles, agregarResultadoManualMiercoles } from "../api";
import { formatearFechaMiercoles } from "../utils";
import Resaltado from "./Resaltado";

function coincideTexto(valor, patron) {
  if (!patron) return false;
  return String(valor ?? "").toLowerCase().includes(patron.toLowerCase());
}

function TablaLoteria({ nombre, filas, busqueda, busquedaFecha }) {
  return (
    <div className="columna-grupo">
      <h3>{nombre}</h3>
      <div className="tabla-scroll">
        <table className="tabla-grupo">
          <thead>
            <tr>
              <th>#</th>
              <th>#</th>
              <th>Última</th>
              <th>Penúltima</th>
              <th>Antepenúltima</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => {
              const fechaUltima = fila.ultima ? formatearFechaMiercoles(fila.ultima.fecha) : "";
              const fechaPenultima = fila.penultima ? formatearFechaMiercoles(fila.penultima.fecha) : "";
              const fechaAntepenultima = fila.antepenultima ? formatearFechaMiercoles(fila.antepenultima.fecha) : "";

              const coincide =
                coincideTexto(fila.terminacion, busqueda) ||
                coincideTexto(fechaUltima, busquedaFecha) ||
                coincideTexto(fechaPenultima, busquedaFecha) ||
                coincideTexto(fechaAntepenultima, busquedaFecha);

              return (
                <tr key={fila.terminacion} className={coincide ? "fila-coincide" : ""}>
                  <td className="num celda-con-fila">
                    <span className="fila-numero">{i + 1}</span>
                    <Resaltado texto={fila.terminacion} busqueda={busqueda} />
                  </td>
                  <td>{fila.cantidad}</td>
                  <td className="num">
                    {fila.ultima ? <Resaltado texto={fechaUltima} busqueda={busquedaFecha} /> : "—"}
                  </td>
                  <td className="num">
                    {fila.penultima ? <Resaltado texto={fechaPenultima} busqueda={busquedaFecha} /> : "—"}
                  </td>
                  <td className="num">
                    {fila.antepenultima ? <Resaltado texto={fechaAntepenultima} busqueda={busquedaFecha} /> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PantallaMiercoles({ busqueda, busquedaFecha }) {
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [meta, setMeta] = useState([]);
  const [valle, setValle] = useState([]);
  const [manizales, setManizales] = useState([]);

  const [fechaManual, setFechaManual] = useState("");
  const [numeroManual, setNumeroManual] = useState("");
  const [loteriaManual, setLoteriaManual] = useState("Meta");

  const cargarTodo = useCallback(async () => {
    try {
      const vista = await obtenerVistaMiercoles();
      setMeta(vista.Meta || []);
      setValle(vista.Valle || []);
      setManizales(vista.Manizales || []);
    } catch (e) {
      setMensaje(e.message);
    }
  }, []);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  async function manejarImportar() {
    if (!archivo) return;
    setSubiendo(true);
    setMensaje("");
    try {
      const data = await importarExcelMiercoles(archivo);
      setMensaje(data.mensaje);
      await cargarTodo();
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function manejarAgregarManual() {
    if (!fechaManual || !numeroManual) return;
    setMensaje("");
    try {
      const data = await agregarResultadoManualMiercoles({
        fecha: fechaManual,
        numero: numeroManual,
        loteria: loteriaManual,
      });
      setMensaje(data.mensaje);
      setFechaManual("");
      setNumeroManual("");
      await cargarTodo();
    } catch (e) {
      setMensaje(e.message);
    }
  }

  return (
    <div>
      <div className="barra-superior">
        <label className="subir-archivo">
          Subir Excel del miércoles
          <input
            type="file"
            accept=".xlsx,.xlsm,.xltx,.xltm"
            onChange={(e) => setArchivo(e.target.files[0])}
          />
        </label>
        <button onClick={manejarImportar} disabled={!archivo || subiendo}>
          {subiendo ? "Importando..." : "Importar"}
        </button>
      </div>

      <div className="agregar-manual-miercoles">
        <input
          type="date"
          value={fechaManual}
          onChange={(e) => setFechaManual(e.target.value)}
        />
        <input
          type="text"
          placeholder="Número"
          value={numeroManual}
          onChange={(e) => setNumeroManual(e.target.value)}
        />
        <select value={loteriaManual} onChange={(e) => setLoteriaManual(e.target.value)}>
          <option value="Meta">Meta</option>
          <option value="Valle">Valle</option>
          <option value="Manizales">Manizales</option>
        </select>
        <button onClick={manejarAgregarManual}>Agregar</button>
      </div>

      {mensaje && <p className="mensaje">{mensaje}</p>}

      <div className="vista-miercoles">
        <TablaLoteria nombre="META" filas={meta} busqueda={busqueda} busquedaFecha={busquedaFecha} />
        <TablaLoteria nombre="VALLE" filas={valle} busqueda={busqueda} busquedaFecha={busquedaFecha} />
        <TablaLoteria nombre="MANIZALES" filas={manizales} busqueda={busqueda} busquedaFecha={busquedaFecha} />
      </div>
    </div>
  );
}