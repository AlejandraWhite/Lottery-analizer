import { useEffect, useState, useCallback } from "react";
import { importarExcelViernes, obtenerVistaViernes, agregarResultadoManualViernes } from "../api";
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

export default function PantallaViernes({ busqueda, busquedaFecha }) {
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [risaralda, setRisaralda] = useState([]);
  const [medellin, setMedellin] = useState([]);
  const [santander, setSantander] = useState([]);

  const [fechaManual, setFechaManual] = useState("");
  const [numeroManual, setNumeroManual] = useState("");
  const [loteriaManual, setLoteriaManual] = useState("Risaralda");

  const cargarTodo = useCallback(async () => {
    try {
      const vista = await obtenerVistaViernes();
      setRisaralda(vista.Risaralda || []);
      setMedellin(vista.Medellin || []);
      setSantander(vista.Santander || []);
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
      const data = await importarExcelViernes(archivo);
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
      const data = await agregarResultadoManualViernes({
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
          Subir Excel del viernes
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
          <option value="Risaralda">Risaralda</option>
          <option value="Medellin">Medellín</option>
          <option value="Santander">Santander</option>
        </select>
        <button onClick={manejarAgregarManual}>Agregar</button>
      </div>

      {mensaje && <p className="mensaje">{mensaje}</p>}

      <div className="vista-miercoles">
        <TablaLoteria nombre="RISARALDA" filas={risaralda} busqueda={busqueda} busquedaFecha={busquedaFecha} />
        <TablaLoteria nombre="MEDELLÍN" filas={medellin} busqueda={busqueda} busquedaFecha={busquedaFecha} />
        <TablaLoteria nombre="SANTANDER" filas={santander} busqueda={busqueda} busquedaFecha={busquedaFecha} />
      </div>
    </div>
  );
}