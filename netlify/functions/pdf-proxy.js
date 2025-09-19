// netlify/functions/pdf-proxy.js
// A tiny fetch proxy for images/PDFs so the browser can read cross-origin files.
// Usage: /api/pdf-proxy?url=<encoded URL>

export async function handler(event) {
  try {
    const url = (event.queryStringParameters && event.queryStringParameters.url) || "";
    if (!url) {
      return { statusCode: 400, headers: cors(), body: "Missing url" };
    }

    // Basic safety: only allow http/https and strip CRLF etc.
    const safe = String(url).trim();
    if (!/^https?:\/\//i.test(safe)) {
      return { statusCode: 400, headers: cors(), body: "Invalid protocol" };
    }

    // Fetch upstream (stream to client)
    const resp = await fetch(safe, {
      redirect: "follow",
      headers: {
        // Some servers require a UA
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept:
          "image/avif,image/webp,image/apng,image/*,application/pdf,*/*;q=0.8",
      },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: cors({ "Content-Type": "text/plain" }),
        body: `Upstream error ${resp.status}`,
      };
    }

    // Pass through content-type; default to octet-stream
    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await resp.arrayBuffer();
    const buff = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers: cors({
        "Content-Type": contentType,
        // Let the browser cache for a bit to speed repeat runs
        "Cache-Control": "public, max-age=3600",
      }),
      body: buff.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: cors({ "Content-Type": "text/plain" }),
      body: "Bad Gateway",
    };
  }
}

function cors(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    ...extra,
  };
}

// netlify/functions/pdf-proxy.js
export default async (req, context) => {
  const url = new URL(req.url).searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return new Response("Missing or invalid ?url=", { status: 400 });
  }

  try {
    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
    }

    const headers = new Headers();
    // pass through useful headers
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    headers.set("content-type", ct);
    headers.set("cache-control", "public, max-age=3600");
    headers.set("access-control-allow-origin", "*");

    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return new Response("Proxy fetch failed", { status: 502 });
  }
};

