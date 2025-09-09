// netlify/functions/scrape.js
const cheerio = require('cheerio');

function abs(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href || '';
  }
}
const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();

function scorePdfCandidate({ text, href }) {
  const t = (text || '').toLowerCase();
  const u = (href || '').toLowerCase();

  // Positives first
  const positives = [
    'spec',
    'specification',
    'technical',
    'product sheet',
    'data sheet',
    'cut sheet',
    'brochure',
    'wels' // sometimes spec PDFs include WELS
  ];
  const negatives = [
    'account',
    'credit',
    'application',
    'privacy',
    'terms',
    'delivery',
    'shipping',
    'returns',
    'care',
    'warranty',
    'policy',
    'catalog',
    'price',
    'order',
    'quote'
  ];

  let score = 0;
  for (const p of positives) if (t.includes(p) || u.includes(p)) score += 5;
  for (const n of negatives) if (t.includes(n) || u.includes(n)) score -= 6;

  // Prefer links that live inside specs tab/area—caller can add +2
  return score;
}

exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: 'Missing ?url=' }) };

    const res = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: `HTTP ${res.status}` }) };
    const html = await res.text();
    const $ = cheerio.load(html);

    // Basic fields
    const name =
      clean($('meta[property="og:title"]').attr('content')) ||
      clean($('[itemtype*="schema.org/Product"] [itemprop="name"]').first().text()) ||
      clean($('h1').first().text());

    const code =
      clean($('meta[itemprop="sku"]').attr('content')) ||
      clean($('.sku, .product_meta .sku, [data-sku]').first().text()) || undefined;

    const description =
      clean($('meta[property="og:description"]').attr('content')) ||
      clean($('[itemtype*="schema.org/Product"] [itemprop="description"]').first().text()) ||
      clean($('.summary p, .product .summary p, .entry-content p').first().text()) || undefined;

    const image =
      abs(url, $('meta[property="og:image"]').attr('content')) ||
      abs(url, $('[itemtype*="schema.org/Product"] [itemprop="image"]').attr('src')) ||
      abs(url, $('img.wp-post-image').attr('src')) ||
      abs(url, $('.woocommerce-product-gallery__image img').first().attr('src')) || undefined;

    const gallerySet = new Set();
    $('a.woocommerce-product-gallery__image img, .woocommerce-product-gallery__image img, .product-gallery img, .gallery img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src) gallerySet.add(abs(url, src));
    });
    const gallery = Array.from(gallerySet);

    // Features
    const features = [];
    $('*[id*="feature"], *[class*="feature"], .product-features, .features').find('li').each((_, li) => {
      const t = clean($(li).text());
      if (t) features.push(t);
    });
    if (features.length === 0) {
      $('.entry-content ul, .product .summary ul').first().find('li').each((_, li) => {
        const t = clean($(li).text());
        if (t) features.push(t);
      });
    }

    // Specs (table/dl)
    const specs = [];
    $('table:contains(pecification) tr, table:contains(SPECIFICATION) tr').each((_, tr) => {
      const tds = $(tr).find('td, th');
      if (tds.length >= 2) {
        const label = clean($(tds[0]).text());
        const value = clean($(tds[1]).text());
        if (label && value) specs.push({ label, value });
      }
    });
    if (specs.length === 0) {
      const dl = $('dl').first();
      if (dl.length) {
        dl.find('dt').each((_, dt) => {
          const dd = $(dt).next('dd');
          const label = clean($(dt).text());
          const value = clean(dd.text());
          if (label && value) specs.push({ label, value });
        });
      }
    }

    // Compliance/tags heuristics
    const compliance = [];
    const tags = [];
    $('.product_meta .posted_in a, .product_meta .tagged_as a, a[rel="tag"]').each((_, a) => {
      const t = clean($(a).text());
      if (t) tags.push(t);
    });
    $('*:contains("WELS"), *:contains("AS1428"), *[class*="wels"], *[class*="as1428"]').each((_, el) => {
      const t = clean($(el).text());
      if (t && !compliance.includes(t)) compliance.push(t);
    });

    // ---- Asset discovery with scoring ----
    const assets = [];
    let specPdfUrl = null;

    function collectFrom($root, bonus = 0) {
      const candidates = [];
      $root.find('a[href$=".pdf"], a[href*=".pdf"]').each((_, a) => {
        const href = abs(url, $(a).attr('href'));
        const text = clean($(a).text());
        const baseScore = scorePdfCandidate({ text, href });
        candidates.push({ href, text, score: baseScore + bonus });
      });
      return candidates;
    }

    // Product-scoped containers (preferred)
    const productRoot = $('.product, .product-summary, .woocommerce-tabs, #tab-description, #tab-additional_information');
    let candidates = [];
    if (productRoot.length) candidates = candidates.concat(collectFrom(productRoot, 2));

    // If nothing, whole page
    if (candidates.length === 0) candidates = candidates.concat(collectFrom($, 0));

    // Push all as assets; pick best-scoring for specPdfUrl
    candidates.forEach(({ href, text, score }) => {
      assets.push({ label: text || 'Document', url: href, score });
    });

    if (candidates.length) {
      candidates.sort((a, b) => b.score - a.score);
      specPdfUrl = candidates[0].href;
    }

    // Ensure specPdfUrl appears first in assets list
    if (specPdfUrl) {
      const i = assets.findIndex(a => a.url === specPdfUrl);
      if (i > 0) assets.unshift(assets.splice(i, 1)[0]);
    }

    // brand/category (best-effort)
    const brand = clean($('.brand, .product-brands a, .product_meta .posted_in a').first().text()) || undefined;
    const category = clean($('.product_meta .posted_in a').first().text()) || undefined;

    // Response
    const body = {
      id: code || name || Date.now().toString(),
      name,
      code,
      description,
      image,
      gallery,
      features,
      specs,
      brand,
      tags,
      compliance,
      sourceUrl: url,
      category,
      assets: assets.map(({ score, ...a }) => a),
      specPdfUrl: specPdfUrl || undefined
    };

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err?.message || err) }) };
  }
};
