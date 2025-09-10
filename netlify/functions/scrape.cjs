// netlify/functions/scrape.cjs
// Fetches a product page, extracts clean fields, normalises specs, and chooses the best spec PDF.
// Returns JSON: { id, code, name, brand, category, image, gallery, description, features, specs, compliance, tags, sourceUrl, specPdfUrl, assets }

const cheerio = require('cheerio');

/** absolute URL helper */
function absUrl(u, base) {
  if (!u) return undefined;
  try {
    return new URL(u, base).toString();
  } catch {
    return u;
  }
}

/** clean text (no .replaceAll for older targets) */
function cleanText(s, maxLen = 1600) {
  if (!s) return undefined;
  let t = String(s)
    .replace(/window\._wpemojiSettings[\s\S]*?\};?/gi, ' ')
    .replace(/\/\*![\s\S]*?\*\//g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > maxLen) t = t.slice(0, maxLen).trimEnd() + '…';
  return t || undefined;
}

/** score candidate PDF links; prefer spec/datasheet/technical; avoid credit/application */
function scorePdf(href, text) {
  const s = `${href} ${text || ''}`.toLowerCase();
  let score = 0;
  // positive signals
  if (/\bspec/i.test(s)) score += 5;                 // spec/specification
  if (/datasheet|technical|tech\s*sheet/i.test(s)) score += 4;
  if (/install|installation/i.test(s)) score += 1;
  if (/product\-sheet|cut\s*sheet/i.test(s)) score += 2;
  // negative signals
  if (/credit|application|returns|account/i.test(s)) score -= 10;
  if (/warranty|privacy|terms/i.test(s)) score -= 2;
  return score;
}

/** try to extract a two-column spec table: [{label,value}] */
function extractSpecTable($, base) {
  const out = [];

  // WooCommerce attributes table
  $('table.woocommerce-product-attributes, table.shop_attributes').each((i, tbl) => {
    $(tbl)
      .find('tr')
      .each((j, tr) => {
        const k = cleanText($(tr).find('th, .label').first().text());
        const v = cleanText($(tr).find('td, .value').first().text());
        if (k || v) out.push({ label: k || '', value: v || '' });
      });
  });
  if (out.length) return out;

  // Any table with th/td pairs
  $('table').each((i, tbl) => {
    const rows = [];
    $(tbl)
      .find('tr')
      .each((j, tr) => {
        const th = cleanText($(tr).find('th').first().text());
        const td = cleanText($(tr).find('td').first().text());
        if ((th || td) && (th || '').length < 64) rows.push({ label: th || '', value: td || '' });
      });
    if (rows.length >= 3) {
      out.push(...rows);
      return false; // take the first good-looking table
    }
  });

  return out;
}

/** fallback: definition lists or bullet lists */
function extractSpecList($) {
  const out = [];

  // <dl><dt>Label</dt><dd>Value</dd>
  $('dl').each((i, dl) => {
    const rows = [];
    const $dl = $(dl);
    const dts = $dl.find('dt');
    const dds = $dl.find('dd');
    if (dts.length && dds.length && dts.length === dds.length) {
      dts.each((j, dt) => {
        const k = cleanText($(dt).text());
        const v = cleanText($(dds[j]).text());
        if (k || v) rows.push({ label: k || '', value: v || '' });
      });
    }
    if (rows.length >= 3) {
      out.push(...rows);
      return false;
    }
  });
  if (out.length) return out;

  // lists with "Label: Value"
  const rows = [];
  $('ul li, ol li').each((i, li) => {
    const t = cleanText($(li).text());
    if (!t) return;
    const parts = t.split(':');
    if (parts.length >= 2 && parts[0].length < 64) {
      rows.push({ label: parts[0].trim(), value: parts.slice(1).join(':').trim() });
    }
  });
  if (rows.length >= 3) return rows;

  return [];
}

/** extract image + gallery */
function extractImages($, base) {
  const seen = new Set();
  const gallery = [];

  // Preferred: product gallery images
  $('.woocommerce-product-gallery img, .product-gallery img, .gallery img, figure img, .product img').each((i, img) => {
    const src =
      $(img).attr('data-large_image') ||
      $(img).attr('data-src') ||
      $(img).attr('src') ||
      $(img).attr('srcset')?.split(' ')[0];
    const u = absUrl(src, base);
    if (u && !seen.has(u)) {
      seen.add(u);
      gallery.push(u);
    }
  });

  // og:image fallback
  const og = absUrl($('meta[property="og:image"]').attr('content'), base);
  if (og && !seen.has(og)) {
    seen.add(og);
    gallery.unshift(og);
  }

  return {
    image: gallery[0],
    gallery,
  };
}

/** simple features extraction */
function extractFeatures($) {
  const out = [];
  // obvious features containers
  $('.features, .product-features, .key-features, .fa-check, .icon-check')
    .closest('ul,ol')
    .find('li')
    .each((i, li) => {
      const t = cleanText($(li).text());
      if (t && t.length > 2) out.push(t);
    });

  if (out.length) return out;

  // generic bullet lists near content
  $('article ul, .summary ul, .entry-content ul, .product-summary ul').each((i, ul) => {
    $(ul)
      .find('li')
      .each((j, li) => {
        const t = cleanText($(li).text());
        if (t && t.length > 2) out.push(t);
      });
    if (out.length >= 4) return false;
  });

  return out.slice(0, 12);
}

exports.handler = async (event) => {
  try {
    const url = (event.queryStringParameters && event.queryStringParameters.url) || '';
    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing url' }) };
    }

    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 ProductScraper' } });
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: `Failed to fetch page (${res.status})` }) };
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      cleanText($('h1').first().text()) ||
      cleanText($('meta[property="og:title"]').attr('content')) ||
      cleanText($('title').text());

    // description/meta
    const metaDesc = cleanText($('meta[name="description"]').attr('content'));
    let description = metaDesc;
    if (!description) {
      description = cleanText($('.summary, .entry-content, .product-short-description, article').first().text(), 1200);
    }

    // SKU/code
    const code =
      cleanText($('[itemprop="sku"]').first().text()) ||
      cleanText($('.sku').first().text()) ||
      (/\bSKU[:\s]*([A-Z0-9\-\._]+)/i.exec(html) || [])[1];

    // brand/category (best-effort)
    const brand =
      cleanText($('[itemprop="brand"]').first().text()) ||
      cleanText($('meta[property="og:site_name"]').attr('content')) ||
      undefined;
    const category =
      cleanText($('.posted_in a').first().text()) ||
      cleanText($('meta[property="article:section"]').attr('content')) ||
      undefined;

    const { image, gallery } = extractImages($, url);
    const features = extractFeatures($);

    // COMPLIANCE (simple pass — often listed in bullets)
    const compliance = [];
    $('*').each((i, el) => {
      const t = cleanText($(el).text());
      if (!t) return;
      if (/code|standard|wels|as\/nz/i.test(t) && t.length < 120) {
        compliance.push(t);
      }
    });

    // SPECS
    let specs = extractSpecTable($, url);
    if (!specs.length) specs = extractSpecList($);

    // ALL PDF LINKS (for assets + picking specPdfUrl)
    const pdfAnchors = [];
    $('a[href$=".pdf"], a[href*=".pdf?"]').each((i, a) => {
      const href = $(a).attr('href');
      const label = cleanText($(a).text());
      const u = absUrl(href, url);
      if (u) pdfAnchors.push({ url: u, label });
    });

    // Choose the best spec PDF
    let specPdfUrl;
    if (pdfAnchors.length) {
      let best = null;
      let bestScore = -1e9;
      for (const a of pdfAnchors) {
        const sc = scorePdf(a.url, a.label);
        if (sc > bestScore) {
          best = a;
          bestScore = sc;
        }
      }
      if (bestScore >= 0) specPdfUrl = best.url; // only keep if non-negative score
    }

    // Generic assets (pdfs/images)
    const assets = [];
    for (const a of pdfAnchors) {
      assets.push({ url: a.url, label: a.label || 'PDF' });
    }
    // include gallery images as assets too
    for (const g of gallery || []) {
      assets.push({ url: g });
    }

    const data = {
      id: code || title || url,
      code: code || undefined,
      name: title || 'Imported Product',
      brand: brand || undefined,
      category: category || undefined,
      image: image || undefined,
      gallery: gallery && gallery.length ? gallery : undefined,
      description: description || undefined,
      features: features && features.length ? features : undefined,
      specs: specs && specs.length ? specs : undefined, // array of {label,value}
      compliance: compliance && compliance.length ? Array.from(new Set(compliance)).slice(0, 12) : undefined,
      tags: undefined,
      sourceUrl: url,
      specPdfUrl: specPdfUrl || undefined,
      assets: assets.length ? assets : undefined,
    };

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Scrape failed' }) };
  }
};
