// Netlify function: file-proxy.js
export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  try {
    const raw = event.queryStringParameters?.url;
    if (!raw) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing url" }),
      };
    }

    // Pretend to be a browser, follow redirects
    const upstream = await fetch(raw, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "*/*",
      },
    });

    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: `Upstream ${upstream.status} ${upstream.statusText}`,
        }),
      };
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buf = await upstream.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
      body: base64,
      isBase64Encoded: true, // <- important so browsers receive binary
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e?.message || "Proxy error" }),
    };
  }
}
