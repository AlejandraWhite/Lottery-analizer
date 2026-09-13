import { formatearFecha } from "../utils";
import Resaltado from "./Resaltado";

function coincideTexto(valor, patron) {
  if (!patron) return false;
  return String(valor ?? "").toLowerCase().includes(patron.toLowerCase());
}

function Celda({ dato, busqueda, busquedaFecha }) {
  if (!dato) {
    return <td className="celda celda-vacia">—</td>;
  }

  const fechaFormateada = formatearFecha(dato.fecha);

  return (
    <td className="celda celda-ocupada">
      <div className="celda-fecha">
        <Resaltado texto={fechaFormateada} busqueda={busquedaFecha} />
      </div>
      <div className="celda-numero">
        <Resaltado texto={dato.numero_completo} busqueda={busqueda} />
      </div>
    </td>
  );
}

export default function TablaAnalisis({ datos, orden, busqueda, busquedaFecha }) {
  const filas = [...datos].sort((a, b) => {
    if (orden === "frecuencia") {
      return b.veces_que_caen - a.veces_que_caen;
    }
    return a.numero.localeCompare(b.numero);
  });

  return (
    <table className="tabla-analisis">
      <thead>
        <tr>
          <th>Terminación</th>
          <th>Última</th>
          <th>Penúltima</th>
          <th>Tercera</th>
          <th>Antepenúltima</th>
          <th className="col-frecuencia">Veces que cae</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => {
          const coincideNumero =
            coincideTexto(fila.numero, busqueda) ||
            coincideTexto(fila.ultima?.numero_completo, busqueda) ||
            coincideTexto(fila.penultima?.numero_completo, busqueda) ||
            coincideTexto(fila.tercera?.numero_completo, busqueda) ||
            coincideTexto(fila.antepenultima?.numero_completo, busqueda);

          const coincideFecha =
            coincideTexto(formatearFecha(fila.ultima?.fecha), busquedaFecha) ||
            coincideTexto(formatearFecha(fila.penultima?.fecha), busquedaFecha) ||
            coincideTexto(formatearFecha(fila.tercera?.fecha), busquedaFecha) ||
            coincideTexto(formatearFecha(fila.antepenultima?.fecha), busquedaFecha);

          const coincide = coincideNumero || coincideFecha;

          return (
            <tr key={fila.numero} className={coincide ? "fila-coincide" : ""}>
              <td className="terminacion celda-con-fila">
                <span className="fila-numero">{i + 1}</span>
                <Resaltado texto={fila.numero} busqueda={busqueda} />
              </td>
              <Celda dato={fila.ultima} busqueda={busqueda} busquedaFecha={busquedaFecha} />
              <Celda dato={fila.penultima} busqueda={busqueda} busquedaFecha={busquedaFecha} />
              <Celda dato={fila.tercera} busqueda={busqueda} busquedaFecha={busquedaFecha} />
              <Celda dato={fila.antepenultima} busqueda={busqueda} busquedaFecha={busquedaFecha} />
              <td className="frecuencia">{fila.veces_que_caen}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}