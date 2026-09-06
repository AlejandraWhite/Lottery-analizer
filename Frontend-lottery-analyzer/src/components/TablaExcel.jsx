import { formatearFecha, esReciente } from "../utils";

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

function FilaUltima({ fila, onEliminar, cargando }) {
  const eliminable = esReciente(fila.creado_en);

  return (
    <tr>
      <td className="col-accion">
        {eliminable && (
          <IconoBasura onClick={() => onEliminar(fila.id)} disabled={cargando} />
        )}
      </td>
      <td>{formatearFecha(fila.fecha)}</td>
      <td className="num">{fila.numero_completo}</td>
      <td className="num">{fila.terminacion}</td>
      <td className="num">{fila.cantidad}</td>
    </tr>
  );
}

function Fila({ fila }) {
  return (
    <tr>
      <td>{formatearFecha(fila.fecha)}</td>
      <td className="num">{fila.numero_completo}</td>
      <td className="num">{fila.terminacion}</td>
    </tr>
  );
}

export default function TablaExcel({ vista, onEliminar, cargando }) {
  if (!vista) return null;

  const maxCantidad = Math.max(...vista.tabla_amarilla.map((f) => f.cantidad), 1);

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
              {vista.grupo_a.map((fila) => (
                <FilaUltima
                  key={fila.id}
                  fila={fila}
                  onEliminar={onEliminar}
                  cargando={cargando}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="columna-grupo">
        <h3>Penúltima</h3>
        <div className="tabla-scroll">
          <table className="tabla-grupo">
            <thead>
              <tr><th>Fecha</th><th>Número</th><th>#</th></tr>
            </thead>
            <tbody>
              {vista.grupo_b.map((fila, i) => <Fila key={i} fila={fila} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="columna-grupo">
        <h3>Tercera</h3>
        <div className="tabla-scroll">
          <table className="tabla-grupo">
            <thead>
              <tr><th>Fecha</th><th>Número</th><th>#</th></tr>
            </thead>
            <tbody>
              {vista.grupo_c.map((fila, i) => <Fila key={i} fila={fila} />)}
            </tbody>
          </table>
        </div>
      </div>

            <div className="columna-grupo columna-amarilla">
        <h3>Resumen</h3>
        <div className="tabla-scroll">
          <ol className="ranking">
            {vista.tabla_amarilla.map((fila) => (
              <li key={fila.terminacion} className="ranking-fila">
                <span className="ranking-num">{fila.terminacion}</span>
                <span className="ranking-barra-fondo">
                  <span
                    className="ranking-barra"
                    style={{ width: `${(fila.cantidad / maxCantidad) * 100}%` }}
                  />
                </span>
                <span className="ranking-cant">{fila.cantidad}</span>
              </li>
            ))}
          </ol>
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
              {vista.grupo_d.map((fila, i) => <Fila key={i} fila={fila} />)}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}