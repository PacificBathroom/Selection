// netlify/functions/pdf-proxy.ts
import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) return { statusCode: 400, body: "Missing ?url=" };

    const upstream = await fetch(url as string);
    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";

    return {
      statusCode: upstream.status,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600",
      },
      isBase64Encoded: true,
      body: buf.toString("base64"),
    };
  } catch (e: any) {
    return { statusCode: 502, body: `Proxy error: ${e?.message || e}` };
  }
};
