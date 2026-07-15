import { env } from "cloudflare:workers";
import { loadCalibrationCampaign } from "../../../../db/calibration";
import { saveCalibrationRows, type MpfmRowInput, type SeparatorRowInput } from "../../../../db/calibration-rows-write";
import { corsHeaders } from "../cors";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "PUT",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function parseMpfmRow(value: unknown): MpfmRowInput | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (!isString(r.timestamp) || typeof r.use !== "boolean" || !isString(r.quality)) return null;
  const numbers = ["duration", "p", "t", "dp", "gvf", "wlr", "oil", "gas", "water", "oilCorr", "gasCorr", "waterCorr"] as const;
  for (const key of numbers) if (!isNumberOrNull(r[key])) return null;
  return {
    timestamp: r.timestamp,
    use: r.use as boolean,
    duration: r.duration as number | null,
    quality: r.quality,
    p: r.p as number | null,
    t: r.t as number | null,
    dp: r.dp as number | null,
    gvf: r.gvf as number | null,
    wlr: r.wlr as number | null,
    oil: r.oil as number | null,
    gas: r.gas as number | null,
    water: r.water as number | null,
    oilCorr: r.oilCorr as number | null,
    gasCorr: r.gasCorr as number | null,
    waterCorr: r.waterCorr as number | null,
  };
}

function parseSeparatorRow(value: unknown): SeparatorRowInput | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (!isString(r.timestamp) || typeof r.use !== "boolean" || !isString(r.quality) || !isString(r.sourceRef)) return null;
  const numbers = ["durationH", "pressureBarg", "temperatureC", "oilGvLineM3", "oilRhoCoriolisKgm3", "oilMassDirectT", "gasMassT", "waterMassT", "gasStdKsm3", "waterVolM3"] as const;
  for (const key of numbers) if (!isNumberOrNull(r[key])) return null;
  return {
    timestamp: r.timestamp,
    use: r.use as boolean,
    durationH: r.durationH as number | null,
    quality: r.quality,
    pressureBarg: r.pressureBarg as number | null,
    temperatureC: r.temperatureC as number | null,
    oilGvLineM3: r.oilGvLineM3 as number | null,
    oilRhoCoriolisKgm3: r.oilRhoCoriolisKgm3 as number | null,
    oilMassDirectT: r.oilMassDirectT as number | null,
    gasMassT: r.gasMassT as number | null,
    waterMassT: r.waterMassT as number | null,
    gasStdKsm3: r.gasStdKsm3 as number | null,
    waterVolM3: r.waterVolM3 as number | null,
    sourceRef: r.sourceRef,
  };
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request);
  try {
    if (!env.DB) {
      return Response.json({ status: "unavailable", error: "Base D1 não vinculada." }, { status: 503, headers });
    }

    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");
    const condition = url.searchParams.get("condition");
    if (!campaignId) {
      return Response.json({ status: "error", error: "Parâmetro campaignId é obrigatório." }, { status: 400, headers });
    }
    if (condition !== "AS_FOUND" && condition !== "POST_K") {
      return Response.json({ status: "error", error: "Parâmetro condition deve ser AS_FOUND ou POST_K." }, { status: 400, headers });
    }

    const body = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || !Array.isArray((body as Record<string, unknown>).mpfmRows) || !Array.isArray((body as Record<string, unknown>).separatorRows)) {
      return Response.json({ status: "error", error: "Corpo da requisição inválido." }, { status: 400, headers });
    }
    const rawMpfm = (body as Record<string, unknown>).mpfmRows as unknown[];
    const rawSeparator = (body as Record<string, unknown>).separatorRows as unknown[];
    const mpfmRows = rawMpfm.map(parseMpfmRow);
    const separatorRows = rawSeparator.map(parseSeparatorRow);
    if (mpfmRows.some((row) => row === null) || separatorRows.some((row) => row === null)) {
      return Response.json({ status: "error", error: "Uma ou mais linhas têm formato inválido." }, { status: 400, headers });
    }

    const result = await saveCalibrationRows(env.DB, campaignId, condition, mpfmRows as MpfmRowInput[], separatorRows as SeparatorRowInput[]);
    if (!result.ok) {
      return Response.json({ status: "error", error: `Campanha não encontrada: ${campaignId}` }, { status: 404, headers });
    }

    const campaign = await loadCalibrationCampaign(env.DB, campaignId);
    return Response.json({ status: "ok", mpfmCount: result.mpfmCount, separatorCount: result.separatorCount, campaign }, { headers });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const message = /no such table|D1_ERROR/i.test(detail)
      ? "A base real ainda não foi inicializada neste ambiente. A migração será aplicada na publicação."
      : "Falha ao gravar as linhas na base real.";
    return Response.json({ status: "error", error: message }, { status: 500, headers });
  }
}
