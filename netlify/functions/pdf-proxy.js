// netlify/functions/pdf-proxy.js
// Fetch a remote file and return it to the browser, working around CORS.
// - Follows redirects
// - Tries HTTPS, then HTTP (or vice versa) if the first fails
export const handler = async (event) => {
  try {
    const raw = event.queryStringParameters?.url || "";
    const url = new URL(raw);

    if (!/^https?:$/i.test(url.protocol)) {
      return { statusCode: 400, body: "Only http/https URLs are allowed" };
    }

    const fetchOnce = async (u) => {
      const r = await fetch(u, { redirect: "follow" });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      const ct = r.headers.get("content-type") || "application/octet-stream";
      const buf = Buffer.from(await r.arrayBuffer());
      return { ct, b64: buf.toString("base64") };
    };

    let out;
    try {
      out = await fetchOnce(url.toString());
    } catch {
      // Flip protocol (helps with odd TLS configs)
      const flipped = new URL(url.toString());
      flipped.protocol = url.protocol === "https:" ? "http:" : "https:";
      out = await fetchOnce(flipped.toString());
    }

    return {
      statusCode: 200,
      headers: { "content-type": out.ct },
      body: out.b64,
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
};
