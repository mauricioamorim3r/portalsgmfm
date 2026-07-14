"use client";

import { useEffect, useState } from "react";
import { Activity, PanelLeftClose, Search } from "lucide-react";
import "./data-quality.css";
import { nav } from "./nav";
import { DataState } from "./Shared";
import { Overview } from "./Overview";
import { Cadastros } from "./Cadastros";
import { DataQuality } from "./DataQuality";
import { Performance } from "./Performance";
import { Trace } from "./Trace";

function PortalApp() {
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

export default PortalApp;
