import { useMemo, useState } from "react";
import { Database, Radio, Waves } from "lucide-react";
import { formatNumber } from "./format";
import { Metric } from "./Shared";
import { SourceBanner } from "./SourceBanner";
import { SourcesTable } from "./Tables";

export function Cadastros({ data, query }) {
  const [tab, setTab] = useState("Pontos");
  const points = useMemo(() => data.cadastros.measurementPoints.filter((row) => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase())), [data, query]);
  const wells = useMemo(() => data.cadastros.wells.filter((row) => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase())), [data, query]);
  return <section className="content"><div className="intro"><div><h2>Cadastros técnicos <small>Fonte controlada</small></h2><p>Registros lidos das exportações oficiais, sem complementos inferidos.</p></div></div><SourceBanner data={data}/>
    <div className="metrics"><Metric icon={Radio} n={formatNumber(data.cadastros.measurementPoints.length)} l="Pontos de medição" s="Pontos presentes na exportação carregada"/><Metric icon={Waves} n={formatNumber(data.cadastros.wells.length)} l="Poços" s="Cadastro ANP carregado"/><Metric icon={Database} n={formatNumber(data.sources.length)} l="Arquivos registrados" s="Hash e período preservados"/></div>
    <div className="tabs"><button className={tab === "Pontos" ? "on" : ""} onClick={() => setTab("Pontos")}>Pontos de medição</button><button className={tab === "Poços" ? "on" : ""} onClick={() => setTab("Poços")}>Poços</button><button className={tab === "Fontes" ? "on" : ""} onClick={() => setTab("Fontes")}>Fontes</button></div>
    <div className="panel">{tab === "Pontos" ? <table><thead><tr><th>TAG</th><th>Fluido</th><th>Tipo principal</th><th>Medidor</th><th>Localização</th><th>Ativo</th></tr></thead><tbody>{points.map((row) => <tr key={row.tag}><td><b>{row.tag}</b></td><td>{row.fluid || "—"}</td><td>{row.primary_measurement || "—"}</td><td>{row.meter_type || "—"}</td><td>{row.location || "—"}</td><td><mark className={row.active ? "" : "warn"}>{row.active ? "Sim" : "Não"}</mark></td></tr>)}</tbody></table> : tab === "Poços" ? <table><thead><tr><th>Código ANP</th><th>Poço ANP</th><th>Nome operador</th><th>Campo</th><th>Situação</th></tr></thead><tbody>{wells.map((row) => <tr key={row.anp_code}><td><b>{row.anp_code}</b></td><td>{row.anp_name || "—"}</td><td>{row.operator_name || "—"}</td><td>{row.field_name || "—"}</td><td>{row.status || "—"}</td></tr>)}</tbody></table> : <SourcesTable sources={data.sources}/>}</div>
  </section>;
}
