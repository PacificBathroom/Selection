// netlify/functions/pdf-proxy.cjs
const ALLOW = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

function guessType(url) {
  try {
    const u = new URL(url);
    const ext = (u.pathname.split('.').pop() || '').toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'svg') return 'image/svg+xml';
    if (ext === 'pdf') return 'application/pdf';
  } catch {}
  return 'application/octet-stream';
}

exports.handler = async (event) => {
  const url = event.queryStringParameters && event.queryStringParameters.url;
  if (!url) return { statusCode: 400, headers: ALLOW, body: 'Missing url' };

  try {
    const upstream = await fetch(url, {
      // Some sites expect browser-ish headers
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Accept':
          'image/avif,image/webp,image/apng,image/*,*/*;q=0.8,application/pdf;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        // Many WP/CDN setups allow images only with a same-origin-ish referer:
        // using the upstream origin here helps them allow the fetch.
        'Referer': (() => { try { return new URL(url).origin; } catch { return undefined; } })() || '',
      },
      redirect: 'follow',
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get('content-type') || guessType(url);

    return {
      statusCode: upstream.status,
      headers: {
        ...ALLOW,
        'Content-Type': type,
        'Cache-Control': 'public, max-age=3600',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 502, headers: ALLOW, body: `Fetch failed: ${String(e)}` };
  }
};
