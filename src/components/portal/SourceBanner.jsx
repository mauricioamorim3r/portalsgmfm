import { formatDate, formatNumber } from "./format";

export function SourceBanner({ data }) {
  const summary = data.measurements.summary;
  return <div className="sourceBanner"><div><span>Base operacional real</span><b>{formatNumber(summary.measurement_rows)} registros MPFM · {formatNumber(data.separator.rows)} registros do separador</b><small>Corte de {formatDate(summary.period_start)} a {formatDate(summary.period_end)} · {data.sources.length} fontes registradas</small></div><mark>Carregado</mark></div>;
}
