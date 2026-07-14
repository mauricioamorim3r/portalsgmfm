import { Database, Factory, Radio, TriangleAlert } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatNumber } from "./format";
import { EmptyRows, Metric } from "./Shared";
import { SourceBanner } from "./SourceBanner";
import { MeasurementTable } from "./Tables";

export function Overview({ data }) {
  const { summary, dailyTrend, latestByTag } = data.measurements;
  return <section className="content overview">
    <div className="intro"><div><h2>Visão geral <small>Dados importados</small></h2><p>Indicadores calculados exclusivamente sobre os arquivos rastreados na base.</p></div></div>
    <SourceBanner data={data}/>
    <div className="metrics">
      <Metric icon={Database} n={formatNumber(summary.measurement_rows)} l="Registros MPFM" s={`${formatNumber(summary.hourly_rows)} horários · ${formatNumber(summary.daily_rows)} diários`}/>
      <Metric icon={Radio} n={formatNumber(summary.measured_tags)} l="TAGs com medição" s={`Último dia: ${formatDate(summary.period_end)}`}/>
      <Metric icon={Factory} n={formatNumber(data.separator.days)} l="Dias de separador" s={`${formatNumber(data.separator.rows)} linhas · ${formatNumber(data.separator.phases)} fases`}/>
      <Metric icon={TriangleAlert} n={formatNumber(data.quality.partial_hours)} l="Dias/TAG parciais" s="Cobertura entre 1 e 23 horas" danger={Number(data.quality.partial_hours) > 0}/>
    </div>
    <div className="dashGrid">
      <article className="chart"><div className="title"><div><h3>Produção diária registrada</h3><p>Massas oficiais encontradas nas linhas Daily, sem substituição por Hourly.</p></div></div>
        {dailyTrend.length ? <ResponsiveContainer width="100%" height={250}><LineChart data={dailyTrend}><CartesianGrid stroke="#e8ebef" vertical={false}/><XAxis dataKey="day" tickFormatter={(v) => formatDate(v).slice(0, 5)} fontSize={10}/><YAxis fontSize={10}/><Tooltip labelFormatter={formatDate}/><Legend/><Line type="monotone" dataKey="oil_t" name="Óleo (t)" stroke="#ff1243" dot={false}/><Line type="monotone" dataKey="gas_t" name="Gás (t)" stroke="#315f9b" dot={false}/><Line type="monotone" dataKey="water_t" name="Água (t)" stroke="#00a6a6" dot={false}/></LineChart></ResponsiveContainer> : <EmptyRows/>}
      </article>
      <article className="panel"><div className="title"><div><h3>Último dia por TAG</h3><p>Daily e cobertura horária permanecem identificados separadamente.</p></div></div><MeasurementTable rows={latestByTag}/></article>
    </div>
  </section>;
}
