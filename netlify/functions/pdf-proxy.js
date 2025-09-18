import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url || "";
    if (!url) return { statusCode: 400, body: "Missing ?url=" };

    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok) {
      return { statusCode: upstream.status, body: `Upstream error: ${upstream.status}` };
    }

    const arrayBuf = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";

    return {
      statusCode: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600",
      },
      isBase64Encoded: true,
      body: Buffer.from(arrayBuf).toString("base64"),
    };
  } catch (e: any) {
    return { statusCode: 500, body: `Proxy error: ${e?.message || e}` };
  }
};
