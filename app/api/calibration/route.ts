import { env } from "cloudflare:workers";
import { loadCalibrationCampaign } from "../../../db/calibration";

// This endpoint is meant to be called cross-origin by the standalone MPFM
// calibration app (a separate local dev server, not part of this repo), so
// only localhost origins get an Access-Control-Allow-Origin — never "*".
function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? { "Access-Control-Allow-Origin": origin } : {};
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: { ...corsHeaders(request), "Access-Control-Allow-Methods": "GET" } });
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
