// netlify/functions/pdf-proxy.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async (event) => {
  try {
    const url = (event.queryStringParameters && event.queryStringParameters.url) || "";
    if (!url || !/^https?:\/\//i.test(url)) {
      return resp(400, "Invalid or missing url");
    }

    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) return resp(r.status, `Upstream error ${r.status}`);

    const buf = await r.arrayBuffer();

    // Try to keep the original content-type, fall back to octet-stream
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
    return resp(500, String(e && e.message ? e.message : e));
  }
};

function resp(status, msg) {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain",
    },
    body: msg,
  };
}
