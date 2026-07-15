// Shared by every route under app/api/calibration/. Meant to be called
// cross-origin by the calibration app's own standalone dev server (a
// separate local Vite instance, not part of this repo's build), so only
// localhost origins get an Access-Control-Allow-Origin — never "*".
export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? { "Access-Control-Allow-Origin": origin } : {};
}
