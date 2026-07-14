import { Activity, ChartNoAxesCombined, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatNumber } from "./format";
import { EmptyRows, Metric } from "./Shared";
import { SourceBanner } from "./SourceBanner";

export function DataQuality({ data }) {
  const quality = data.quality;
  return <section className="content dataQuality"><div className="intro"><div><h2>Qualidade dos dados <small>Calculada</small></h2><p>Ausência e zero são tratados como estados diferentes; nenhum zero é classificado automaticamente como falha.</p></div></div><SourceBanner data={data}/>
    <div className="metrics"><Metric icon={ShieldCheck} n={formatNumber(quality.complete_24h)} l="Grupos com 24 horas" s="Dia e TAG com cobertura completa"/><Metric icon={TriangleAlert} n={formatNumber(quality.partial_hours)} l="Cobertura parcial" s="Entre 1 e 23 horas" danger/><Metric icon={Activity} n={formatNumber(quality.hourly_without_daily)} l="Hourly sem Daily" s="Mantidos como granularidade independente"/><Metric icon={ChartNoAxesCombined} n={formatNumber(quality.zero_daily_with_hourly)} l="Daily zero com Hourly" s="Requer revisão; sem fallback automático"/></div>
    <div className="panel"><div className="title"><div><h3>Ocorrências registradas</h3><p>Contagens geradas durante a importação das planilhas reais.</p></div></div>{quality.issues.length ? <table><thead><tr><th>Regra</th><th>Severidade</th><th>Ocorrências</th></tr></thead><tbody>{quality.issues.map((row) => <tr key={`${row.issue_type}-${row.severity}`}><td>{row.issue_type}</td><td><mark className={row.severity === "warn" ? "warn" : ""}>{row.severity}</mark></td><td>{formatNumber(row.count)}</td></tr>)}</tbody></table> : <EmptyRows/>}</div>
  </section>;
}
