// netlify/functions/file-proxy.ts
import type { Handler } from "@netlify/functions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }

    const url = event.queryStringParameters?.url;
    if (!url) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing url" }) };
    }

    // Pretend to be a browser to avoid hotlink blocks; follow redirects.
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36",
        "Accept": "*/*",
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
    const arrayBuf = await upstream.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": contentType,                // lets the client know the real type
        "Cache-Control": "public, max-age=86400",   // 1-day cache
      },
      body: base64,
      isBase64Encoded: true, // 🔑 without this, images break
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err?.message || "Proxy error" }),
    };
  }
};
