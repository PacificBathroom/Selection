// netlify/functions/pdf-proxy.js
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    let url = (qs.url || qs.u || "").trim();

    // Support base64 param to avoid encoding issues
    if (!url && qs.url_b64) {
      try { url = Buffer.from(String(qs.url_b64), "base64").toString("utf8").trim(); } catch {}
    }

    if (!url || !/^https?:\/\//i.test(url)) {
      return text(400,
        "Invalid or missing url. Use one of:\n" +
        "  ?url=<URL-ENCODED-ABSOLUTE-URL>\n" +
        "  ?u=<URL-ENCODED-ABSOLUTE-URL>\n" +
        "  ?url_b64=<BASE64-OF-ABSOLUTE-URL>\n"
      );
    }

    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) return text(r.status, `Upstream error ${r.status} for ${url}`);

    const buf = await r.arrayBuffer();
    const ct = r.headers.get("content-type") || "application/octet-stream";

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Content-Type": ct,
      },
      body: Buffer.from(buf).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return text(500, String(e && e.message ? e.message : e));
  }
};

function text(status, body) {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
    body,
  };
}
