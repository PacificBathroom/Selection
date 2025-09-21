// netlify/functions/pdf-proxy.ts
import type { Handler } from "@netlify/functions";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,HEAD,OPTIONS",
  "access-control-allow-headers": "Content-Type, Range",
};

export const handler: Handler = async (event) => {
  const url = event.queryStringParameters?.url?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return { statusCode: 400, headers: CORS, body: "Missing or invalid ?url=" };
  }

  try {
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept:
          "image/avif,image/webp,image/apng,image/*,application/pdf,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        headers: { ...CORS, "content-type": "text/plain" },
        body: `Upstream error ${upstream.status}`,
      };
    }

    const type = upstream.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await upstream.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "content-type": type,
        "cache-control": "public, max-age=3600",
      },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err: any) {
    return {
      statusCode: 502,
      headers: { ...CORS, "content-type": "text/plain" },
      body: `Proxy error: ${err?.message || err}`,
    };
  }
};