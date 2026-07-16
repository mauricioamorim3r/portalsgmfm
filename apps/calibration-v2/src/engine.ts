import type { Campaign, Row } from "./types";

const sum = (rows: Row[], key: keyof Row): number =>
  rows.reduce((a, r) => a + (r.use ? Number(r[key]) || 0 : 0), 0);

export function calculate(c: Campaign) {
  const as = c.rows.filter((r) => r.condition === "AS_FOUND");
  const post = c.rows.filter((r) => r.condition === "POST_K");
  const asOil = sum(as, "oil"),
    asGas = sum(as, "gas"),
    asWater = sum(as, "water"),
    asHC = asOil + asGas,
    asTotal = asHC + asWater,
    refHC = c.pvt.asOil + c.pvt.asGas,
    refTotal = refHC + c.pvt.asWater;
  const postOil = sum(post, "oilCorr"),
    postGas = sum(post, "gasCorr"),
    postWater = sum(post, "waterCorr"),
    postHC = postOil + postGas,
    postTotal = postHC + postWater,
    postRefHC = c.pvt.postOil + c.pvt.postGas,
    postRefTotal = postRefHC + c.pvt.postWater;
  const asUse = as.filter((r) => r.use);
  const avgP = asUse.length ? sum(as, "p") / asUse.length : 0;
  const above = avgP >= c.pb;
  const devHC = refHC ? (asHC - refHC) / refHC : NaN;
  const devTotal = refTotal ? (asTotal - refTotal) / refTotal : NaN;
  const postDevHC = postRefHC ? (postHC - postRefHC) / postRefHC : NaN;
  const postDevTotal = postRefTotal ? (postTotal - postRefTotal) / postRefTotal : NaN;
  const kOil = asOil ? c.pvt.asOil / asOil : NaN;
  const kGas = above ? 1 : asGas ? c.pvt.asGas / asGas : NaN;
  const ratio = c.pvt.asWater === 0 ? Infinity : c.pvt.asOil / c.pvt.asWater;
  const kWater =
    c.pvt.asWater === 0 || ratio >= 25 ? 1 : asWater ? c.pvt.asWater / asWater : NaN;
  const kHC = asHC ? refHC / asHC : NaN;
  const uAs = Math.hypot(c.uncertainty.asMpfm, c.uncertainty.asRef);
  const uPost = Math.hypot(c.uncertainty.postMpfm, c.uncertainty.postRef);
  const enAs = uAs ? Math.abs(devHC * 100) / uAs : NaN;
  const enPost = uPost ? Math.abs(postDevHC * 100) / uPost : NaN;
  const envComplete = Object.values(c.envelope).every(
    (v) => v[0] != null && v[1] != null
  );
  const pvtTrace = !!(c.pvt.file && c.pvt.hash && c.pvt.version && c.pvt.approver);
  const rangeOk =
    envComplete &&
    as.every(
      (r) =>
        !r.use ||
        (
          [
            ["p", "p"],
            ["t", "t"],
            ["dp", "dp"],
            ["gvf", "gvf"],
            ["wlr", "wlr"],
          ] as const
        ).every(
          ([key, e]) =>
            r[key] >= (c.envelope[e][0] as number) &&
            r[key] <= (c.envelope[e][1] as number)
        )
    );
  const gates: [string, string, boolean][] = [
    [
      "G01",
      "Contrato da campanha",
      !!(c.id && c.asset && c.tag && c.serial && c.reference && c.responsible && c.approver),
    ],
    [
      "G02",
      "MPFM As-Found — registros e duração",
      asUse.length >= c.minRecords && sum(as, "duration") >= 24,
    ],
    ["G03", "Separador As-Found — referência disponível", refHC > 0],
    ["G04", "Rastreabilidade PVT As-Found", pvtTrace],
    ["G05", "dP histórico real", c.integrity.dp],
    ["G06", "Integridade RAW, unidades e timestamps", Object.values(c.integrity).every(Boolean)],
    ["G07", "Envelope cadastrado", envComplete],
    ["G08", "Operação dentro do envelope", rangeOk],
    ["G09", "Laboratório e propriedades", c.pvt.asOil > 0 && c.pvt.asGas > 0],
    ["G10", "Certificados e evidências críticas", c.evidence],
    ["G11", "Eventos e exclusões tratados", c.integrity.exclusions],
    ["G12", "Regra de K e condição de fase", false],
    [
      "G13",
      "Aplicação do K comprovada",
      !!(c.k.date && c.k.responsible && c.k.evidence),
    ],
    [
      "G14",
      "Monitoramento pós-K",
      post.filter((r) => r.use).length >= c.minRecords && postRefHC > 0 && pvtTrace,
    ],
    ["G15", "Incerteza e En", Number.isFinite(enAs) && enAs <= 1],
    ["G16", "Aprovação formal", c.approvals],
  ];
  gates[11][2] = gates.slice(0, 11).every((g) => g[2]);
  const technical = gates.filter((_, i) => ![12, 13, 15].includes(i)).every((g) => g[2]);
  const issue = gates.every((g) => g[2]);
  return {
    as,
    post,
    asOil,
    asGas,
    asWater,
    refOil: c.pvt.asOil,
    refGas: c.pvt.asGas,
    refWater: c.pvt.asWater,
    asHC,
    asTotal,
    refHC,
    refTotal,
    postHC,
    postTotal,
    postRefHC,
    postRefTotal,
    devHC,
    devTotal,
    postDevHC,
    postDevTotal,
    kOil,
    kGas,
    kWater,
    kHC,
    uAs,
    uPost,
    enAs,
    enPost,
    avgP,
    above,
    gates,
    technical,
    issue,
  };
}

export const fmt = (n: number, d = 2): string =>
  Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";
export const pct = (n: number): string =>
  Number.isFinite(n) ? `${n < 0 ? "−" : ""}${fmt(Math.abs(n) * 100, 2)}%` : "—";
export const numOrDash = (n: number | null | undefined, d = 2): string =>
  n == null ? "—" : fmt(n, d);
export const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
