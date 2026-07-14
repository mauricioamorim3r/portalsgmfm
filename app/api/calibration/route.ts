import { env } from "cloudflare:workers";
import { loadCalibrationCampaign } from "../../../db/calibration";

export async function GET(request: Request) {
  try {
    if (!env.DB) {
      return Response.json({ status: "unavailable", error: "Base D1 não vinculada." }, { status: 503 });
    }

    const campaignId = new URL(request.url).searchParams.get("campaignId");
    if (!campaignId) {
      const { results } = await env.DB.prepare(
        `SELECT campaign_id, tag, well, asset, revision FROM calibration_campaigns ORDER BY created_at DESC`,
      ).all();
      return Response.json({ status: "ok", campaigns: results ?? [] });
    }

    const campaign = await loadCalibrationCampaign(env.DB, campaignId);
    if (!campaign) {
      return Response.json({ status: "error", error: `Campanha não encontrada: ${campaignId}` }, { status: 404 });
    }

    return Response.json({ status: "ok", campaign });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const message = /no such table|D1_ERROR/i.test(detail)
      ? "A base real ainda não foi inicializada neste ambiente. A migração será aplicada na publicação."
      : "Falha ao consultar a base real.";
    return Response.json({ status: "error", error: message }, { status: 500 });
  }
}
