/**
 * Shared JSON response for the Worker's /api/* routes. `_headers` only covers static files, so
 * the API sets its own hardening here: JSON can't be sniffed as anything else, can't be
 * framed or run as a page, and is only meant for this site's own pages.
 */
export const json = (body, status = 200, cache = 'no-store', extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
      ...extra,
    },
  });
