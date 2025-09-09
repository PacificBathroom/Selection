// netlify/functions/scrape.js
// Requires: cheerio (npm i cheerio)
const cheerio = require('cheerio');

function abs(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function textClean(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing ?url= param' }),
      };
    }

    // Fetch page (Node 20 has fetch)
    const res = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: `HTTP ${res.status}` }) };
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // --- NAME / TITLE ---
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const schemaTitle = $('[itemtype*="schema.org/Product"] [itemprop="name"]').first().text();
    const h1 = $('h1').first().text();
    const name = textClean(ogTitle || schemaTitle || h1);

    // --- CODE / SKU (best-effort) ---
    const skuMeta = $('meta[itemprop="sku"]').attr('content');
    const skuText =
      $('[class*="sku"], [data-sku], .product_meta .sku')
        .first()
        .text();
    const code = textClean(skuMeta || skuText);

    // --- DESCRIPTION ---
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const descSchema = $('[itemtype*="schema.org/Product"] [itemprop="description"]').text();
    // Many WP product pages have a summary near the top:
    const mainDesc = $('.summary, .product-summary, .product .summary, .entry-content p')
      .first()
      .text();
    const description = textClean(ogDesc || descSchema || mainDesc);

    // --- HERO IMAGE ---
    const ogImg = $('meta[property="og:image"]').attr('content');
    const schemaImg = $('[itemtype*="schema.org/Product"] [itemprop="image"]').attr('src');
    const mainImg =
      $('img.wp-post-image, .product img, .woocommerce-product-gallery__image img').attr('src') ||
      $('img').first().attr('src');
    const image = abs(url, ogImg || schemaImg || mainImg || '');

    // --- GALLERY ---
    const gallerySet = new Set();
    $('a.woocommerce-product-gallery__image img, .woocommerce-product-gallery__image img, .product-gallery img, .gallery img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src) gallerySet.add(abs(url, src));
    });
    const gallery = Array.from(gallerySet);

    // --- FEATURES (bullets) ---
    const features = [];
    // Look for tab/panel labelled Features or lists near description
    const featureBlocks = $('*[id*="feature"], *[class*="feature"], .product-features, .features');
    featureBlocks.find('li').each((_, li) => {
      const t = textClean($(li).text());
      if (t) features.push(t);
    });
    if (features.length === 0) {
      // as fallback: first <ul> under product content
      $('.entry-content ul, .product .summary ul').first().find('li').each((_, li) => {
        const t = textClean($(li).text());
        if (t) features.push(t);
      });
    }

    // --- SPECIFICATIONS (label/value) ---
    const specs = [];
    // try tables first
    $('table:contains(pecification), table:contains(Specifications)').first().find('tr').each((_, tr) => {
      const tds = $(tr).find('td, th');
      if (tds.length >= 2) {
        const label = textClean($(tds[0]).text());
        const value = textClean($(tds[1]).text());
        if (label && value) specs.push({ label, value });
      }
    });
    // fallback: definition lists
    if (specs.length === 0) {
      $('dl').first().find('dt').each((i, dt) => {
        const dd = $(dt).next('dd');
        const label = textClean($(dt).text());
        const value = textClean(dd.text());
        if (label && value) specs.push({ label, value });
      });
    }

    // --- COMPLIANCE / TAGS ---
    const compliance = [];
    const tags = [];
    $('.product_meta .posted_in a, .product_meta .tagged_as a, a[rel="tag"]').each((_, a) => {
      const t = textClean($(a).text());
      if (t) tags.push(t);
    });
    // best-effort compliance from visible badges/labels
    $('*[class*="wels"], *[class*="as1428"], *:contains("WELS"), *:contains("AS1428")').each((_, el) => {
      const t = textClean($(el).text());
      if (t && !compliance.includes(t)) compliance.push(t);
    });

    // --- ASSETS / PDFs (prefer ones around "Specifications") ---
    const assets = [];
    let specPdfUrl = null;
    $('a[href$=".pdf"], a[href*=".pdf"]').each((_, a) => {
      const href = $(a).attr('href');
      if (!href) return;
      const label = textClean($(a).text()).toLowerCase();
      const absolute = abs(url, href);
      const isSpec =
        label.includes('spec') ||
        $(a).closest('*:contains("Specifications")').length > 0;
      if (!specPdfUrl && isSpec) specPdfUrl = absolute;
      assets.push({
        label: textClean($(a).text()) || 'PDF',
        href: absolute,
        url: absolute,
      });
    });
    // If no explicit "spec" label found, pick first pdf as specPdfUrl fallback
    if (!specPdfUrl && assets.length > 0) specPdfUrl = assets[0].url;

    // --- BRAND / CATEGORY (best-effort) ---
    const brand =
      textClean($('.brand, .product-brands a, .product_meta .posted_in a').first().text()) || undefined;
    const category =
      textClean($('.product_meta .posted_in a').first().text()) || undefined;

    const body = {
      id: code || name || new Date().getTime().toString(),
      name,
      code: code || undefined,
      description,
      image,
      gallery,
      features,
      specs,
      assets,
      brand,
      tags,
      compliance,
      sourceUrl: url,
      category,
      specPdfUrl: specPdfUrl || undefined,
    };

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err?.message || err) }),
    };
  }
};
