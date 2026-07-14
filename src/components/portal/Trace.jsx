import { SourceBanner } from "./SourceBanner";
import { SourcesTable } from "./Tables";

export function Trace({ data }) {
  return <section className="content"><div className="intro"><div><h2>Rastreabilidade <small>Arquivo → registro</small></h2><p>Cada conjunto apresenta arquivo, tipo, período, quantidade e momento da carga.</p></div></div><SourceBanner data={data}/><div className="panel"><SourcesTable sources={data.sources}/></div></section>;
}
