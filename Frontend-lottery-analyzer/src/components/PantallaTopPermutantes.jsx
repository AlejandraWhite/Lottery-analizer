import { useEffect, useState } from "react";
import { obtenerTopPermutantes } from "../api";
import { formatearFecha } from "../utils";
import "./PantallaTopPermutantes.css";

export default function PantallaTopPermutantes() {
  const [top, setTop] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerTopPermutantes(10)
      .then((data) => setTop(data.top))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <p className="cargando">Cargando...</p>;
  if (error) return <p className="formulario-error">{error}</p>;

  return (
    <div className="top-perm">
      <h3>Las 10 permutaciones que más han caído</h3>

      <div className="top-perm-lista">
        {top.map((g, i) => (
          <section key={g.grupo} className="top-perm-bloque">
            <header className="top-perm-cabecera">
              <span className="top-perm-puesto">{i + 1}</span>
              <span className="top-perm-grupo">{g.grupo}</span>
              <span className="top-perm-dato">
                <b>{g.cantidad}</b> veces
              </span>
              <span className="top-perm-dato">
                Última: <b>{formatearFecha(g.ultima_fecha)}</b>
              </span>
              <span className="top-perm-dato">
                Primera: <b>{formatearFecha(g.primera_fecha)}</b>
              </span>
            </header>

            <div className="top-perm-scroll">
              <table className="top-perm-tabla">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>Número</th>
                    <th>Lotería</th>
                  </tr>
                </thead>
                <tbody>
                  {g.apariciones.map((a, j) => (
                    <tr key={j}>
                      <td>{j + 1}</td>
                      <td>{formatearFecha(a.fecha)}</td>
                      <td className="top-perm-numero">{a.numero}</td>
                      <td>{a.loteria || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}