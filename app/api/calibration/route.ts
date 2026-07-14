import { env } from "cloudflare:workers";
import { loadCalibrationCampaign } from "../../../db/calibration";
import { saveCalibrationCampaign, type CampaignInput } from "../../../db/calibration-write";

// This endpoint is meant to be called cross-origin by the standalone MPFM
// calibration app (a separate local dev server, not part of this repo), so
// only localhost origins get an Access-Control-Allow-Origin — never "*".
function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? { "Access-Control-Allow-Origin": origin } : {};
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "GET, PUT",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    if (!env.DB) {
      return Response.json({ status: "unavailable", error: "Base D1 não vinculada." }, { status: 503, headers });
    }

    const campaignId = new URL(request.url).searchParams.get("campaignId");
    if (!campaignId) {
      const { results } = await env.DB.prepare(
        `SELECT campaign_id, tag, well, asset, revision FROM calibration_campaigns ORDER BY created_at DESC`,
      ).all();
      return Response.json({ status: "ok", campaigns: results ?? [] }, { headers });
    }

    const campaign = await loadCalibrationCampaign(env.DB, campaignId);
    if (!campaign) {
      return Response.json({ status: "error", error: `Campanha não encontrada: ${campaignId}` }, { status: 404, headers });
    }

    return Response.json({ status: "ok", campaign }, { headers });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const message = /no such table|D1_ERROR/i.test(detail)
      ? "A base real ainda não foi inicializada neste ambiente. A migração será aplicada na publicação."
      : "Falha ao consultar a base real.";
    return Response.json({ status: "error", error: message }, { status: 500, headers });
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isTuple(value: unknown): value is [number | null, number | null] {
  return Array.isArray(value) && value.length === 2 && isNumberOrNull(value[0]) && isNumberOrNull(value[1]);
}

function parseCampaignInput(body: unknown): CampaignInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const requiredStrings = ["id", "revision", "nature", "asset", "well", "tag", "serial", "reference", "timezone", "responsible", "approver"] as const;
  for (const key of requiredStrings) if (!isString(b[key])) return null;

  const requiredNumbers = ["pb", "hcLimit", "totalLimit", "pvtLimit", "kMin", "kMax", "minRecords", "pvtMonths"] as const;
  for (const key of requiredNumbers) if (!isNumberOrNull(b[key])) return null;

  const nullableStrings = ["start", "end", "postStart", "postEnd"] as const;
  for (const key of nullableStrings) if (b[key] !== null && !isString(b[key])) return null;

  if (typeof b.evidence !== "boolean" || typeof b.approvals !== "boolean") return null;

  const envelope = b.envelope as Record<string, unknown> | undefined;
  if (typeof envelope !== "object" || envelope === null) return null;
  const axes = ["p", "t", "dp", "gvf", "wlr"] as const;
  for (const axis of axes) if (!isTuple(envelope[axis])) return null;

  const pvt = b.pvt as Record<string, unknown> | undefined;
  if (typeof pvt !== "object" || pvt === null) return null;
  const pvtNumbers = ["asOil", "asGas", "asWater", "postOil", "postGas", "postWater"] as const;
  for (const key of pvtNumbers) if (!isNumberOrNull(pvt[key])) return null;
  const pvtStrings = ["file", "hash", "software", "version", "approver"] as const;
  for (const key of pvtStrings) if (!isString(pvt[key])) return null;

  const uncertainty = b.uncertainty as Record<string, unknown> | undefined;
  if (typeof uncertainty !== "object" || uncertainty === null) return null;
  const uncertaintyNumbers = ["asMpfm", "asRef", "postMpfm", "postRef"] as const;
  for (const key of uncertaintyNumbers) if (!isNumberOrNull(uncertainty[key])) return null;

  const k = b.k as Record<string, unknown> | undefined;
  if (typeof k !== "object" || k === null) return null;
  const kNumbers = ["oilApproved", "gasApproved", "waterApproved", "oilApplied", "gasApplied", "waterApplied"] as const;
  for (const key of kNumbers) if (!isNumberOrNull(k[key])) return null;
  const kStrings = ["date", "responsible", "evidence"] as const;
  for (const key of kStrings) if (!isString(k[key])) return null;

  return {
    id: b.id as string,
    revision: b.revision as string,
    nature: b.nature as string,
    asset: b.asset as string,
    well: b.well as string,
    tag: b.tag as string,
    serial: b.serial as string,
    reference: b.reference as string,
    start: b.start as string | null,
    end: b.end as string | null,
    postStart: b.postStart as string | null,
    postEnd: b.postEnd as string | null,
    pb: b.pb as number | null,
    hcLimit: b.hcLimit as number | null,
    totalLimit: b.totalLimit as number | null,
    pvtLimit: b.pvtLimit as number | null,
    kMin: b.kMin as number | null,
    kMax: b.kMax as number | null,
    minRecords: b.minRecords as number | null,
    pvtMonths: b.pvtMonths as number | null,
    timezone: b.timezone as string,
    responsible: b.responsible as string,
    approver: b.approver as string,
    envelope: envelope as CampaignInput["envelope"],
    pvt: pvt as CampaignInput["pvt"],
    uncertainty: uncertainty as CampaignInput["uncertainty"],
    k: k as CampaignInput["k"],
    evidence: b.evidence as boolean,
    approvals: b.approvals as boolean,
  };
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request);
  try {
    if (!env.DB) {
      return Response.json({ status: "unavailable", error: "Base D1 não vinculada." }, { status: 503, headers });
    }

    const campaignId = new URL(request.url).searchParams.get("campaignId");
    if (!campaignId) {
      return Response.json({ status: "error", error: "Parâmetro campaignId é obrigatório." }, { status: 400, headers });
    }

    const body = await request.json().catch(() => null);
    const input = parseCampaignInput(body);
    if (!input) {
      return Response.json({ status: "error", error: "Corpo da requisição inválido." }, { status: 400, headers });
    }

    const result = await saveCalibrationCampaign(env.DB, campaignId, input);
    if (!result.ok) {
      return Response.json({ status: "error", error: `Campanha não encontrada: ${campaignId}` }, { status: 404, headers });
    }

    const campaign = await loadCalibrationCampaign(env.DB, input.id);
    return Response.json({ status: "ok", campaign }, { headers });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const message = /no such table|D1_ERROR/i.test(detail)
      ? "A base real ainda não foi inicializada neste ambiente. A migração será aplicada na publicação."
      : "Falha ao gravar a base real.";
    return Response.json({ status: "error", error: message }, { status: 500, headers });
  }
}
