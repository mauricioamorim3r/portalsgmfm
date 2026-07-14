import { Database, TriangleAlert } from "lucide-react";

export function DataState({ title, detail, warning = false }) {
  const Icon = warning ? TriangleAlert : Database;
  return <section className="content"><div className="qualityNotice"><Icon/><div><b>{title}</b><p>{detail}</p><p>Nenhum número demonstrativo será exibido no lugar dos dados ausentes.</p></div></div></section>;
}

export const EmptyRows = () => <div className="qualityNotice"><Database/><div><b>Sem registros reais</b><p>Nenhum dado validado foi encontrado para esta seção.</p></div></div>;

export const Metric = ({ n, l, s, icon: Icon, danger }) => <article className={`metric ${danger ? "danger" : ""}`}>{Icon && <div className="metricIcon"><Icon/></div>}<div><b>{l}</b><strong>{n}</strong><small>{s}</small></div></article>;
