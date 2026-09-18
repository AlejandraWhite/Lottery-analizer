import { useState } from "react";
import { formatearFecha, esReciente } from "../utils";
import Resaltado from "./Resaltado";

function coincideTexto(valor, patron, modo = "cualquiera") {
  if (!patron) return false;
  const str = String(valor ?? "").toLowerCase();
  const pat = patron.toLowerCase();

  if (modo === "ultimas2") {
    return str.endsWith(pat);
  }
  return str.includes(pat);
}

function IconoBasura({ onClick, disabled }) {
  return (
    <button
      type="button"
      className="btn-basura"
      onClick={onClick}
      disabled={disabled}
      title="Eliminar y revertir"
      aria-label="Eliminar y revertir"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  );
}

function FilaUltima({
  fila,
  onEliminar,
  cargando,
  busqueda,
  busquedaFecha,
  modoBusqueda,
  numero,
  activa,
  onClickNumero,
}) {
  const eliminable = esReciente(fila.creado_en);
  const fechaFormateada = formatearFecha(fila.fecha);
  const coincide =
    coincideTexto(fila.terminacion, busqueda, modoBusqueda) ||
    coincideTexto(fila.numero_completo, busqueda, modoBusqueda) ||
    coincideTexto(fechaFormateada, busquedaFecha);

  const mostrarPapelera = activa && eliminable;

  return (
    <tr
      className={`${coincide ? "fila-coincide" : ""} ${mostrarPapelera ? "fila-activa" : ""} ${eliminable ? "fila-eliminable" : ""}`}
      onClick={eliminable ? onClickNumero : undefined}
    >
      <td className="col-accion">
        {mostrarPapelera && (
          <IconoBasura
            onClick={(e) => {
              e.stopPropagation(); // evita que el clic en la papelera dispare también el onClick de la fila
              onEliminar(fila.id);
            }}
            disabled={cargando}
          />
        )}
      </td>
      <td className="celda-con-fila">
        <span className="fila-numero">{numero}</span>
        <Resaltado texto={fechaFormateada} busqueda={busquedaFecha} />
      </td>
      <td className="num">
        <Resaltado texto={fila.numero_completo} busqueda={busqueda} modo={modoBusqueda} />
      </td>
      <td className="num">
        <Resaltado texto={fila.terminacion} busqueda={busqueda} modo={modoBusqueda} />
      </td>
      <td className="num">{fila.cantidad}</td>
    </tr>
  );
}

function Fila({ fila, busqueda, busquedaFecha, modoBusqueda, numero }) {
  const fechaFormateada = formatearFecha(fila.fecha);
  const coincide =
    coincideTexto(fila.terminacion, busqueda, modoBusqueda) ||
    coincideTexto(fila.numero_completo, busqueda, modoBusqueda) ||
    coincideTexto(fechaFormateada, busquedaFecha);

  return (
    <tr className={coincide ? "fila-coincide" : ""}>
      <td className="celda-con-fila">
        <span className="fila-numero">{numero}</span>
        <Resaltado texto={fechaFormateada} busqueda={busquedaFecha} />
      </td>
      <td className="num">
        <Resaltado texto={fila.numero_completo} busqueda={busqueda} modo={modoBusqueda} />
      </td>
      <td className="num">
        <Resaltado texto={fila.terminacion} busqueda={busqueda} modo={modoBusqueda} />
      </td>
    </tr>
  );
}

export default function TablaExcel({
  vista,
  onEliminar,
  cargando,
  busqueda,
  busquedaFecha,
  modoBusqueda = "cualquiera",
}) {
  const [filaActivaId, setFilaActivaId] = useState(null);

  if (!vista) return null;

  const maxCantidad = Math.max(...vista.tabla_amarilla.map((f) => f.cantidad), 1);

  function manejarClickNumero(fila) {
    if (!esReciente(fila.creado_en)) return;
    setFilaActivaId((actual) => (actual === fila.id ? null : fila.id));
  }

  function manejarEliminarClick(id) {
    setFilaActivaId(null);
    onEliminar(id);
  }

  return (
    <div className="vista-excel">
      <div className="columna-grupo">
        <h3>Última</h3>
        <div className="tabla-scroll">
          <table className="tabla-grupo">
            <thead>
              <tr><th></th><th>Fecha</th><th>Número</th><th>#</th><th>Cant</th></tr>
            </thead>
            <tbody>
              {vista.grupo_a.map((fila, i) => (
                <FilaUltima
                  key={fila.id}
                  fila={fila}
                  onEliminar={manejarEliminarClick}
                  cargando={cargando}
                  busqueda={busqueda}
                  busquedaFecha={busquedaFecha}
                  modoBusqueda={modoBusqueda}
                  numero={i + 1}
                  activa={filaActivaId === fila.id}
                  onClickNumero={() => manejarClickNumero(fila)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="columna-grupo">
        <h3>Penúltima cronologico</h3>
        <div className="tabla-scroll">
          <table className="tabla-grupo">
            <thead>
              <tr><th>Fecha</th><th>Número</th><th>#</th></tr>
            </thead>
            <tbody>
              {vista.grupo_b.map((fila, i) => (
                <Fila
                  key={i}
                  fila={fila}
                  busqueda={busqueda}
                  busquedaFecha={busquedaFecha}
                  modoBusqueda={modoBusqueda}
                  numero={i + 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="columna-grupo">
        <h3>Penultima</h3>
        <div className="tabla-scroll">
          <table className="tabla-grupo">
            <thead>
              <tr><th>Fecha</th><th>Número</th><th>#</th></tr>
            </thead>
            <tbody>
              {vista.grupo_c.map((fila, i) => (
                <Fila
                  key={i}
                  fila={fila}
                  busqueda={busqueda}
                  busquedaFecha={busquedaFecha}
                  modoBusqueda={modoBusqueda}
                  numero={i + 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="columna-grupo">
        <h3>Antepenúltima</h3>
        <div className="tabla-scroll">
          <table className="tabla-grupo">
            <thead>
              <tr><th>Fecha</th><th>Número</th><th>#</th></tr>
            </thead>
            <tbody>
              {vista.grupo_d.map((fila, i) => (
                <Fila
                  key={i}
                  fila={fila}
                  busqueda={busqueda}
                  busquedaFecha={busquedaFecha}
                  modoBusqueda={modoBusqueda}
                  numero={i + 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="columna-grupo columna-amarilla">
        <h3>Resumen</h3>
        <div className="tabla-scroll">
          <ol className="ranking">
            {vista.tabla_amarilla.map((fila) => {
              const coincide = coincideTexto(fila.terminacion, busqueda, modoBusqueda);
              return (
                <li
                  key={fila.terminacion}
                  className={`ranking-fila${coincide ? " fila-coincide" : ""}`}
                >
                  <span className="ranking-num">
                    <Resaltado texto={fila.terminacion} busqueda={busqueda} modo={modoBusqueda} />
                  </span>
                  <span className="ranking-barra-fondo">
                    <span
                      className="ranking-barra"
                      style={{ width: `${(fila.cantidad / maxCantidad) * 100}%` }}
                    />
                  </span>
                  <span className="ranking-cant">{fila.cantidad}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}