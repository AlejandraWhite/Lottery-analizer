import { useEffect, useState } from "react";
import {
  importarHistorico4,
  listarHistorico4,
  obtenerResumenHistorico4,
  sincronizarHistorico4,
} from "../api";
import Resaltado from "./Resaltado";

const TAMANO_PAGINA = 100;

// dd/mm/yyyy a partir de "yyyy-mm-dd" (o "yyyy-mm-ddT..."), sin pasar por
// Date para evitar desfases de zona horaria
function formatearFecha(iso) {
  if (!iso) return "—";
  const [anio, mes, dia] = String(iso).slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearExtras(extras) {
  if (!extras) return "";
  return Object.entries(extras)
    .map(([columna, valor]) => `${columna}: ${valor}`)
    .join("  ·  ");
}

export default function PantallaHistorico4({ busqueda, busquedaFecha, modoBusqueda }) {
  const [resumen, setResumen] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [conObservaciones, setConObservaciones] = useState([]);
  const [reemplazar, setReemplazar] = useState(false);
  const [tieneEncabezado, setTieneEncabezado] = useState(false);
  const [recarga, setRecarga] = useState(0);

  // Al cambiar cualquier filtro global, volver a la primera página
  useEffect(() => {
    setPagina(0);
  }, [busqueda, busquedaFecha, modoBusqueda]);

  // Resumen (total y rango de fechas)
  useEffect(() => {
    obtenerResumenHistorico4()
      .then(setResumen)
      .catch((e) => setMensaje(e.message));
  }, [recarga]);

  // Listado paginado, filtrado en el servidor (con un pequeño debounce)
  useEffect(() => {
    let cancelado = false;

    const temporizador = setTimeout(async () => {
      setCargando(true);
      try {
        const data = await listarHistorico4({
          limite: TAMANO_PAGINA,
          offset: pagina * TAMANO_PAGINA,
          numero: busqueda,
          fecha: busquedaFecha,
          modo: modoBusqueda,
        });
        if (cancelado) return;
        setItems(data.items);
        setTotal(data.total);
      } catch (e) {
        if (!cancelado) setMensaje(e.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [pagina, busqueda, busquedaFecha, modoBusqueda, recarga]);

  async function manejarArchivo(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    if (
      reemplazar &&
      !window.confirm(
        "Esto borra TODO el histórico de 4 cifras (incluidos los números agregados " +
          "automáticamente) y lo carga de nuevo desde el Excel. ¿Continuar?"
      )
    ) {
      evento.target.value = "";
      return;
    }

    setCargando(true);
    setMensaje("");
    setConObservaciones([]);

    try {
      const data = await importarHistorico4(archivo, {
        reemplazar,
        filaInicial: tieneEncabezado ? 2 : 1,
      });
      setMensaje(data.mensaje);
      setConObservaciones(data.con_observaciones || []);
      setReemplazar(false);
      setPagina(0);
      setRecarga((r) => r + 1);
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setCargando(false);
      evento.target.value = "";
    }
  }

  async function manejarSincronizar() {
  setCargando(true);
  setMensaje("");
  try {
    const data = await sincronizarHistorico4();
    setMensaje(data.mensaje);
    setRecarga((r) => r + 1);
  } catch (e) {
    setMensaje(e.message);
  } finally {
    setCargando(false);
  }
}

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const offset = pagina * TAMANO_PAGINA;

  return (
    <div className="historico4">
      <div className="barra-superior barra-historico4">
        <label className="subir-archivo">
          Subir Excel histórico (4 cifras)
          <input
            type="file"
            accept=".xlsx,.xlsm,.xltx,.xltm"
            onChange={manejarArchivo}
          />
        </label>

    <button onClick={manejarSincronizar} disabled={cargando}>
            Sincronizar con resultados nuevos
    </button>

        <label>
          <input
            type="checkbox"
            checked={tieneEncabezado}
            onChange={(e) => setTieneEncabezado(e.target.checked)}
          />{" "}
          La fila 1 es encabezado
        </label>

        <label>
          <input
            type="checkbox"
            checked={reemplazar}
            onChange={(e) => setReemplazar(e.target.checked)}
          />{" "}
          Reemplazar el histórico existente
        </label>
      </div>

      {mensaje && <p className="mensaje">{mensaje}</p>}
      {cargando && <p className="cargando">Cargando...</p>}

      {conObservaciones.length > 0 && (
        <details className="omitidas-historico4">
          <summary>Filas guardadas con observaciones ({conObservaciones.length})</summary>
          <ul>
            {conObservaciones.map((o, i) => (
              <li key={i}>
                Fila {o.fila_excel}: {o.observacion}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="vista-excel vista-historico4">
        <div className="columna-grupo columna-historico4">
          <h3>
            Histórico 4 cifras
            {resumen && (
              <span className="resumen-historico4">
                {" "}
                · {resumen.total.toLocaleString("es-CO")} números
                {resumen.primera_fecha &&
                  ` · ${formatearFecha(resumen.primera_fecha)} → ${formatearFecha(resumen.ultima_fecha)}`}
              </span>
            )}
          </h3>

          <div className="tabla-scroll">
            <table className="tabla-grupo">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Número</th>
                  <th>#</th>
                  <th>Lotería</th>
                  <th>Columnas D–J</th>
                </tr>
              </thead>
              <tbody>
                {items.map((fila, i) => {
                  const fechaFormateada = formatearFecha(fila.fecha);
                  const terminacion = fila.numero ? fila.numero.slice(-2) : "";
                  // Numeración cronológica: el más antiguo es el 1, el más nuevo el total
                  const posicion = total - offset - i;

                  return (
                    <tr key={fila.id} className={fila.observacion ? "fila-observacion" : ""}>
                      <td className="celda-con-fila">
                        <span className="fila-numero">{posicion}</span>
                        <Resaltado texto={fechaFormateada} busqueda={busquedaFecha} />
                        {fila.observacion && (
                          <span className="marca-observacion" title={fila.observacion}>
                            ⚠
                          </span>
                        )}
                      </td>
                      <td className="num">
                        <Resaltado texto={fila.numero || "—"} busqueda={busqueda} modo={modoBusqueda} />
                      </td>
                      <td className="num">
                        <Resaltado texto={terminacion} busqueda={busqueda} modo={modoBusqueda} />
                      </td>
                      <td>{fila.loteria || ""}</td>
                      <td className="celda-extras">{formatearExtras(fila.columnas_extra)}</td>
                    </tr>
                  );
                })}
                {!cargando && items.length === 0 && (
                  <tr>
                    <td colSpan={5}>Sin resultados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="paginacion-historico4">
            <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0}>
              ← Anterior
            </button>
            <span>
              Página {pagina + 1} de {totalPaginas} · {total.toLocaleString("es-CO")} resultados
            </span>
            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
              disabled={pagina >= totalPaginas - 1}
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}