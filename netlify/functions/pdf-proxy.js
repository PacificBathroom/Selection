import type { Handler } from "@netlify/functions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler: Handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing url" }) };
    }

    // Follow redirects and fetch the upstream file (image/pdf/html)
    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        headers: CORS,
        body: JSON.stringify({ error: `Upstream ${upstream.status} ${upstream.statusText}` }),
      };
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await upstream.arrayBuffer());

    // Return binary as base64 so the browser can consume it safely
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