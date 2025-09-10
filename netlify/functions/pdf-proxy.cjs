exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) return { statusCode: 400, body: 'Missing ?url=' };

    const res = await fetch(url);
    if (!res.ok) return { statusCode: res.status, body: `Upstream ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
