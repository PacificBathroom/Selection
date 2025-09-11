// netlify/functions/pdf-proxy.js
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    let url = (qs.url || qs.u || "").trim();
    if (!url && qs.url_b64) {
      try { url = Buffer.from(String(qs.url_b64), "base64").toString("utf8").trim(); } catch {}
    }
    try { url = decodeURIComponent(url); } catch {}

    const debug = String(qs.debug || "") === "1";
    if (!url || !/^https?:\/\//i.test(url)) return text(400, "Invalid or missing url");

    const r = await fetch(url, {
      redirect: "follow",
      headers: {
        // Some hosts (incl. Drive/CDNs) behave better with these:
        "User-Agent": "Mozilla/5.0 (compatible; NetlifyPDFProxy/1.0)",
        "Accept": "*/*",
      },
    });

    const ct = r.headers.get("content-type") || "application/octet-stream";
    if (debug) {
      return json(200, {
        requestedUrl: url,
        finalUrl: r.url,
        status: r.status,
        ok: r.ok,
        contentType: ct,
      });
    }
    if (!r.ok) return text(r.status, `Upstream error ${r.status} for ${r.url}`);

    const buf = await r.arrayBuffer();
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
function json(status, data) {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data, null, 2),
  };
}