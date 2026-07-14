import { TriangleAlert } from "lucide-react";
import { SourceBanner } from "./SourceBanner";
import { MeasurementTable } from "./Tables";

export function Performance({ data }) {
  const hasAlignment = false;
  return <section className="content"><div className="intro"><div><h2>Desempenho MPFM <small>{hasAlignment ? "Calculado" : "Não avaliável"}</small></h2><p>Resultados de conformidade só serão emitidos após cadastro temporal do alinhamento MPFM–separador e validação da janela.</p></div></div><SourceBanner data={data}/>
    <div className="qualityNotice"><TriangleAlert/><div><b>Nenhum resultado oficial calculado</b><p>A base contém medições reais de MPFM e separador, mas não contém alinhamento temporal suficiente. O Portal não cria campanhas, desvios ou conformidades por inferência.</p></div></div>
    <div className="panel"><div className="title"><div><h3>Medições disponíveis para preparação</h3><p>Último dia carregado; estes valores ainda não constituem avaliação de desempenho.</p></div></div><MeasurementTable rows={data.measurements.latestByTag}/></div>
  </section>;
}
