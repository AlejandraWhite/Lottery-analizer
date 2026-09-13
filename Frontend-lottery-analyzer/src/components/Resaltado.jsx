export default function Resaltado({ texto, busqueda }) {
  const str = String(texto ?? "");
  if (!busqueda) return str;

  const idx = str.toLowerCase().indexOf(busqueda.toLowerCase());
  if (idx === -1) return str;

  return (
    <>
      {str.slice(0, idx)}
      <mark className="resaltado">{str.slice(idx, idx + busqueda.length)}</mark>
      {str.slice(idx + busqueda.length)}
    </>
  );
}