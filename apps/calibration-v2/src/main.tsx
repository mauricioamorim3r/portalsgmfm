import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Beaker,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  Download,
  Droplets,
  FileCheck2,
  FileSpreadsheet,
  Gauge,
  Home,
  Import,
  Menu,
  Plus,
  Save,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import "./styles.css";
import type { Campaign, Row, SeparatorRow, Condition } from "./types";
import { blankCampaign, blankRow, blankSeparatorRow } from "./types";
import { calculate, fmt, pct, numOrDash } from "./engine";
import {
  initDb,
  listCampaigns,
  loadCampaign,
  saveCampaign,
  deleteCampaign,
  setActive,
  getActive,
  exportDbBlob,
  importDbBlob,
} from "./db";
import {
  importCampaignTemplate,
  parseMpfmWindow,
  parseSeparatorWindow,
  mergeRowsByKey,
} from "./parsers";
import { exportCampaignExcel } from "./exporter";

const DEFAULT_ID = "MPFM-CAL-001";

function seedCampaign(): Campaign {
  const c = blankCampaign(DEFAULT_ID);
  c.revision = "Rev. 0";
  c.nature = "COMISSIONAMENTO";
  c.asset = "FPSO Bacalhau";
  c.well = "Riser P4 / PW-104DA";
  c.tag = "13FT0317";
  c.serial = "13-100060";
  c.reference = "Separador de Teste 20VA121";
  c.pb = 480;
  return c;
}

const nav = [
  ["Visão geral", Home],
  ["Campanha", ClipboardCheck],
  ["Importação", Import],
  ["MPFM", Gauge],
  ["Separador", Droplets],
  ["Laboratório/PVT", Beaker],
  ["Fatores K", SlidersHorizontal],
  ["Pós-K", Activity],
  ["Evidências", FileCheck2],
  ["Relatórios", BarChart3],
] as const;

function SparkChart({ rows, kind = "stability" }: { rows: Row[]; kind?: string }) {
  const data = rows.filter((r) => r.use);
  const W = 520,
    H = 188,
    pad = 26;
  if (!data.length) return <div className="empty">Sem dados para o gráfico.</div>;
  const vals = kind === "gvf" ? data.map((r) => r.gvf) : data.map((r) => r.p);
  const min = Math.min(...vals) * 0.98,
    max = Math.max(...vals) * 1.02;
  const points = vals
    .map(
      (v, i) =>
        `${pad + (i * (W - pad * 2)) / Math.max(vals.length - 1, 1)},${H - pad - ((v - min) * (H - pad * 2)) / (max - min || 1)}`
    )
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <g className="grid">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={pad} x2={W - pad} y1={pad + i * 42} y2={pad + i * 42} />
        ))}
      </g>
      <polyline points={points} fill="none" stroke="#0b2c5b" strokeWidth="3" />
    </svg>
  );
}

function CompareChart({ r }: { r: ReturnType<typeof calculate> }) {
  const items = [
    ["Óleo", r.asOil, r.refOil],
    ["Gás", r.asGas, r.refGas],
    ["HC", r.asHC, r.refHC],
    ["Total", r.asTotal, r.refTotal],
  ] as [string, number, number][];
  const max = Math.max(...items.flatMap((x) => [x[1], x[2]])) || 1;
  return (
    <div className="bar-chart">
      {items.map(([n, a, b]) => (
        <div className="bar-row" key={n}>
          <span>{n}</span>
          <div>
            <i style={{ width: `${(a / max) * 100}%` }} />
            <em style={{ width: `${(b / max) * 100}%` }} />
          </div>
          <strong>{b ? fmt(((a - b) / b) * 100, 1) : "—"}%</strong>
        </div>
      ))}
      <footer>
        <span>
          <b className="dot navy" />
          MPFM
        </span>
        <span>
          <b className="dot magenta" />
          Referência
        </span>
      </footer>
    </div>
  );
}

function Kpi({ label, value, limit, ok }: { label: string; value: string; limit: string; ok: boolean }) {
  return (
    <div className="kpi">
      <small>{label}</small>
      <strong className={ok ? "positive" : "negative"}>{value}</strong>
      <span>{limit}</span>
      {ok ? <CheckCircle2 /> : <AlertTriangle />}
    </div>
  );
}
function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`panel ${className}`}>
      <header>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button>
          <ChevronRight />
        </button>
      </header>
      {children}
    </article>
  );
}

/* ============= Overview ============= */
function Overview({
  c,
  r,
  setDrawer,
}: {
  c: Campaign;
  r: ReturnType<typeof calculate>;
  setDrawer: (v: boolean) => void;
}) {
  return (
    <div className="page" data-testid="overview-page">
      <div className="title-row">
        <div>
          <h1>MPFM Performance &amp; Calibration</h1>
          <p>Campanha controlada, decisão metrológica e rastreabilidade end-to-end.</p>
        </div>
        <button className="primary" onClick={() => setDrawer(true)} data-testid="edit-campaign-btn">
          Editar campanha
        </button>
      </div>
      <div className="steps">
        {["Dados e importação", "Verificações iniciais", "Performance As-Found", "Pós-K e validação", "Aprovação técnica", "Emissão"].map(
          (s, i) => (
            <div className={i < 3 ? "done" : i === 3 ? "current" : ""} key={s}>
              <span>{i < 3 ? <Check size={15} /> : i + 1}</span>
              <b>{s}</b>
            </div>
          )
        )}
      </div>
      <div className="status-band">
        <div className={Math.abs(r.postDevHC) <= c.hcLimit ? "ok" : "bad"}>
          <CheckCircle2 />
          <span>
            Resultado técnico pós-K:<b>{Math.abs(r.postDevHC) <= c.hcLimit ? "ATENDE" : "NÃO ATENDE"}</b>
            <small>Comparação independente na P/T do MPFM.</small>
          </span>
        </div>
        <div className={r.issue ? "ok" : "bad"}>
          <ShieldAlert />
          <span>
            Prontidão de emissão:<b>{r.issue ? "APTA" : "BLOQUEADA"}</b>
            <small>{r.gates.filter((g) => !g[2]).length} pendências impedem o fechamento.</small>
          </span>
        </div>
      </div>
      <div className="kpis">
        <Kpi label="Desvio HC As-Found" value={pct(r.devHC)} limit={`Critério: ≤ ${fmt(c.hcLimit * 100, 0)}%`} ok={Math.abs(r.devHC) <= c.hcLimit} />
        <Kpi label="Desvio HC Pós-K" value={pct(r.postDevHC)} limit={`Critério: ≤ ${fmt(c.hcLimit * 100, 0)}%`} ok={Math.abs(r.postDevHC) <= c.hcLimit} />
        <Kpi label="En Pós-K" value={fmt(r.enPost, 3)} limit="Critério: ≤ 1,000" ok={r.enPost <= 1} />
        <Kpi label="K óleo calculado" value={fmt(r.kOil, 5)} limit="Base mássica equalizada" ok={r.kOil >= c.kMin && r.kOil <= c.kMax} />
      </div>
      <div className="dashboard-grid">
        <Panel title="MPFM × referência equalizada — As-Found" subtitle="Comparação em massa (t)">
          <CompareChart r={r} />
        </Panel>
        <Panel title="Estabilidade operacional — As-Found" subtitle="Pressão horária (barg)">
          <SparkChart rows={r.as} />
        </Panel>
        <Panel title="Matriz dos 16 gates" subtitle="O pior gate obrigatório prevalece" className="gates">
          <div className="gate-grid">
            {r.gates.map((g) => (
              <button key={g[0]} className={g[2] ? "pass" : "pending"} title={g[1]}>
                <span>{g[0]}</span>
                {g[2] ? <CheckCircle2 /> : <AlertTriangle />}
                <small>{g[1]}</small>
              </button>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="green" />
              Atende
            </span>
            <span>
              <i className="amber" />
              Pendente
            </span>
          </div>
        </Panel>
        <Panel title="Pendências prioritárias" subtitle="Ações necessárias para emissão">
          <div className="issues">
            {r.gates.filter((g) => !g[2]).slice(0, 6).map((g, i) => (
              <div key={g[0]}>
                <b>{i < 2 ? "Alta" : "Média"}</b>
                <span>
                  <strong>
                    {g[0]} — {g[1]}
                  </strong>
                  <small>Complete os dados requeridos para este gate.</small>
                </span>
                <em>Aberta</em>
              </div>
            ))}
            {r.gates.every((g) => g[2]) && <div style={{ color: "var(--green)", padding: 12 }}>Sem pendências. Campanha pronta para emissão.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============= Campanha ============= */
function CampanhaTab({
  c,
  update,
  updateEnvelope,
  save,
}: {
  c: Campaign;
  update: (k: keyof Campaign, v: any) => void;
  updateEnvelope: (axis: "p" | "t" | "dp" | "gvf" | "wlr", index: 0 | 1, value: number | null) => void;
  save: () => void;
}) {
  const field = (label: string, key: keyof Campaign, type: string = "text", unit = "") => (
    <label>
      <span>{label}</span>
      <div>
        <input
          type={type}
          value={String(c[key] ?? "")}
          onChange={(e) => update(key, type === "number" ? Number(e.target.value) : e.target.value)}
          data-testid={`campaign-field-${String(key)}`}
        />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  );
  const envField = (label: string, axis: "p" | "t" | "dp" | "gvf" | "wlr", unit: string) => (
    <label>
      <span>{label}</span>
      <div className="envelope-pair">
        <input
          type="number"
          placeholder="mín"
          value={c.envelope[axis][0] ?? ""}
          onChange={(e) => updateEnvelope(axis, 0, e.target.value === "" ? null : Number(e.target.value))}
        />
        <input
          type="number"
          placeholder="máx"
          value={c.envelope[axis][1] ?? ""}
          onChange={(e) => updateEnvelope(axis, 1, e.target.value === "" ? null : Number(e.target.value))}
        />
        <em>{unit}</em>
      </div>
    </label>
  );
  return (
    <div className="page" data-testid="campanha-page">
      <div className="title-row">
        <div>
          <h1>Campanha</h1>
          <p>Dados gerais, critérios e envelope operacional.</p>
        </div>
      </div>
      <div className="form">
        {field("Campaign ID", "id")}
        {field("Ativo / instalação", "asset")}
        {field("Poço / Riser", "well")}
        {field("TAG do MPFM", "tag")}
        {field("Número de série", "serial")}
        {field("Referência autorizada", "reference")}
        {field("Pressão de bolha", "pb", "number", "barg")}
        {field("Limite de desvio HC", "hcLimit", "number", "fração")}
        {field("Limite de desvio total", "totalLimit", "number", "fração")}
        {field("Timezone", "timezone")}
        {field("Responsável técnico", "responsible")}
        {field("Aprovador", "approver")}
        {field("Início da janela As-Found", "start", "datetime-local")}
        {field("Fim da janela As-Found", "end", "datetime-local")}
        {field("Início da janela Pós-K", "postStart", "datetime-local")}
        {field("Fim da janela Pós-K", "postEnd", "datetime-local")}
        {envField("Envelope de pressão", "p", "barg")}
        {envField("Envelope de temperatura", "t", "°C")}
        {envField("Envelope de dP", "dp", "kPa")}
        {envField("Envelope de GVF", "gvf", "%")}
        {envField("Envelope de WLR", "wlr", "%")}
        <label>
          <span>Evidências completas</span>
          <input type="checkbox" checked={c.evidence} onChange={(e) => update("evidence", e.target.checked)} />
        </label>
        <label>
          <span>Aprovações formalizadas</span>
          <input type="checkbox" checked={c.approvals} onChange={(e) => update("approvals", e.target.checked)} />
        </label>
      </div>
      <button className="primary" onClick={save} data-testid="save-campanha-btn">
        <Save size={16} />
        Salvar
      </button>
    </div>
  );
}

/* ============= Fatores K ============= */
function FatoresKTab({
  c,
  updateK,
  r,
  save,
}: {
  c: Campaign;
  updateK: (key: keyof Campaign["k"], v: any) => void;
  r: ReturnType<typeof calculate>;
  save: () => void;
}) {
  const num = (label: string, key: keyof Campaign["k"]) => (
    <label>
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={String((c.k as any)[key] ?? "")}
          onChange={(e) => updateK(key, e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </div>
    </label>
  );
  const txt = (label: string, key: keyof Campaign["k"]) => (
    <label>
      <span>{label}</span>
      <div>
        <input type="text" value={String((c.k as any)[key] ?? "")} onChange={(e) => updateK(key, e.target.value)} />
      </div>
    </label>
  );
  return (
    <div className="page" data-testid="fatoresk-page">
      <div className="title-row">
        <div>
          <h1>Fatores K</h1>
          <p>K aprovado e aplicado por fase, comparado ao K calculado.</p>
        </div>
      </div>
      <div className="kpis">
        <Kpi label="K óleo calculado" value={fmt(r.kOil, 5)} limit="Base mássica equalizada" ok={r.kOil >= c.kMin && r.kOil <= c.kMax} />
        <Kpi label="K gás calculado" value={fmt(r.kGas, 5)} limit="Base mássica equalizada" ok={r.kGas >= c.kMin && r.kGas <= c.kMax} />
        <Kpi label="K água calculado" value={fmt(r.kWater, 5)} limit="Base mássica equalizada" ok={r.kWater >= c.kMin && r.kWater <= c.kMax} />
      </div>
      <div className="form">
        {num("K óleo aprovado", "oilApproved")}
        {num("K óleo aplicado", "oilApplied")}
        {num("K gás aprovado", "gasApproved")}
        {num("K gás aplicado", "gasApplied")}
        {num("K água aprovado", "waterApproved")}
        {num("K água aplicado", "waterApplied")}
        {txt("Data de aplicação", "date")}
        {txt("Responsável", "responsible")}
        {txt("Evidência", "evidence")}
      </div>
      <button className="primary" onClick={save}>
        <Save size={16} />
        Salvar
      </button>
    </div>
  );
}

/* ============= Pós-K ============= */
function PosKTab({
  c,
  updateU,
  r,
  save,
}: {
  c: Campaign;
  updateU: (key: keyof Campaign["uncertainty"], v: any) => void;
  r: ReturnType<typeof calculate>;
  save: () => void;
}) {
  const num = (label: string, key: keyof Campaign["uncertainty"]) => (
    <label>
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={String((c.uncertainty as any)[key] ?? "")}
          onChange={(e) => updateU(key, e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </div>
    </label>
  );
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1>Pós-K</h1>
          <p>Incerteza pós-K e resultado da validação.</p>
        </div>
      </div>
      <div className="status-band">
        <div className={Math.abs(r.postDevHC) <= c.hcLimit ? "ok" : "bad"}>
          <CheckCircle2 />
          <span>
            Resultado técnico pós-K:<b>{Math.abs(r.postDevHC) <= c.hcLimit ? "ATENDE" : "NÃO ATENDE"}</b>
            <small>Desvio HC: {pct(r.postDevHC)}</small>
          </span>
        </div>
      </div>
      <div className="kpis">
        <Kpi label="Desvio HC Pós-K" value={pct(r.postDevHC)} limit={`Critério: ≤ ${fmt(c.hcLimit * 100, 0)}%`} ok={Math.abs(r.postDevHC) <= c.hcLimit} />
        <Kpi label="Desvio Total Pós-K" value={pct(r.postDevTotal)} limit={`Critério: ≤ ${fmt(c.totalLimit * 100, 0)}%`} ok={Math.abs(r.postDevTotal) <= c.totalLimit} />
        <Kpi label="En Pós-K" value={fmt(r.enPost, 3)} limit="Critério: ≤ 1,000" ok={r.enPost <= 1} />
      </div>
      <div className="form">
        {num("Incerteza MPFM pós-K", "postMpfm")}
        {num("Incerteza referência pós-K", "postRef")}
      </div>
      <button className="primary" onClick={save}>
        <Save size={16} />
        Salvar
      </button>
    </div>
  );
}

/* ============= Laboratório/PVT ============= */
function LaboratorioPvtTab({
  c,
  updatePvt,
  save,
}: {
  c: Campaign;
  updatePvt: (key: keyof Campaign["pvt"], v: any) => void;
  save: () => void;
}) {
  const num = (label: string, key: keyof Campaign["pvt"]) => (
    <label>
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={String((c.pvt as any)[key] ?? "")}
          onChange={(e) => updatePvt(key, e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </div>
    </label>
  );
  const txt = (label: string, key: keyof Campaign["pvt"]) => (
    <label>
      <span>{label}</span>
      <div>
        <input type="text" value={String((c.pvt as any)[key] ?? "")} onChange={(e) => updatePvt(key, e.target.value)} />
      </div>
    </label>
  );
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1>Laboratório/PVT</h1>
          <p>Rastreabilidade PVT e massas de referência por condição.</p>
        </div>
      </div>
      <div className="form">
        {txt("Arquivo PVT", "file")}
        {txt("Hash (SHA-256)", "hash")}
        {txt("Software", "software")}
        {txt("Versão", "version")}
        {txt("Aprovador", "approver")}
        {num("Óleo As-Found (t)", "asOil")}
        {num("Gás As-Found (t)", "asGas")}
        {num("Água As-Found (t)", "asWater")}
        {num("Óleo Pós-K (t)", "postOil")}
        {num("Gás Pós-K (t)", "postGas")}
        {num("Água Pós-K (t)", "postWater")}
      </div>
      <button className="primary" onClick={save}>
        <Save size={16} />
        Salvar
      </button>
    </div>
  );
}

/* ============= MPFM editável ============= */
function MPFMTab({
  c,
  updateRows,
}: {
  c: Campaign;
  updateRows: (rows: Row[]) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | Condition>("ALL");
  const rows = c.rows;
  const filtered = filter === "ALL" ? rows : rows.filter((r) => r.condition === filter);

  const set = (index: number, patch: Partial<Row>) => {
    const next = [...rows];
    const real = rows.indexOf(filtered[index]);
    if (real === -1) return;
    next[real] = { ...next[real], ...patch };
    updateRows(next);
  };
  const del = (index: number) => {
    const real = rows.indexOf(filtered[index]);
    if (real === -1) return;
    if (!confirm("Remover esta linha?")) return;
    const next = [...rows];
    next.splice(real, 1);
    updateRows(next);
  };
  const add = (condition: Condition) => updateRows([...rows, blankRow(condition)]);
  const numCell = (row: Row, i: number, k: keyof Row, d = 3) => (
    <input
      className="cell-input numeric"
      type="number"
      step="any"
      value={row[k] == null ? "" : String(row[k])}
      onChange={(e) => set(i, { [k]: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
      data-testid={`mpfm-${k}-${i}`}
    />
  );

  return (
    <div className="page" data-testid="mpfm-page">
      <div className="title-row">
        <div>
          <h1>MPFM</h1>
          <p>Leituras horárias — edição inline de linhas importadas ou adicionadas manualmente.</p>
        </div>
      </div>
      <article className="panel">
        <div className="table-toolbar">
          <h3>Leituras MPFM · {filtered.length} de {rows.length}</h3>
          <div className="sp" />
          <div className="filters">
            Filtro:
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} data-testid="mpfm-filter">
              <option value="ALL">Todas</option>
              <option value="AS_FOUND">As-Found</option>
              <option value="POST_K">Pós-K</option>
            </select>
          </div>
          <button onClick={() => add("AS_FOUND")} data-testid="mpfm-add-as">
            <Plus size={13} />
            As-Found
          </button>
          <button onClick={() => add("POST_K")} data-testid="mpfm-add-post">
            <Plus size={13} />
            Pós-K
          </button>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cond.</th>
                  <th>Timestamp</th>
                  <th>Usar?</th>
                  <th>Dur.(h)</th>
                  <th>P (barg)</th>
                  <th>T (°C)</th>
                  <th>dP (kPa)</th>
                  <th>GVF (%)</th>
                  <th>WLR (%)</th>
                  <th>Óleo (t)</th>
                  <th>Gás (t)</th>
                  <th>Água (t)</th>
                  <th>Óleo corr (t)</th>
                  <th>Gás corr (t)</th>
                  <th>Água corr (t)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} className={row.use ? "" : "excluded"}>
                    <td>
                      <select
                        className="cell-input"
                        value={row.condition}
                        onChange={(e) => set(i, { condition: e.target.value as Condition })}
                      >
                        <option value="AS_FOUND">As-Found</option>
                        <option value="POST_K">Pós-K</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        type="text"
                        value={row.timestamp}
                        onChange={(e) => set(i, { timestamp: e.target.value })}
                        style={{ minWidth: 150 }}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        className="cell-check"
                        type="checkbox"
                        checked={row.use}
                        onChange={(e) => set(i, { use: e.target.checked })}
                      />
                    </td>
                    <td>{numCell(row, i, "duration", 1)}</td>
                    <td>{numCell(row, i, "p")}</td>
                    <td>{numCell(row, i, "t")}</td>
                    <td>{numCell(row, i, "dp")}</td>
                    <td>{numCell(row, i, "gvf")}</td>
                    <td>{numCell(row, i, "wlr")}</td>
                    <td>{numCell(row, i, "oil")}</td>
                    <td>{numCell(row, i, "gas")}</td>
                    <td>{numCell(row, i, "water")}</td>
                    <td>{numCell(row, i, "oilCorr")}</td>
                    <td>{numCell(row, i, "gasCorr")}</td>
                    <td>{numCell(row, i, "waterCorr")}</td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => del(i)} title="Remover" data-testid={`mpfm-del-${i}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            Nenhuma leitura ainda. Use <b>+ As-Found</b> / <b>+ Pós-K</b> ou a aba <b>Importação</b>.
          </div>
        )}
      </article>
    </div>
  );
}

/* ============= Separador editável ============= */
function SeparadorTab({
  c,
  updateSeparator,
}: {
  c: Campaign;
  updateSeparator: (rows: SeparatorRow[]) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | Condition>("ALL");
  const rows = c.separatorRows;
  const filtered = filter === "ALL" ? rows : rows.filter((r) => r.condition === filter);
  const set = (index: number, patch: Partial<SeparatorRow>) => {
    const real = rows.indexOf(filtered[index]);
    if (real === -1) return;
    const next = [...rows];
    next[real] = { ...next[real], ...patch };
    updateSeparator(next);
  };
  const del = (index: number) => {
    const real = rows.indexOf(filtered[index]);
    if (real === -1) return;
    if (!confirm("Remover esta linha?")) return;
    const next = [...rows];
    next.splice(real, 1);
    updateSeparator(next);
  };
  const add = (condition: Condition) => updateSeparator([...rows, blankSeparatorRow(condition)]);
  const numCell = (row: SeparatorRow, i: number, k: keyof SeparatorRow) => (
    <input
      className="cell-input numeric"
      type="number"
      step="any"
      value={row[k] == null ? "" : String(row[k])}
      onChange={(e) => set(i, { [k]: e.target.value === "" ? null : Number(e.target.value) } as any)}
      data-testid={`sep-${String(k)}-${i}`}
    />
  );
  return (
    <div className="page" data-testid="separador-page">
      <div className="title-row">
        <div>
          <h1>Separador</h1>
          <p>Leituras do separador de teste — edição inline.</p>
        </div>
      </div>
      <article className="panel">
        <div className="table-toolbar">
          <h3>Leituras · {filtered.length} de {rows.length}</h3>
          <div className="sp" />
          <div className="filters">
            Filtro:
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} data-testid="sep-filter">
              <option value="ALL">Todas</option>
              <option value="AS_FOUND">As-Found</option>
              <option value="POST_K">Pós-K</option>
            </select>
          </div>
          <button onClick={() => add("AS_FOUND")} data-testid="sep-add-as">
            <Plus size={13} />
            As-Found
          </button>
          <button onClick={() => add("POST_K")} data-testid="sep-add-post">
            <Plus size={13} />
            Pós-K
          </button>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cond.</th>
                  <th>Timestamp</th>
                  <th>Usar?</th>
                  <th>Dur.(h)</th>
                  <th>P (barg)</th>
                  <th>T (°C)</th>
                  <th>Óleo GV (m³)</th>
                  <th>ρ óleo (kg/m³)</th>
                  <th>Óleo (t)</th>
                  <th>Gás (t)</th>
                  <th>Água (t)</th>
                  <th>Gás padrão (ksm³)</th>
                  <th>Água (m³)</th>
                  <th>Referência</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} className={row.use_flag ? "" : "excluded"}>
                    <td>
                      <select
                        className="cell-input"
                        value={row.condition}
                        onChange={(e) => set(i, { condition: e.target.value as Condition })}
                      >
                        <option value="AS_FOUND">As-Found</option>
                        <option value="POST_K">Pós-K</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        type="text"
                        value={row.timestamp}
                        onChange={(e) => set(i, { timestamp: e.target.value })}
                        style={{ minWidth: 150 }}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        className="cell-check"
                        type="checkbox"
                        checked={!!row.use_flag}
                        onChange={(e) => set(i, { use_flag: e.target.checked ? 1 : 0 })}
                        data-testid={`sep-usar-${i}`}
                      />
                    </td>
                    <td>{numCell(row, i, "duration_h")}</td>
                    <td>{numCell(row, i, "pressure_barg")}</td>
                    <td>{numCell(row, i, "temperature_c")}</td>
                    <td>{numCell(row, i, "oil_gv_line_m3")}</td>
                    <td>{numCell(row, i, "oil_rho_coriolis_kgm3")}</td>
                    <td>{numCell(row, i, "oil_mass_direct_t")}</td>
                    <td>{numCell(row, i, "gas_mass_t")}</td>
                    <td>{numCell(row, i, "water_mass_t")}</td>
                    <td>{numCell(row, i, "gas_std_ksm3")}</td>
                    <td>{numCell(row, i, "water_vol_m3")}</td>
                    <td>
                      <input
                        className="cell-input"
                        type="text"
                        value={row.source_ref}
                        onChange={(e) => set(i, { source_ref: e.target.value })}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => del(i)} title="Remover" data-testid={`sep-del-${i}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            Nenhuma leitura de separador. Use <b>+ As-Found</b> / <b>+ Pós-K</b> ou a aba <b>Importação</b>.
          </div>
        )}
      </article>
    </div>
  );
}

/* ============= Evidências ============= */
function EvidenciasTab({ c, r }: { c: Campaign; r: ReturnType<typeof calculate> }) {
  const g10 = r.gates.find((g) => g[0] === "G10");
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1>Evidências</h1>
          <p>Checklist de evidências e aprovações.</p>
        </div>
      </div>
      <div className="status-band">
        <div className={c.evidence ? "ok" : "bad"}>
          <CheckCircle2 />
          <span>
            Evidências completas:<b>{c.evidence ? "SIM" : "NÃO"}</b>
            <small>Editável na aba Campanha.</small>
          </span>
        </div>
        <div className={c.approvals ? "ok" : "bad"}>
          <ShieldAlert />
          <span>
            Aprovações formalizadas:<b>{c.approvals ? "SIM" : "NÃO"}</b>
            <small>Editável na aba Campanha.</small>
          </span>
        </div>
      </div>
      <div className="kpis">
        <Kpi
          label="Gate G10 — Certificados e evidências críticas"
          value={g10 && g10[2] ? "Atende" : "Pendente"}
          limit="Ver matriz completa em Visão geral"
          ok={!!(g10 && g10[2])}
        />
      </div>
    </div>
  );
}

/* ============= Importação ============= */
function ImportacaoTab({
  c,
  onCampaignUpdate,
  flash,
}: {
  c: Campaign;
  onCampaignUpdate: (next: Campaign) => void;
  flash: (msg: string, error?: boolean) => void;
}) {
  const templateRef = useRef<HTMLInputElement>(null);
  const [mpfmFile, setMpfmFile] = useState<File | null>(null);
  const [sepFile, setSepFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleTemplate = async (f: File) => {
    try {
      setBusy(true);
      const next = await importCampaignTemplate(f, c);
      onCampaignUpdate(next);
      flash(`Template Excel importado: ${f.name}`);
    } catch (err) {
      flash("Falha ao ler o template Excel.", true);
    } finally {
      setBusy(false);
    }
  };

  const carregar = async (condition: Condition) => {
    const start = condition === "AS_FOUND" ? c.start : c.postStart;
    const end = condition === "AS_FOUND" ? c.end : c.postEnd;
    if (!start || !end) {
      setError("Preencha a janela de datas na aba Campanha antes de carregar.");
      return;
    }
    if (!mpfmFile && !sepFile) {
      setError("Selecione ao menos um arquivo (MPFM ou Separador).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const mpfmRows = mpfmFile ? await parseMpfmWindow(mpfmFile, c.tag, start, end, condition) : [];
      const separatorRows = sepFile ? await parseSeparatorWindow(sepFile, start, end, condition) : [];
      const nextRows = mpfmRows.length ? mergeRowsByKey(c.rows, mpfmRows, condition) : c.rows;
      const nextSep = separatorRows.length ? mergeRowsByKey(c.separatorRows, separatorRows, condition) : c.separatorRows;
      onCampaignUpdate({ ...c, rows: nextRows, separatorRows: nextSep });
      flash(`Carregado: ${mpfmRows.length} linhas MPFM, ${separatorRows.length} linhas Separador (${condition}).`);
    } catch (err) {
      setError("Falha ao processar o(s) arquivo(s). Verifique se o formato é o esperado.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" data-testid="importacao-page">
      <div className="title-row">
        <div>
          <h1>Importação</h1>
          <p>Template Excel de campanha ou extração automática MPFM + Separador (janela As-Found / Pós-K).</p>
        </div>
      </div>

      <article className="panel">
        <div className="table-toolbar">
          <h3>Template de campanha</h3>
        </div>
        <div className="form">
          <div className="validation">
            <CheckCircle2 />
            <span>
              <b>Formato aceito</b>
              <small>Excel (.xlsx/.xls) com as abas "01_CAMPANHA" e "IN_01_MPFM".</small>
            </span>
          </div>
          <input
            ref={templateRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => e.target.files?.[0] && handleTemplate(e.target.files[0])}
            data-testid="template-file-input"
          />
          <button className="primary" disabled={busy} onClick={() => templateRef.current?.click()} data-testid="import-template-btn">
            <Upload size={16} />
            Importar template Excel
          </button>
        </div>
      </article>

      <article className="panel" style={{ marginTop: 14 }}>
        <div className="table-toolbar">
          <h3>Extração automática (produção mensal + separador)</h3>
        </div>
        <div className="form">
          <p className="form-info">
            Selecione os arquivos de origem e escolha a janela para carregar. As linhas são
            deduplicadas por <code>(condição + timestamp)</code>, então re-carregar corrige em
            vez de duplicar. Toda linha pode ser editada depois nas abas MPFM/Separador.
          </p>
          <label>
            <span>Excel MPFM mensal (aba BASE_UNICA_MES)</span>
            <div>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setMpfmFile(e.target.files?.[0] ?? null)} data-testid="mpfm-file-input" />
            </div>
          </label>
          <label>
            <span>Excel Separador (blocos dia/hora)</span>
            <div>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setSepFile(e.target.files?.[0] ?? null)} data-testid="sep-file-input" />
            </div>
          </label>
          {error && <p className="form-error" data-testid="import-error">{error}</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="primary" disabled={busy} onClick={() => carregar("AS_FOUND")} data-testid="load-as-found-btn">
              <Download size={16} />
              Carregar janela As-Found
            </button>
            <button className="primary" disabled={busy} onClick={() => carregar("POST_K")} data-testid="load-post-k-btn">
              <Download size={16} />
              Carregar janela Pós-K
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}

/* ============= Relatórios ============= */
function RelatoriosTab({ exportExcel, c }: { exportExcel: () => void; c: Campaign }) {
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1>Relatórios</h1>
          <p>Exportação da campanha em Excel (4 abas).</p>
        </div>
      </div>
      <div className="form">
        <div className="validation">
          <CheckCircle2 />
          <span>
            <b>Conteúdo do arquivo</b>
            <small>Abas 01_CAMPANHA, IN_01_MPFM, IN_02_SEPARADOR, 03_VALIDACAO (gates) e 06_EXPORTACAO (resultado técnico).</small>
          </span>
        </div>
        <button className="primary" onClick={exportExcel} data-testid="export-excel-btn">
          <FileSpreadsheet size={16} />
          Exportar Excel — {c.id}
        </button>
      </div>
    </div>
  );
}

/* ============= Drawer ============= */
function Drawer({
  c,
  update,
  close,
  save,
}: {
  c: Campaign;
  update: (k: keyof Campaign, v: any) => void;
  close: () => void;
  save: () => void;
}) {
  const field = (label: string, key: keyof Campaign, type = "text", unit = "") => (
    <label>
      <span>
        {label}
        <i>*</i>
      </span>
      <div>
        <input
          type={type}
          value={String(c[key] ?? "")}
          onChange={(e) => update(key, type === "number" ? Number(e.target.value) : e.target.value)}
        />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  );
  return (
    <>
      <div className="drawer-scrim" onClick={close} />
      <aside className="drawer">
        <header>
          <div>
            <h2>Detalhes da campanha</h2>
            <p>Informações gerais e critérios</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <div className="form">
          {field("Campaign ID", "id")}
          {field("Ativo / instalação", "asset")}
          {field("Poço / Riser", "well")}
          {field("TAG do MPFM", "tag")}
          {field("Número de série", "serial")}
          {field("Referência autorizada", "reference")}
          {field("Pressão de bolha", "pb", "number", "barg")}
          {field("Responsável técnico", "responsible")}
          {field("Aprovador", "approver")}
        </div>
        <footer>
          <button onClick={close}>Cancelar</button>
          <button className="primary" onClick={save}>
            <Save />
            Salvar
          </button>
        </footer>
      </aside>
    </>
  );
}

/* ============= Nova Campanha Modal ============= */
function NovaCampanhaModal({ close, onCreated }: { close: () => void; onCreated: (c: Campaign) => void }) {
  const [form, setForm] = useState({
    id: "",
    asset: "",
    well: "",
    tag: "",
    serial: "",
    reference: "",
    revision: "Rev. 0",
    nature: "COMISSIONAMENTO",
    responsible: "",
    approver: "",
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((x) => ({ ...x, [k]: v }));
  const field = (label: string, key: keyof typeof form) => (
    <label>
      <span>
        {label}
        <i>*</i>
      </span>
      <div>
        <input type="text" value={form[key]} onChange={(e) => set(key, e.target.value)} data-testid={`new-campaign-${String(key)}`} />
      </div>
    </label>
  );
  const submit = () => {
    if (!form.id || !form.tag) {
      setError("Campaign ID e TAG são obrigatórios.");
      return;
    }
    const c = blankCampaign(form.id);
    c.asset = form.asset;
    c.well = form.well;
    c.tag = form.tag;
    c.serial = form.serial;
    c.reference = form.reference;
    c.revision = form.revision;
    c.nature = form.nature;
    c.responsible = form.responsible;
    c.approver = form.approver;
    onCreated(c);
  };
  return (
    <>
      <div className="drawer-scrim" onClick={close} />
      <aside className="drawer">
        <header>
          <div>
            <h2>Nova campanha</h2>
            <p>Dados básicos — o restante é preenchido depois</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <div className="form">
          {field("Campaign ID", "id")}
          {field("Ativo / instalação", "asset")}
          {field("Poço / Riser", "well")}
          {field("TAG do MPFM", "tag")}
          {field("Número de série", "serial")}
          {field("Referência autorizada", "reference")}
          {field("Revisão", "revision")}
          {field("Natureza", "nature")}
          {field("Responsável técnico", "responsible")}
          {field("Aprovador", "approver")}
          {error && <p className="form-error">{error}</p>}
        </div>
        <footer>
          <button onClick={close}>Cancelar</button>
          <button className="primary" onClick={submit} data-testid="new-campaign-submit">
            <Save />
            Criar campanha
          </button>
        </footer>
      </aside>
    </>
  );
}

/* ============= App ============= */
function App() {
  const [ready, setReady] = useState(false);
  const [c, setC] = useState<Campaign>(seedCampaign());
  const [campaigns, setCampaigns] = useState<{ id: string; updated_at: string }[]>([]);
  const [active, setActiveTab] = useState<string>("Visão geral");
  const [drawer, setDrawer] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [novaCampanha, setNovaCampanha] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const dbFileRef = useRef<HTMLInputElement>(null);
  const r = useMemo(() => calculate(c), [c]);

  const refreshList = () => setCampaigns(listCampaigns());
  const flash = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    (async () => {
      await initDb();
      const list = listCampaigns();
      setCampaigns(list);
      const activeId = getActive();
      const first = activeId ? loadCampaign(activeId) : list[0] ? loadCampaign(list[0].id) : null;
      if (first) {
        setC(first);
      } else {
        const seeded = seedCampaign();
        saveCampaign(seeded);
        setActive(seeded.id);
        setC(seeded);
        setCampaigns(listCampaigns());
      }
      setReady(true);
    })();
  }, []);

  const update = (key: keyof Campaign, value: any) => setC((x) => ({ ...x, [key]: value }));
  const updateSection = <K extends "pvt" | "uncertainty" | "k">(section: K, key: keyof Campaign[K], value: any) =>
    setC((x) => ({ ...x, [section]: { ...(x[section] as any), [key]: value } }));
  const updateEnvelope = (
    axis: "p" | "t" | "dp" | "gvf" | "wlr",
    index: 0 | 1,
    value: number | null
  ) =>
    setC((x) => {
      const arr: [number | null, number | null] = [...x.envelope[axis]] as any;
      arr[index] = value;
      return { ...x, envelope: { ...x.envelope, [axis]: arr } };
    });
  const updateRows = (rows: Row[]) => setC((x) => ({ ...x, rows }));
  const updateSeparator = (separatorRows: SeparatorRow[]) => setC((x) => ({ ...x, separatorRows }));

  const save = () => {
    saveCampaign(c);
    setActive(c.id);
    refreshList();
    flash("Campanha salva no SQLite local.");
  };

  const switchCampaign = (id: string) => {
    saveCampaign(c);
    const loaded = loadCampaign(id);
    if (loaded) {
      setC(loaded);
      setActive(id);
      refreshList();
      flash(`Campanha ${id} carregada.`);
    }
  };

  const removeCampaign = (id: string) => {
    if (!confirm(`Excluir a campanha ${id}?`)) return;
    deleteCampaign(id);
    refreshList();
    const remaining = listCampaigns();
    if (remaining.length) {
      const next = loadCampaign(remaining[0].id);
      if (next) {
        setC(next);
        setActive(next.id);
      }
    } else {
      const seeded = seedCampaign();
      saveCampaign(seeded);
      setActive(seeded.id);
      setC(seeded);
      refreshList();
    }
    flash(`Campanha ${id} excluída.`);
  };

  const exportDb = () => {
    const bytes = exportDbBlob();
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mpfm-calibracao-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Banco SQLite exportado.");
  };

  const importDb = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await importDbBlob(bytes);
      refreshList();
      const list = listCampaigns();
      if (list.length) {
        const first = loadCampaign(list[0].id);
        if (first) {
          setC(first);
          setActive(first.id);
        }
      }
      flash("Banco SQLite importado.");
    } catch {
      flash("Falha ao importar banco.", true);
    }
  };

  const exportExcel = () => {
    try {
      exportCampaignExcel(c);
      flash("Excel exportado.");
    } catch {
      flash("Falha ao exportar Excel.", true);
    }
  };

  if (!ready) {
    return (
      <div className="loading-shell">
        <div style={{ textAlign: "center" }}>
          <div className="spinner" />
          Inicializando SQLite local…
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className={mobile ? "open" : ""}>
        <div className="brand">
          <span>∿</span>
          <div>
            <b>METROLOG</b>
            <small>MEDIÇÃO CONFIÁVEL · v2</small>
          </div>
        </div>
        <nav>
          {nav.map(([n, I]) => (
            <button
              key={n}
              className={active === n ? "active" : ""}
              onClick={() => {
                setActiveTab(n);
                setMobile(false);
              }}
              data-testid={`nav-${n.toLowerCase().replace(/[\/ ]/g, "-")}`}
            >
              <I size={19} />
              <span>{n}</span>
            </button>
          ))}
        </nav>
        <div className="version">
          Motor MPFM v2 · standalone
          <br />
          SQLite local + localStorage
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <main>
        <header>
          <button className="menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div className="selector">
            <small>Campanha ativa · {campaigns.length} salvas</small>
            <select value={c.id} onChange={(e) => switchCampaign(e.target.value)} data-testid="campaign-selector">
              {[...campaigns, ...(campaigns.some((x) => x.id === c.id) ? [] : [{ id: c.id, updated_at: "" }])].map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id}
                </option>
              ))}
            </select>
          </div>
          <button className="icon" title="Nova campanha" onClick={() => setNovaCampanha(true)} data-testid="new-campaign-btn">
            <Plus size={17} />
          </button>
          <button
            className="icon"
            title="Excluir campanha"
            onClick={() => removeCampaign(c.id)}
            disabled={campaigns.length <= 1}
            data-testid="delete-campaign-btn"
          >
            <Trash2 size={17} />
          </button>
          <span className="sync">
            <CheckCircle2 size={17} /> Salvo local
          </span>
          <div className="header-actions">
            <input
              ref={dbFileRef}
              type="file"
              accept=".sqlite,.db"
              hidden
              onChange={(e) => e.target.files?.[0] && importDb(e.target.files[0])}
            />
            <button onClick={() => dbFileRef.current?.click()} title="Importar banco SQLite">
              <Database size={15} />
              <span>Importar DB</span>
            </button>
            <button onClick={exportDb} title="Exportar banco SQLite" data-testid="export-db-btn">
              <Download size={15} />
              <span>Exportar DB</span>
            </button>
            <button className="primary" onClick={exportExcel} data-testid="header-export-excel-btn">
              <FileSpreadsheet size={15} />
              <span>Excel</span>
            </button>
            <button className="icon" onClick={() => setDrawer(true)}>
              <Settings2 />
            </button>
          </div>
        </header>
        {active === "Visão geral" && <Overview c={c} r={r} setDrawer={setDrawer} />}
        {active === "Campanha" && (
          <CampanhaTab c={c} update={update} updateEnvelope={updateEnvelope} save={save} />
        )}
        {active === "Fatores K" && (
          <FatoresKTab c={c} updateK={(k, v) => updateSection("k", k, v)} r={r} save={save} />
        )}
        {active === "Pós-K" && (
          <PosKTab c={c} updateU={(k, v) => updateSection("uncertainty", k, v)} r={r} save={save} />
        )}
        {active === "Laboratório/PVT" && (
          <LaboratorioPvtTab c={c} updatePvt={(k, v) => updateSection("pvt", k, v)} save={save} />
        )}
        {active === "MPFM" && <MPFMTab c={c} updateRows={updateRows} />}
        {active === "Separador" && <SeparadorTab c={c} updateSeparator={updateSeparator} />}
        {active === "Evidências" && <EvidenciasTab c={c} r={r} />}
        {active === "Importação" && (
          <ImportacaoTab
            c={c}
            onCampaignUpdate={(next) => {
              setC(next);
              saveCampaign(next);
              refreshList();
            }}
            flash={flash}
          />
        )}
        {active === "Relatórios" && <RelatoriosTab exportExcel={exportExcel} c={c} />}
      </main>
      {drawer && (
        <Drawer
          c={c}
          update={update}
          close={() => setDrawer(false)}
          save={() => {
            save();
            setDrawer(false);
          }}
        />
      )}
      {novaCampanha && (
        <NovaCampanhaModal
          close={() => setNovaCampanha(false)}
          onCreated={(created) => {
            saveCampaign(created);
            setActive(created.id);
            setC(created);
            refreshList();
            setNovaCampanha(false);
            setActiveTab("Campanha");
            flash(`Campanha ${created.id} criada.`);
          }}
        />
      )}
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`} data-testid="toast">
          {toast.error ? <XCircle /> : <CheckCircle2 />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

if (typeof document !== "undefined") {
  createRoot(document.getElementById("root")!).render(<App />);
}
