// netlify/functions/pdf-proxy.js
// Classic Netlify Function (CommonJS). No imports/TypeScript.


const DEBUG = true;
const dlog = (...a: any[]) => DEBUG && console.log("[pptx]", ...a);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
};

exports.handler = async (event) => {
  // Preflight/HEAD
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS };
  }
  if (event.httpMethod === "HEAD") {
    return { statusCode: 200, headers: CORS };
  }

  try {
    const url = event.queryStringParameters && event.queryStringParameters.url;
    if (!url || !/^https?:\/\//i.test(url)) {
      return { statusCode: 400, headers: CORS, body: "Missing or invalid ?url=" };
    }

    const resp = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept:
          "image/avif,image/webp,image/apng,image/*,application/pdf,*/*;q=0.8",
      },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { ...CORS, "Content-Type": "text/plain" },
        body: `Upstream error ${resp.status}`,
      };
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await resp.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch {
    return { statusCode: 502, headers: CORS, body: "Proxy fetch failed" };
  }
};