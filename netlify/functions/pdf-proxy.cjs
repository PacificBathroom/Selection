// Generic proxy for images and PDFs to avoid CORS/tainted canvas
exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters && event.queryStringParameters.url;
    if (!url) return { statusCode: 400, body: 'Missing ?url=' };

    const resp = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      },
      redirect: 'follow',
    });
    if (!resp.ok) return { statusCode: resp.status, body: 'Upstream fetch failed' };

    const ct = resp.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await resp.arrayBuffer());

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
      body: buf.toString('base64'),
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: 'Proxy error' };
  }
};