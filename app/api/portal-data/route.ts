import { env } from "cloudflare:workers";
import { loadPortalData } from "../../../db/portal-data";

export async function GET() {
  try {
    if (!env.DB) {
      return Response.json({ status: "unavailable", error: "Base D1 não vinculada." }, { status: 503 });
    }

    const data = await loadPortalData(env.DB);

    return Response.json({ status: "ok", generatedAt: new Date().toISOString(), ...data });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const message = /no such table|D1_ERROR/i.test(detail)
      ? "A base real ainda não foi inicializada neste ambiente. A migração será aplicada na publicação."
      : "Falha ao consultar a base real.";
    return Response.json({ status: "error", error: message }, { status: 500 });
  }
}
