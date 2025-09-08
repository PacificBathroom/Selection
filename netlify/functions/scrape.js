const cheerio = require('cheerio');

const isProductUrl = (href) => !!href && /^https?:\/\/(www\.)?precero\.com\.au\/product\/[^/?#]+\/?$/i.test(href);
const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();

exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters && event.queryStringParameters.url;
    if (!isProductUrl(url)) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: 'Provide a valid Precero product URL' }) };
    }

    const resp = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!resp.ok) return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: 'fetch failed' }) };
    const html = await resp.text();
    const $ = cheerio.load(html);

    const name = clean($('h1.product_title').text()) || $('meta[property="og:title"]').attr('content') || clean($('title').text());
    const code = clean($('.sku').text()) || clean($('span:contains("SKU")').next().text()) || undefined;
    const price = clean($('.price .amount').first().text()) || undefined;
    const description = clean($('.woocommerce-product-details__short-description').text()) || clean($('#tab-description').text()) || clean($('meta[name="description"]').attr('content')) || undefined;

    const gallery = [];
    $('figure.woocommerce-product-gallery__image img').each((_, img) => {
      const src = $(img).attr('data-src') || $(img).attr('src');
      if (src) gallery.push(src);
    });
    const ogImg = $('meta[property="og:image"]').attr('content') || $('img.wp-post-image').attr('src');
    const image = ogImg || gallery[0];

    const features = [];
    $('.woocommerce-product-details__short-description ul li, #tab-description ul li').each((_, li) => {
      const t = clean($(li).text()); if (t) features.push(t);
    });

    const specs = [];
    $('table').each((_, table) => {
      const headers = $(table).find('th').length;
      const rows = $(table).find('tr').length;
      if (rows && headers <= 2) {
        $(table).find('tr').each((__, tr) => {
          const label = clean($(tr).find('th, td').first().text());
          const value = clean($(tr).find('td').last().text());
          if (label && value && label.toLowerCase() !== value.toLowerCase()) specs.push({ label, value });
        });
      }
    });

    const assets = [];
    $('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const label = clean($(a).text()) || href.split('/').pop() || 'Download';
      if (href) assets.push({ label, href });
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: code || name || url,
        sourceUrl: url,
        name, code, price, description, image, gallery, features, specs, assets
      })
    };
  } catch {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: 'scrape failed' }) };
  }
};
