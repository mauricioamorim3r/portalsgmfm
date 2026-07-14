import { formatDate, formatNumber } from "./format";
import { EmptyRows } from "./Shared";

export function MeasurementTable({ rows }) {
  return rows.length ? <table><thead><tr><th>TAG</th><th>Banco</th><th>Entidade</th><th>Data</th><th>Horas</th><th>Total Daily (t)</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.production_date}-${row.tag}`}><td><b>{row.tag}</b></td><td>{row.bank || "—"}</td><td>{row.entity || "—"}</td><td>{formatDate(row.production_date)}</td><td>{formatNumber(row.hours)}</td><td>{Number(row.daily_total_t || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td></tr>)}</tbody></table> : <EmptyRows/>;
}

export function SourcesTable({ sources }) {
  return sources.length ? <table><thead><tr><th>Arquivo</th><th>Tipo</th><th>Aba</th><th>Período</th><th>Linhas</th><th>Carga</th></tr></thead><tbody>{sources.map((row) => <tr key={row.id}><td><b>{row.file_name}</b></td><td>{row.source_type}</td><td>{row.source_sheet || "—"}</td><td>{row.period_start ? `${formatDate(row.period_start)} – ${formatDate(row.period_end)}` : "Cadastro"}</td><td>{formatNumber(row.row_count)}</td><td>{String(row.imported_at || "").replace("T", " ").slice(0, 19)}</td></tr>)}</tbody></table> : <EmptyRows/>;
}
