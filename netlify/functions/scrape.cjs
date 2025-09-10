const cheerio = require('cheerio');

/** Resolve relative → absolute */
function abs(u, base) {
  if (!u) return undefined;
  try {
    return new URL(u, base).toString();
  } catch {
    return u;
  }
}

function textClean(s) {
  if (!s) return '';
  return String(s)
    .replace(/<\/?[^>]+>/g, ' ')                 // strip tags
    .replace(/\bhttps?:\/\/\S+/gi, ' ')          // kill bare URLs
    .replace(/\S{120,}/g, ' ')                   // mega “words”
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters && event.queryStringParameters.url;
    if (!url) {
      return { statusCode: 400, body: 'Missing ?url=' };
    }

    const resp = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return { statusCode: resp.status, body: `Failed to fetch page (${resp.status})` };
    }

    const html = await resp.text();
    const $ = cheerio.load(html);
    const base = url;

    // --- Title / Code(SKU)
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1.product_title, h1.entry-title, h1').first().text() ||
      $('title').first().text() ||
      '';

    const sku =
      $('.product_meta .sku').first().text().trim() ||
      $(':contains("SKU")').filter('span,td,th,div').first().text().replace(/SKU[:\s]*/i, '').trim() ||
      undefined;

    // --- Description (prefer Woo short description, then tab panel, then meta description)
    const $short =
      $('.woocommerce-product-details__short-description').first();
    const $tabDesc =
      $('.woocommerce-Tabs-panel--description, #tab-description').first();
    const metaDesc = $('meta[name="description"]').attr('content');

    const rawDesc =
      ($short && $short.length ? $short.text() : '') ||
      ($tabDesc && $tabDesc.length ? $tabDesc.text() : '') ||
      metaDesc ||
      '';

    const description = textClean(rawDesc) || undefined;

    // --- Features (bullets under short description / description)
    const features = []
      .concat($short.find('li').map((i, el) => textClean($(el).text())).get())
      .concat($tabDesc.find('li').map((i, el) => textClean($(el).text())).get())
      .filter(Boolean);

    // --- Specs table (Woo product attributes)
    const specs = $('.woocommerce-product-attributes tr')
      .map((i, tr) => {
        const label = textClean($(tr).find('th').text());
        const value = textClean($(tr).find('td').text());
        if (!label && !value) return null;
        return { label, value };
      })
      .get();

    // --- Compliance (look for heading "Compliance")
    let compliance = [];
    $('h2,h3,h4').each((i, el) => {
      if (/compliance/i.test($(el).text())) {
        compliance = $(el)
          .nextAll('ul').first()
          .find('li').map((j, li) => textClean($(li).text())).get();
      }
    });

    // --- Images (og:image → gallery → any image-looking asset)
    const ogImage = $('meta[property="og:image"]').attr('content');

    const gallery = $('figure.woocommerce-product-gallery__image img')
      .map((i, img) => {
        const $img = $(img);
        return (
          $img.attr('data-large_image') ||
          $img.attr('data-src') ||
          $img.attr('src')
        );
      })
      .get()
      .map((u) => abs(u, base))
      .filter(Boolean);

    // --- PDF/spec assets
    const pdfLinks = $('a[href$=".pdf"], a[href*=".pdf"]')
      .map((i, a) => abs($(a).attr('href'), base))
      .get()
      .filter(Boolean);

    const specPdfUrl =
      pdfLinks.find((u) => /spec|tech|sheet|drawing/i.test(u)) || pdfLinks[0];

    // --- Collect any assets we might want to expose (URLs + labels)
    const assets = []
      .concat(
        pdfLinks.map((u) => ({ url: u, label: 'PDF' }))
      );

    // Pick a primary image
    const assetImgs = $('a[href]').map((i, a) => $(a).attr('href')).get()
      .map((u) => abs(u, base))
      .filter((u) => !!u && /\.(png|jpe?g|webp|gif|bmp)$/i.test(u));

    const image =
      abs(ogImage, base) ||
      (gallery.length ? gallery[0] : undefined) ||
      (assetImgs.length ? assetImgs[0] : undefined);

    const out = {
      id: sku || title || url,
      code: sku,
      title: textClean(title),
      name: textClean(title),
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

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(out),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Scrape error' };
  }
};