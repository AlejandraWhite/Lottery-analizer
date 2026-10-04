import { terminosBusqueda } from "../utils";

export default function Resaltado({ texto, busqueda, modo = "cualquiera" }) {
  const str = String(texto ?? "");
  const terminos = terminosBusqueda(busqueda);
  if (terminos.length === 0) return str;

  const bajo = str.toLowerCase();
  const rangos = [];

  for (const t of terminos) {
    const pat = t.toLowerCase();
    if (modo === "ultimas2") {
      if (bajo.endsWith(pat)) rangos.push([str.length - pat.length, str.length]);
    } else {
      let i = bajo.indexOf(pat);
      while (i !== -1) {
        rangos.push([i, i + pat.length]);
        i = bajo.indexOf(pat, i + pat.length);
      }
    }
  }

  if (rangos.length === 0) return str;

  // ordenar y fusionar rangos solapados
  rangos.sort((a, b) => a[0] - b[0]);
  const fusionados = [[...rangos[0]]];
  for (const [ini, fin] of rangos.slice(1)) {
    const ult = fusionados[fusionados.length - 1];
    if (ini <= ult[1]) ult[1] = Math.max(ult[1], fin);
    else fusionados.push([ini, fin]);
  }

  const partes = [];
  let cursor = 0;
  fusionados.forEach(([ini, fin], k) => {
    if (ini > cursor) partes.push(str.slice(cursor, ini));
    partes.push(
      <mark key={k} className="resaltado">{str.slice(ini, fin)}</mark>
    );
    cursor = fin;
  });
  if (cursor < str.length) partes.push(str.slice(cursor));

  return <>{partes}</>;
}