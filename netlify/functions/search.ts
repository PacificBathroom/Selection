// netlify/functions/search.ts
import type { Handler } from '@netlify/functions';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://www.precero.com.au';

const isProductUrl = (href?: string) =>
  !!href && /^https?:\/\/(www\.)?precero\.com\.au\/product\/[^/?#]+\/?$/i.test(href);

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .replace(/[^a-z0-9\- ]+/g, '')
    .trim();

function scoreCandidate(title: string, url: string, q: string) {
  const t = norm(title);
  const u = norm(url.split('/product/')[1] || '');
  const query = norm(q);
  let score = 0;
  if (t.includes(query)) score -= 50;
  if (u.includes(query)) score -= 40;
  for (const w of query.split(' ')) {
    if (!w) continue;
    if (t.includes(w)) score -= 5;
    if (u.includes(w)) score -= 4;
  }
  return score;
}

async function trySiteSearch(q: string) {
  const url = `${ORIGIN}/?s=${encodeURIComponent(q)}&post_type=product`;
  const resp = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!resp.ok) return [];
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items: { title: string; url: string; image?: string }[] = [];
  $('ul.products li.product').each((_, el) => {
    const a = $(el).find('a.woocommerce-LoopProduct-link').first();
    const href = a.attr('href') || '';
    const title =
      a.find('h2, h3, .woocommerce-loop-product__title').text().trim() ||
      $(el).find('.woocommerce-loop-product__title').text().trim() ||
      a.attr('title')?.trim() ||
      '';
    const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || undefined;
    if (isProductUrl(href) && title) items.push({ title, url: href, image: img });
  });
  if (items.length === 0) {
    $('a[href*="/product/"]').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (!isProductUrl(href)) return;
      const title = ($(a).text() || $(a).attr('title') || '').trim();
      if (!title) return;
      if (!items.find(i => i.url === href)) items.push({ title, url: href });
    });
  }
  return items;
}

async function fromSitemap(q: string) {
  const idxResp = await fetch(`${ORIGIN}/sitemap_index.xml`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!idxResp.ok) return [];
  const idx = await idxResp.text();
  const $i = cheerio.load(idx, { xmlMode: true });
  const productSitemaps: string[] = [];
  $i('sitemap > loc').each((_, el) => {
    const loc = $i(el).text().trim();
    if (/\/product-sitemap.*\.xml$/i.test(loc) || /\/product-.*-sitemap.*\.xml$/i.test(loc)) {
      productSitemaps.push(loc);
    }
  });
  if (productSitemaps.length === 0) productSitemaps.push(`${ORIGIN}/product-sitemap.xml`);
  const urls: string[] = [];
  for (const sm of productSitemaps.slice(0, 4)) {
    const r = await fetch(sm, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!r.ok) continue;
    const xml = await r.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    $('url > loc').each((_, loc) => {
      const u = $(loc).text().trim();
      if (isProductUrl(u)) urls.push(u);
    });
  }
  const query = norm(q);
  const prelim = Array.from(new Set(urls)).map(u => ({
    url: u,
    title: decodeURIComponent((u.split('/product/')[1] || '').replace(/\/$/, '').replace(/-/g, ' ')),
    score: 0
  }));
  for (const it of prelim) it.score = scoreCandidate(it.title, it.url, query);
  prelim.sort((a, b) => a.score - b.score);
  const top = prelim.slice(0, 12);
  const detailed = await Promise.all(
    top.map(async it => {
      try {
        const r = await fetch(it.url, { headers: { 'user-agent': 'Mozilla/5.0' } });
        if (!r.ok) return it;
        const html = await r.text();
        const $p = cheerio.load(html);
        const title =
          $p('meta[property="og:title"]').attr('content') ||
          $p('h1.product_title').text().trim() ||
          $p('title').text().trim() ||
          it.title;
        const image =
          $p('meta[property="og:image"]').attr('content') ||
          $p('img.wp-post-image').attr('src') ||
          undefined;
        return { ...it, title, image };
      } catch {
        return it;
      }
    })
  );
  return detailed.map(({ title, url, image }) => ({ title, url, image }));
}

export const handler: Handler = async (event) => {
  try {
    const q = event.queryStringParameters?.q?.trim() || '';
    if (!q) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing q' }) } as any;
    }
    let items = await trySiteSearch(q);
    items = items.filter(i => isProductUrl(i.url));
    if (items.length === 0) {
      items = await fromSitemap(q);
    }
    const map = new Map<string, { title: string; url: string; image?: string }>();
    for (const it of items) map.set(it.url, it);
    const deduped = Array.from(map.values());
    deduped.sort((a, b) => scoreCandidate(a.title, a.url, q) - scoreCandidate(b.title, b.url, q));
    return {
      statusCode: 200,
      body: JSON.stringify({ results: deduped.slice(0, 12) })
    } as any;
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || 'search failed' }) } as any;
  }
};
