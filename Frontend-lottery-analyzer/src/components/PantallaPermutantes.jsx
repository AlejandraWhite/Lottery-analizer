import { useEffect, useMemo, useState } from "react";
import { obtenerConteosPermutantes } from "../api";
import "./PantallaPermutantes.css";

// El 0 vale como el mayor (10) para el orden
const valor = (d) => (d === 0 ? 10 : d);
const MAX_PERMUTACIONES = 24; // 4! = máximo de permutaciones distintas

function generarGrupos() {
  const grupos = [];
  for (let a = 1; a <= 10; a++)
    for (let b = a; b <= 10; b++)
      for (let c = b; c <= 10; c++)
        for (let d = c; d <= 10; d++) {
          grupos.push([a, b, c, d].map((v) => v % 10)); // 10 -> 0
        }
  return grupos;
}

function permutacionesUnicas(digitos) {
  const resultado = new Set();
  const usar = (resto, actual) => {
    if (resto.length === 0) {
      resultado.add(actual.join(""));
      return;
    }
    resto.forEach((d, i) => {
      usar([...resto.slice(0, i), ...resto.slice(i + 1)], [...actual, d]);
    });
  };
  usar(digitos, []);
  return [...resultado].sort((x, y) => {
    for (let i = 0; i < 4; i++) {
      const diff = valor(Number(x[i])) - valor(Number(y[i]));
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

function grupoCoincide(digitos, busqueda) {
  if (!busqueda) return true;
  const disponibles = [...digitos];
  for (const ch of busqueda) {
    const idx = disponibles.indexOf(Number(ch));
    if (idx === -1) return false;
    disponibles.splice(idx, 1);
  }
  return true;
}

export default function PantallaPermutantes({ busqueda }) {
  const [conteos, setConteos] = useState({});
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerConteosPermutantes()
      .then((data) => {
        setConteos(data.conteos);
        setTotalHistorico(data.total);
      })
      .catch((e) => setError(e.message));
  }, []);

  const grupos = useMemo(
    () =>
      generarGrupos().map((digitos) => {
        const permutaciones = permutacionesUnicas(digitos);
        const cantidad = permutaciones.reduce((s, p) => s + (conteos[p] || 0), 0);
        return { digitos, etiqueta: digitos.join(""), permutaciones, cantidad };
      }),
    [conteos]
  );

  const visibles = grupos.filter((g) => grupoCoincide(g.digitos, busqueda));
  const columnasPerm = Array.from({ length: MAX_PERMUTACIONES });

  return (
    <div className="permutantes">
      <h3>
        Permutantes de 4 cifras ({visibles.length} de {grupos.length})
      </h3>
      <p>
        Ordenados de menor a mayor, con el 0 como el mayor. Basado en{" "}
        {totalHistorico.toLocaleString()} números del histórico.
      </p>
      {error && <p className="formulario-error">{error}</p>}

      <div className="tabla-scroll">
        <table className="tabla-permutantes">
          <thead>
            <tr>
              <th className="col-fija col-1">#</th>
              <th className="col-fija col-2">Grupo</th>
              <th className="col-fija col-3">Combinaciones</th>
              <th className="col-fija col-4">Cantidad</th>
              {columnasPerm.map((_, i) => (
                <th key={i}>{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((g, i) => (
              <tr key={g.etiqueta}>
                <td className="col-fija col-1">{i + 1}</td>
                <td className="col-fija col-2 perm-grupo">{g.etiqueta}</td>
                <td className="col-fija col-3">{g.permutaciones.length}</td>
                <td className="col-fija col-4 perm-cantidad">{g.cantidad}</td>
                {columnasPerm.map((_, j) => {
                  const p = g.permutaciones[j];
                  return (
                    <td key={j} className={p ? "perm-celda" : "perm-celda perm-vacia"}>
                      {p ?? ""}
                      {p && <span className="perm-veces">{conteos[p] || 0}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}