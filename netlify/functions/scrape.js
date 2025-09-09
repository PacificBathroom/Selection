// netlify/functions/scrape.js
// npm deps: cheerio (runtime). Node 20+ has global fetch.
// Make sure "cheerio" is in package.json dependencies.

const cheerio = require('cheerio');

function abs(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href || '';
  }
}

function clean(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing ?url=' }) };
    }

    // Fetch the product page
    const res = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: `HTTP ${res.status}` }) };
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // ---------- NAME ----------
    const name =
      clean($('meta[property="og:title"]').attr('content')) ||
      clean($('[itemtype*="schema.org/Product"] [itemprop="name"]').first().text()) ||
      clean($('h1').first().text());

    // ---------- CODE / SKU ----------
    const code =
      clean($('meta[itemprop="sku"]').attr('content')) ||
      clean($('.sku, .product_meta .sku, [data-sku]').first().text()) ||
      undefined;

    // ---------- DESCRIPTION ----------
    const description =
      clean($('meta[property="og:description"]').attr('content')) ||
      clean($('[itemtype*="schema.org/Product"] [itemprop="description"]').first().text()) ||
      clean($('.summary p, .product .summary p, .entry-content p').first().text()) ||
      undefined;

    // ---------- IMAGE (hero) ----------
    const image =
      abs(url, $('meta[property="og:image"]').attr('content')) ||
      abs(url, $('[itemtype*="schema.org/Product"] [itemprop="image"]').attr('src')) ||
      abs(url, $('img.wp-post-image').attr('src')) ||
      abs(url, $('.woocommerce-product-gallery__image img').first().attr('src')) ||
      undefined;

    // ---------- GALLERY ----------
    const gallerySet = new Set();
    $(
      [
        'a.woocommerce-product-gallery__image img',
        '.woocommerce-product-gallery__image img',
        '.product-gallery img',
        '.gallery img',
      ].join(',')
    ).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src) gallerySet.add(abs(url, src));
    });
    const gallery = Array.from(gallerySet);

    // ---------- FEATURES (bulleted lists) ----------
    const features = [];
    // Prefer ULs under a "Features" heading/panel
    const featureBlocks = $('*[id*="feature"], *[class*="feature"], .product-features, .features');
    featureBlocks.find('li').each((_, li) => {
      const t = clean($(li).text());
      if (t) features.push(t);
    });
    if (features.length === 0) {
      // Fallback: first list under content/summary
      $('.entry-content ul, .product .summary ul').first().find('li').each((_, li) => {
        const t = clean($(li).text());
        if (t) features.push(t);
      });
    }

    // ---------- SPECS (table/dl) ----------
    const specs = [];
    // Prefer a table that mentions Specifications
    $('table:contains(pecification) tr, table:contains(SPECIFICATION) tr').each((_, tr) => {
      const tds = $(tr).find('td, th');
      if (tds.length >= 2) {
        const label = clean($(tds[0]).text());
        const value = clean($(tds[1]).text());
        if (label && value) specs.push({ label, value });
      }
    });
    if (specs.length === 0) {
      // Fallback: definition list
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

    // ---------- COMPLIANCE / TAGS ----------
    const compliance = [];
    const tags = [];
    $('.product_meta .posted_in a, .product_meta .tagged_as a, a[rel="tag"]').each((_, a) => {
      const t = clean($(a).text());
      if (t) tags.push(t);
    });
    // heuristic for compliance
    $('*:contains("WELS"), *:contains("AS1428"), *[class*="wels"], *[class*="as1428"]').each((_, el) => {
      const t = clean($(el).text());
      if (t && !compliance.includes(t)) compliance.push(t);
    });

    // ---------- ASSETS (PDFs etc.) ----------
    const assets = [];
    let specPdfUrl = null;

    // We prefer links near/inside a "Specifications" tab/panel
    // Look for any container that likely is the tab/panel
    const specContainers = $(
      [
        '*:contains("Specifications")',
        '*[id*="specification"]',
        '*[class*="specification"]',
        '*[id*="specs"]',
        '*[class*="specs"]',
      ].join(',')
    );

    function pushAsset(aEl) {
      const href = $(aEl).attr('href');
      if (!href) return;
      const absolute = abs(url, href);
      const label = clean($(aEl).text()) || 'Asset';
      assets.push({ label, href: absolute, url: absolute });
      return { absolute, label };
    }

    // 1) PDFs inside likely spec containers
    specContainers.find('a[href$=".pdf"], a[href*=".pdf"]').each((_, aEl) => {
      const pushed = pushAsset(aEl);
      if (pushed && !specPdfUrl) specPdfUrl = pushed.absolute;
    });

    // 2) If not found, any PDF on the page
    if (!specPdfUrl) {
      $('a[href$=".pdf"], a[href*=".pdf"]').each((_, aEl) => {
        const pushed = pushAsset(aEl);
        if (pushed && !specPdfUrl) {
          // Prefer ones with "spec" in link text
          const txt = clean($(aEl).text()).toLowerCase();
          if (txt.includes('spec')) specPdfUrl = pushed.absolute;
        }
      });
    }

    // 3) Ultimate fallback: first PDF anywhere
    if (!specPdfUrl) {
      const firstPdf = assets.find((a) => /\.pdf(\?|$)/i.test(a.url || a.href || ''));
      if (firstPdf) specPdfUrl = firstPdf.url || firstPdf.href;
    }

    // If we discovered a spec PDF but didn't push it (e.g., via step 2/3), ensure it’s in assets.
    if (specPdfUrl && !assets.some((a) => (a.url || a.href) === specPdfUrl)) {
      assets.unshift({ label: 'Specification PDF', href: specPdfUrl, url: specPdfUrl });
    }

    // ---------- BRAND / CATEGORY (best-effort) ----------
    const brand =
      clean($('.brand, .product-brands a, .product_meta .posted_in a').first().text()) || undefined;
    const category =
      clean($('.product_meta .posted_in a').first().text()) || undefined;

    // ---------- Response ----------
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

      // PDFs / assets
      assets,
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
