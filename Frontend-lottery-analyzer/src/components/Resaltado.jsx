export default function Resaltado({ texto, busqueda, modo = "cualquiera" }) {
  const str = String(texto ?? "");
  if (!busqueda) return str;

  let idx;

  if (modo === "ultimas2") {
    // Solo coincide si el patrón está pegado al final del número
    const inicio = str.length - busqueda.length;
    const coincideAlFinal =
      inicio >= 0 && str.slice(inicio).toLowerCase() === busqueda.toLowerCase();
    idx = coincideAlFinal ? inicio : -1;
  } else {
    idx = str.toLowerCase().indexOf(busqueda.toLowerCase());
  }

  if (idx === -1) return str;

  return (
    <>
      {str.slice(0, idx)}
      <mark className="resaltado">{str.slice(idx, idx + busqueda.length)}</mark>
      {str.slice(idx + busqueda.length)}
    </>
  );
}