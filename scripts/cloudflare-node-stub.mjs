// Node's plain ESM loader has no `cloudflare:*` scheme — only workerd does.
// validate-artifact.sh runs the built worker under plain Node just to check
// its shape (ESM default export with fetch()), so real bindings are never
// needed here. This hook substitutes an inert stub for any `cloudflare:*`
// import so that check can still import the bundle.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("cloudflare:")) {
    return { url: `cloudflare-node-stub:${specifier}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("cloudflare-node-stub:")) {
    return {
      format: "module",
      shortCircuit: true,
      source: "export const env = new Proxy({}, { get: () => undefined });\nexport default { env };",
    };
  }
  return nextLoad(url, context);
}
