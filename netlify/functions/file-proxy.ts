// netlify/functions/file-proxy.ts
import type { Handler } from "@netlify/functions";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,HEAD,OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-expose-headers": "content-type,cache-control",
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }

    const raw = event.queryStringParameters?.url || "";
    if (!raw) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing url" }) };
    }

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Bad url" }) };
    }
    if (!/^https?:$/.test(target.protocol)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Only http(s) allowed" }) };
    }

    const upstream = await fetch(target.toString(), {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
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
    const b64 = buf.toString("base64");

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "content-type": contentType,
        "cache-control": "public, max-age=86400",
      },
      body: b64,
      isBase64Encoded: true, // 🔑
    };
  } catch (e: any) {
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: `Proxy error: ${e?.message || e}` }),
    };
  }
};
