"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, ChartNoAxesCombined, Database, Factory, Gauge, LayoutDashboard,
  PanelLeftClose, Radio, Search, ShieldCheck, TriangleAlert, Waves,
} from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./data-quality.css";

const nav = [
  ["Visão geral", LayoutDashboard],
  ["Cadastros", Database],
  ["Qualidade dos dados", ChartNoAxesCombined],
  ["Desempenho MPFM", Gauge],
  ["Rastreabilidade", ShieldCheck],
];

const formatNumber = (value) => Number(value || 0).toLocaleString("pt-BR");
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
};

function App() {
  const [page, setPage] = useState("Visão geral");
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    let active = true;
    fetch("/api/portal-data", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || payload.status !== "ok") throw new Error(payload.error || "Base real indisponível.");
        if (active) setState({ loading: false, data: payload, error: "" });
      })
      .catch((error) => active && setState({ loading: false, data: null, error: error.message }));
    return () => { active = false; };
  }, []);

  const content = state.loading
    ? <DataState title="Consultando a base real" detail="Carregando cadastros, medições e rastreabilidade do D1." />
    : state.error
      ? <DataState title="Base real indisponível" detail={state.error} warning />
      : ({
          "Visão geral": <Overview data={state.data} />,
          "Cadastros": <Cadastros data={state.data} query={query} />,
          "Qualidade dos dados": <DataQuality data={state.data} />,
          "Desempenho MPFM": <Performance data={state.data} />,
          "Rastreabilidade": <Trace data={state.data} />,
        })[page];

  return <div className="app">
    <aside>
      <div className="brand"><span>e</span><div><b>SGM</b><small>Measurement management</small></div></div>
      <nav>{nav.map(([name, Icon]) => <button key={name} className={page === name ? "active" : ""} onClick={() => setPage(name)}><Icon size={19}/><span>{name}</span></button>)}</nav>
      <div className="asideFoot"><Activity size={18}/><div><b>Ambiente restrito</b><small>Somente fontes reais</small></div></div>
    </aside>
    <main>
      <header><div><h1>{page}</h1><p>Portal integrado do Sistema de Gestão de Medição</p></div><div className="search"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar TAG, poço ou arquivo"/></div><button className="icon" aria-label="Recolher menu"><PanelLeftClose size={20}/></button></header>
      {content}
    </main>
  </div>;
}

function SourceBanner({ data }) {
  const summary = data.measurements.summary;
  return <div className="sourceBanner"><div><span>Base operacional real</span><b>{formatNumber(summary.measurement_rows)} registros MPFM · {formatNumber(data.separator.rows)} registros do separador</b><small>Corte de {formatDate(summary.period_start)} a {formatDate(summary.period_end)} · {data.sources.length} fontes registradas</small></div><mark>Carregado</mark></div>;
}

function Overview({ data }) {
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

function Cadastros({ data, query }) {
  const [tab, setTab] = useState("Pontos");
  const points = useMemo(() => data.cadastros.measurementPoints.filter((row) => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase())), [data, query]);
  const wells = useMemo(() => data.cadastros.wells.filter((row) => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase())), [data, query]);
  return <section className="content"><div className="intro"><div><h2>Cadastros técnicos <small>Fonte controlada</small></h2><p>Registros lidos das exportações oficiais, sem complementos inferidos.</p></div></div><SourceBanner data={data}/>
    <div className="metrics"><Metric icon={Radio} n={formatNumber(data.cadastros.measurementPoints.length)} l="Pontos de medição" s="Pontos presentes na exportação carregada"/><Metric icon={Waves} n={formatNumber(data.cadastros.wells.length)} l="Poços" s="Cadastro ANP carregado"/><Metric icon={Database} n={formatNumber(data.sources.length)} l="Arquivos registrados" s="Hash e período preservados"/></div>
    <div className="tabs"><button className={tab === "Pontos" ? "on" : ""} onClick={() => setTab("Pontos")}>Pontos de medição</button><button className={tab === "Poços" ? "on" : ""} onClick={() => setTab("Poços")}>Poços</button><button className={tab === "Fontes" ? "on" : ""} onClick={() => setTab("Fontes")}>Fontes</button></div>
    <div className="panel">{tab === "Pontos" ? <table><thead><tr><th>TAG</th><th>Fluido</th><th>Tipo principal</th><th>Medidor</th><th>Localização</th><th>Ativo</th></tr></thead><tbody>{points.map((row) => <tr key={row.tag}><td><b>{row.tag}</b></td><td>{row.fluid || "—"}</td><td>{row.primary_measurement || "—"}</td><td>{row.meter_type || "—"}</td><td>{row.location || "—"}</td><td><mark className={row.active ? "" : "warn"}>{row.active ? "Sim" : "Não"}</mark></td></tr>)}</tbody></table> : tab === "Poços" ? <table><thead><tr><th>Código ANP</th><th>Poço ANP</th><th>Nome operador</th><th>Campo</th><th>Situação</th></tr></thead><tbody>{wells.map((row) => <tr key={row.anp_code}><td><b>{row.anp_code}</b></td><td>{row.anp_name || "—"}</td><td>{row.operator_name || "—"}</td><td>{row.field_name || "—"}</td><td>{row.status || "—"}</td></tr>)}</tbody></table> : <SourcesTable sources={data.sources}/>}</div>
  </section>;
}

function DataQuality({ data }) {
  const quality = data.quality;
  return <section className="content dataQuality"><div className="intro"><div><h2>Qualidade dos dados <small>Calculada</small></h2><p>Ausência e zero são tratados como estados diferentes; nenhum zero é classificado automaticamente como falha.</p></div></div><SourceBanner data={data}/>
    <div className="metrics"><Metric icon={ShieldCheck} n={formatNumber(quality.complete_24h)} l="Grupos com 24 horas" s="Dia e TAG com cobertura completa"/><Metric icon={TriangleAlert} n={formatNumber(quality.partial_hours)} l="Cobertura parcial" s="Entre 1 e 23 horas" danger/><Metric icon={Activity} n={formatNumber(quality.hourly_without_daily)} l="Hourly sem Daily" s="Mantidos como granularidade independente"/><Metric icon={ChartNoAxesCombined} n={formatNumber(quality.zero_daily_with_hourly)} l="Daily zero com Hourly" s="Requer revisão; sem fallback automático"/></div>
    <div className="panel"><div className="title"><div><h3>Ocorrências registradas</h3><p>Contagens geradas durante a importação das planilhas reais.</p></div></div>{quality.issues.length ? <table><thead><tr><th>Regra</th><th>Severidade</th><th>Ocorrências</th></tr></thead><tbody>{quality.issues.map((row) => <tr key={`${row.issue_type}-${row.severity}`}><td>{row.issue_type}</td><td><mark className={row.severity === "warn" ? "warn" : ""}>{row.severity}</mark></td><td>{formatNumber(row.count)}</td></tr>)}</tbody></table> : <EmptyRows/>}</div>
  </section>;
}

function Performance({ data }) {
  const hasAlignment = false;
  return <section className="content"><div className="intro"><div><h2>Desempenho MPFM <small>{hasAlignment ? "Calculado" : "Não avaliável"}</small></h2><p>Resultados de conformidade só serão emitidos após cadastro temporal do alinhamento MPFM–separador e validação da janela.</p></div></div><SourceBanner data={data}/>
    <div className="qualityNotice"><TriangleAlert/><div><b>Nenhum resultado oficial calculado</b><p>A base contém medições reais de MPFM e separador, mas não contém alinhamento temporal suficiente. O Portal não cria campanhas, desvios ou conformidades por inferência.</p></div></div>
    <div className="panel"><div className="title"><div><h3>Medições disponíveis para preparação</h3><p>Último dia carregado; estes valores ainda não constituem avaliação de desempenho.</p></div></div><MeasurementTable rows={data.measurements.latestByTag}/></div>
  </section>;
}

function Trace({ data }) {
  return <section className="content"><div className="intro"><div><h2>Rastreabilidade <small>Arquivo → registro</small></h2><p>Cada conjunto apresenta arquivo, tipo, período, quantidade e momento da carga.</p></div></div><SourceBanner data={data}/><div className="panel"><SourcesTable sources={data.sources}/></div></section>;
}

function MeasurementTable({ rows }) {
  return rows.length ? <table><thead><tr><th>TAG</th><th>Banco</th><th>Entidade</th><th>Data</th><th>Horas</th><th>Total Daily (t)</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.production_date}-${row.tag}`}><td><b>{row.tag}</b></td><td>{row.bank || "—"}</td><td>{row.entity || "—"}</td><td>{formatDate(row.production_date)}</td><td>{formatNumber(row.hours)}</td><td>{Number(row.daily_total_t || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td></tr>)}</tbody></table> : <EmptyRows/>;
}

function SourcesTable({ sources }) {
  return sources.length ? <table><thead><tr><th>Arquivo</th><th>Tipo</th><th>Aba</th><th>Período</th><th>Linhas</th><th>Carga</th></tr></thead><tbody>{sources.map((row) => <tr key={row.id}><td><b>{row.file_name}</b></td><td>{row.source_type}</td><td>{row.source_sheet || "—"}</td><td>{row.period_start ? `${formatDate(row.period_start)} – ${formatDate(row.period_end)}` : "Cadastro"}</td><td>{formatNumber(row.row_count)}</td><td>{String(row.imported_at || "").replace("T", " ").slice(0, 19)}</td></tr>)}</tbody></table> : <EmptyRows/>;
}

function DataState({ title, detail, warning = false }) {
  const Icon = warning ? TriangleAlert : Database;
  return <section className="content"><div className="qualityNotice"><Icon/><div><b>{title}</b><p>{detail}</p><p>Nenhum número demonstrativo será exibido no lugar dos dados ausentes.</p></div></div></section>;
}

const EmptyRows = () => <div className="qualityNotice"><Database/><div><b>Sem registros reais</b><p>Nenhum dado validado foi encontrado para esta seção.</p></div></div>;
const Metric = ({ n, l, s, icon: Icon, danger }) => <article className={`metric ${danger ? "danger" : ""}`}>{Icon && <div className="metricIcon"><Icon/></div>}<div><b>{l}</b><strong>{n}</strong><small>{s}</small></div></article>;

export default App;
