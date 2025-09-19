// netlify/functions/pdf-proxy.js
// Fetches a remote file and returns it to the browser, bypassing CORS.
// More robust against HTTPS↔HTTP mismatches and picky origin servers.

export const handler = async (event) => {
  try {
    const raw = event.queryStringParameters?.url || "";
    const url = new URL(raw);

    if (!/^https?:$/i.test(url.protocol)) {
      return { statusCode: 400, body: "Only http/https URLs are allowed" };
    }

    const fetchOnce = async (u) => {
      const r = await fetch(u, {
        redirect: "follow",
        headers: {
          // Some hosts are picky about missing UA/accept headers
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.8",
        },
      });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      const ct = r.headers.get("content-type") || "application/octet-stream";
      const buf = Buffer.from(await r.arrayBuffer());
      return { ct, b64: buf.toString("base64") };
    };

    let out;
    try {
      out = await fetchOnce(url.toString());
    } catch {
      // Flip protocol (helps when the origin only serves one of http/https)
      const flipped = new URL(url.toString());
      flipped.protocol = url.protocol === "https:" ? "http:" : "https:";
      out = await fetchOnce(flipped.toString());
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": out.ct,
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*", // not strictly needed, but harmless
      },
      body: out.b64,
      isBase64Encoded: true,
    };
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: String(e?.message || e) }),
    };
  }
};
