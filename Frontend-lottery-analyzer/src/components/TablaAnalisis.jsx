import { formatearFecha } from "../utils";

function Celda({ dato }) {
  if (!dato) {
    return <td className="celda celda-vacia">—</td>;
  }

  return (
    <td className="celda celda-ocupada">
      <div className="celda-fecha">{formatearFecha(dato.fecha)}</div>
      <div className="celda-numero">{dato.numero_completo}</div>
    </td>
  );
}

export default function TablaAnalisis({ datos, orden }) {
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
          <th className="col-frecuencia">Veces que cae</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.numero}>
            <td className="terminacion">{fila.numero}</td>
            <Celda dato={fila.ultima} />
            <Celda dato={fila.penultima} />
            <Celda dato={fila.tercera} />
            <td className="frecuencia">{fila.veces_que_caen}</td>
          </tr>
        ))}
      </tbody>
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
  {filas.map((fila) => (
    <tr key={fila.numero}>
      <td className="terminacion">{fila.numero}</td>
      <Celda dato={fila.ultima} />
      <Celda dato={fila.penultima} />
      <Celda dato={fila.tercera} />
      <Celda dato={fila.antepenultima} />
      <td className="frecuencia">{fila.veces_que_caen}</td>
    </tr>
  ))}
</tbody>
    </table>
  );
}