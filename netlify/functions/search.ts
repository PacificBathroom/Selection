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
  if (!query) return 0;
  let score = 0;
  if (t.includes(query)) score -= 60;
  if (u.includes(query)) score -= 50;
  for (const w of query.split(' ')) {
    if (!w) continue;
    if (t.includes(w)) score -= 6;
    if (u.includes(w)) score -= 5;
  }
  return score;
}

async function getProductSitemaps() {
  try {
    const idxResp = await fetch(`${ORIGIN}/sitemap_index.xml`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (idxResp.ok) {
      const xml = await idxResp.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const list: string[] = [];
      $('sitemap > loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (/\/product(-\d+)?-sitemap.*\.xml$/i.test(loc) || /\/product-sitemap.*\.xml$/i.test(loc)) {
          list.push(loc);
        }
      });
      if (list.length) return list;
    }
  } catch {}
  return [`${ORIGIN}/product-sitemap.xml`];
}

async function loadProductUrls(maxSitemaps = 4) {
  const sitemaps = await getProductSitemaps();
  const urls: string[] = [];
  for (const sm of sitemaps.slice(0, maxSitemaps)) {
    try {
      const r = await fetch(sm, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!r.ok) continue;
      const xml = await r.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      $('url > loc').each((_, loc) => {
        const u = $(loc).text().trim();
        if (isProductUrl(u)) urls.push(u);
      });
    } catch {}
  }
  return Array.from(new Set(urls));
}

async function enrichTopMatches(urls: string[], q: string, cap = 12) {
  const prelim = urls.map(u => ({
    url: u,
    title: decodeURIComponent((u.split('/product/')[1] || '').replace(/\/$/, '').replace(/-/g, ' ')),
    score: 0,
  }));
  for (const it of prelim) it.score = scoreCandidate(it.title, it.url, q);
  prelim.sort((a, b) => a.score - b.score);

  const top = prelim.slice(0, 40);
  const detailed = await Promise.all(
    top.map(async it => {
      try {
        const r = await fetch(it.url, { headers: { 'user-agent': 'Mozilla/5.0' } });
        if (!r.ok) return it;
        const html = await r.text();
        const $p = cheerio.load(html);
        const title =
          $p('h1.product_title').text().trim() ||
          $p('meta[property="og:title"]').attr('content') ||
          $p('title').text().trim() ||
          it.title;
        const image =
          $p('meta[property="og:image"]').attr('content') ||
          $p('img.wp-post-image').attr('src') ||
          undefined;
        const scored = { ...it, title, image };
        scored.score = scoreCandidate(scored.title, scored.url, q);
        return scored;
      } catch {
        return it;
      }
    })
  );

  detailed.sort((a, b) => a.score - b.score);
  return detailed.slice(0, cap).map(({ title, url, image }) => ({ title, url, image }));
}

export const handler: Handler = async (event) => {
  try {
    const q = event.queryStringParameters?.q?.trim() || '';
    if (!q) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing q' }) } as any;
    }
    const urls = await loadProductUrls();
    const results = await enrichTopMatches(urls, q, 12);
    return { statusCode: 200, body: JSON.stringify({ results }) } as any;
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || 'search failed' }) } as any;
  }
};
