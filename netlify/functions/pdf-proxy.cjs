// netlify/functions/pdf-proxy.cjs
const ALLOW = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

exports.handler = async (event) => {
  const url = event.queryStringParameters && event.queryStringParameters.url;
  if (!url) return { statusCode: 400, headers: ALLOW, body: 'Missing url' };

  try {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());

    return {
      statusCode: res.status,
      headers: {
        ...ALLOW,
        'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 502, headers: ALLOW, body: `Fetch failed: ${String(e)}` };
  }
};
