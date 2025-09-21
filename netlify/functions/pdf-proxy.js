import type { Handler } from "@netlify/functions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler: Handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS };
  }

  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing url" }) };
    }

    // Follow redirects and fetch the upstream file (image/pdf/html)
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        // Some hosts refuse requests without a browsery UA
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      },
    });

    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        headers: CORS,
        body: JSON.stringify({ error: `Upstream ${upstream.status} ${upstream.statusText}` }),
      };
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await upstream.arrayBuffer());

    // Return binary as base64
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Proxy error", detail: e?.message || String(e) }),
    };
  }
};
