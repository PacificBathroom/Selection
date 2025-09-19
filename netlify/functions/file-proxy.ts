// netlify/functions/file-proxy.ts
import type { Handler } from "@netlify/functions";

/**
 * Simple streaming proxy for images/PDFs/etc.
 * Usage:  /api/file-proxy?url=https://example.com/whatever.jpg
 */
export const handler: Handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return { statusCode: 400, body: "Missing ?url=" };
    }

    // Basic allowlist; expand if you need
    const bad = !/^https?:\/\//i.test(url);
    if (bad) return { statusCode: 400, body: "Invalid URL" };

    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return { statusCode: upstream.status, body: `Upstream error ${upstream.status}` };
    }

    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    };

    const ct = upstream.headers.get("content-type");
    if (ct) headers["Content-Type"] = ct;

    const ab = await upstream.arrayBuffer();
    return {
      statusCode: 200,
      headers,
      body: Buffer.from(ab).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e: any) {
    return { statusCode: 500, body: `Proxy error: ${e?.message || e}` };
  }
};