const cheerio = require('cheerio');

const isProductUrl = (href) =>
  !!href && /^https?:\/\/(www\.)?precero\.com\.au\/product\/[^/?#]+\/?$/i.test(href);

const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();

function abs(origin, href) {
  try {
    return new URL(href, origin).toString();
  } catch {
    return href || '';
  }
}

exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters && event.queryStringParameters.url;
    if (!isProductUrl(url)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Provide a valid Precero product URL" })
      };
    }

    const resp = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!resp.ok) {
      return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "fetch failed" }) };
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    const name =
      clean($('h1.product_title').text()) ||
      $('meta[property="og:title"]').attr('content') ||
      clean($('title').text());

    const code =
      clean($('.sku').text()) ||
      clean($('span:contains("SKU")').next().text()) ||
      undefined;

    const price = clean($('.price .amount').first().text()) || undefined;

    const description =
      clean($('.woocommerce-product-details__short-description').text()) ||
      clean($('#tab-description').text()) ||
      clean($('meta[name="description"]').attr('content')) ||
      undefined;

    const gallery = [];
    $('figure.woocommerce-product-gallery__image img').each((_, img) => {
      const src = $(img).attr('data-src') || $(img).attr('src');
      if (src) gallery.push(abs(url, src));
    });
    const ogImg = $('meta[property="og:image"]').attr('content') || $('img.wp-post-image').attr('src');
    const image = ogImg ? abs(url, ogImg) : (gallery[0] || undefined);

    // ---------- PDF / assets extraction ----------
    const assets = [];
    const seen = new Set();

    function pushAsset(label, href) {
      if (!href) return;
      const full = abs(url, href);
      if (seen.has(full)) return;
      seen.add(full);
      assets.push({ label: label || full.split('/').pop() || 'Download', href: full });
    }

    // 1) Any anchor with .pdf
    $('a[href$=".pdf"], a[href*=".pdf?"]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const label = clean($(a).text()) || href.split('/').pop();
      pushAsset(label, href);
    });

    // 2) Buttons/links near the "Specifications" tab (Precero often uses a small "PDF" button)
    // Look within common WooCommerce tab containers
    $('#tab-specifications, #tab-additional_information, .woocommerce-tabs').find('a, button').each((_, el) => {
      const $el = $(el);
      const text = clean($el.text());
      const href = $el.attr('href') || $el.attr('data-href') || '';
      if (/\.pdf(\?|$)/i.test(href) || /^pdf$/i.test(text)) {
        pushAsset(text || 'Specifications PDF', href);
      }
    });

    // 3) Safety: any data attributes that might hold a PDF URL
    $('[data-pdf], [data-file], [data-download]').each((_, el) => {
      const cand = ($(el).attr('data-pdf') || $(el).attr('data-file') || $(el).attr('data-download') || '').trim();
      if (/\.pdf(\?|$)/i.test(cand)) pushAsset('PDF', cand);
    });

    // ---------- Features / specs ----------
    const features = [];
    $('.woocommerce-product-details__short-description ul li, #tab-description ul li').each((_, li) => {
      const t = clean($(li).text());
      if (t) features.push(t);
    });

    const specs = [];
    $('table').each((_, table) => {
      const headers = $(table).find('th').length;
      const rows = $(table).find('tr').length;
      if (rows && headers <= 2) {
        $(table).find('tr').each((__, tr) => {
          const label = clean($(tr).find('th, td').first().text());
          const value = clean($(tr).find('td').last().text());
          if (label && value && label.toLowerCase() !== value.toLowerCase()) {
            specs.push({ label, value });
          }
        });
      }
    });

    const payload = {
      id: code || name || url,
      sourceUrl: url,
      name, code, price, description, image, gallery, features, specs, assets
    };

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "scrape failed" }) };
  }
};
