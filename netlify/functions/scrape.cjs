// netlify/functions/scrape.cjs
const cheerio = require('cheerio');

function abs(u, base) {
  if (!u) return undefined;
  try { return new URL(u, base).toString(); } catch { return u; }
}
function textClean(s) {
  if (!s) return '';
  return String(s)
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\bhttps?:\/\/\S+/gi, ' ')
    .replace(/\S{120,}/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function uniq(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }

function scorePdfCandidate($, a, base) {
  const $a = $(a);
  const href = abs($a.attr('href'), base);
  if (!href) return null;

  const text = ($a.text() || '').toLowerCase();
  const titleAttr = ($a.attr('title') || '').toLowerCase();
  const fname = href.split('/').pop().toLowerCase();
  const nearby = ($a.closest('li, p, div').text() || '').toLowerCase();
  const label = `${text} ${titleAttr} ${fname} ${nearby}`;

  const POS = [/spec/i, /technical|tech/i, /dimension|drawing|diagram|line[-\s]?drawing/i,
               /install|instruction|guide|manual/i, /data.?sheet|product.?sheet|info.?sheet/i,
               /wels|size|cut.?out|template/i];
  const NEG = [/credit|application|account/i, /terms|policy|privacy|returns?/i, /trade|form/i];

  let score = 0;
  POS.forEach(re => { if (re.test(label)) score += 5; });
  NEG.forEach(re => { if (re.test(label)) score -= 6; });

  try { if (new URL(href).hostname === new URL(base).hostname) score += 1; } catch {}
  if (/uploads/i.test(href)) score += 1;
  return { href, score };
}

exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters && event.queryStringParameters.url;
    if (!url) return { statusCode: 400, body: 'Missing ?url=' };

    const resp = await fetch(url, {
      headers: {
        'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    if (!resp.ok) return { statusCode: resp.status, body: `Failed to fetch page (${resp.status})` };

    const html = await resp.text();
    const $ = cheerio.load(html);
    const base = url;

    /* title / sku */
    const title = textClean(
      $('meta[property="og:title"]').attr('content') ||
      $('h1.product_title, h1.entry-title, h1').first().text() ||
      $('title').first().text() || ''
    );
    const sku =
      $('.product_meta .sku').first().text().trim() ||
      $(':contains("SKU")').filter('span,td,th,div').first().text().replace(/SKU[:\s]*/i,'').trim() ||
      undefined;

    /* description (prefer short/tab desc; keep marketing copy, not code) */
    const $short = $('.woocommerce-product-details__short-description').first();
    const $tabDesc = $('.woocommerce-Tabs-panel--description, #tab-description').first();
    const metaDesc = $('meta[name="description"]').attr('content');
    const description = textClean(
      ($short.length ? $short.text() : '') ||
      ($tabDesc.length ? $tabDesc.text() : '') ||
      metaDesc || ''
    ) || undefined;

    /* features (any UL bullets inside short or description tab) */
    const features = uniq(
      []
        .concat($short.find('li').map((i, el) => textClean($(el).text())).get())
        .concat($tabDesc.find('li').map((i, el) => textClean($(el).text())).get())
    );

    /* specs: 1) Woo attribute table 2) fallback tables 3) SPECIFICATIONS block "Label: Value" lines */
    let specs = $('.woocommerce-product-attributes tr')
      .map((i, tr) => {
        const label = textClean($(tr).find('th').text());
        const value = textClean($(tr).find('td').text());
        if (!label && !value) return null;
        return { label, value };
      })
      .get();

    if (!specs.length) {
      $('h2,h3,h4').each((i, h) => {
        if (!/specifications?/i.test($(h).text())) return;
        const $table = $(h).nextAll('table').first();
        if ($table.length) {
          const rows = $table.find('tr').map((j, tr) => {
            const tds = $(tr).find('th,td');
            const label = textClean($(tds[0]).text());
            const value = textClean($(tds[1]).text());
            if (!label && !value) return null;
            return { label, value };
          }).get();
          if (rows.length) specs = rows;
        }
      });
    }

    // 3) SPECIFICATIONS block with paragraphs / lines like "Colour: Polished Chrome, ..."
    if (!specs.length) {
      $('h2,h3,h4').each((i, h) => {
        if (!/specifications?/i.test($(h).text())) return;
        const $block = $(h).nextUntil('h2,h3,h4'); // capture until next header
        const pairs = [];
        $block.each((j, el) => {
          const txt = textClean($(el).text());
          if (!txt) return;
          // split by newlines / dots as last resort
          const chunks = txt.split(/[\n•]+/g).map(s => s.trim()).filter(Boolean);
          chunks.forEach(line => {
            const m = line.match(/^([^:]+):\s*(.+)$/); // Label: Value
            if (m) {
              pairs.push({ label: textClean(m[1]), value: textClean(m[2]) });
            }
          });
        });
        if (pairs.length) { specs = pairs; return false; }
      });
    }

    /* compliance under a "Compliance" heading (UL bullets) */
    let compliance = [];
    $('h2,h3,h4').each((i, el) => {
      if (/compliance/i.test($(el).text())) {
        compliance = $(el).nextAll('ul').first().find('li')
          .map((j, li) => textClean($(li).text())).get();
      }
    });

    /* image(s) */
    const ogImage = $('meta[property="og:image"]').attr('content');
    const gallery = uniq(
      $('figure.woocommerce-product-gallery__image img')
        .map((i, img) => {
          const $img = $(img);
          return $img.attr('data-large_image') || $img.attr('data-src') || $img.attr('src');
        })
        .get()
        .map(u => abs(u, base))
    );
    const assetImgs = uniq(
      $('a[href]').map((i, a) => $(a).attr('href')).get()
        .map(u => abs(u, base))
        .filter(u => !!u && /\.(png|jpe?g|webp|gif|bmp)$/i.test(u))
    );
    const image = abs(ogImage, base) || (gallery[0]) || (assetImgs[0]);

    /* PDFs */
    const pdfCandidates = $('a[href$=".pdf"], a[href*=".pdf"]')
      .map((i, a) => scorePdfCandidate($, a, base)).get()
      .filter(Boolean).sort((a,b) => b.score - a.score);
    const specPdfUrl = pdfCandidates.length ? pdfCandidates[0].href : undefined;
    const assets = uniq(pdfCandidates.map(c => c.href)).map(u => ({ url: u, label: 'PDF' }));

    const out = {
      id: sku || title || url,
      code: sku,
      title,
      name: title,
      description,
      features: features.length ? features : undefined,
      specs: specs.length ? specs : undefined,
      compliance: compliance.length ? compliance : undefined,
      image,
      gallery: gallery.length ? gallery : undefined,
      specPdfUrl: specPdfUrl || undefined,
      assets: assets.length ? assets : undefined,
      sourceUrl: url,
    };

    return { statusCode: 200, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(out) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Scrape error' };
  }
};
