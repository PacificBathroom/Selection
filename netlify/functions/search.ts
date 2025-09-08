import type { Handler } from '@netlify/functions';
import * as cheerio from 'cheerio';

const isProductUrl = (href?: string) =>
  !!href && /^https?:\/\/(www\.)?precero\.com\.au\/product\/[^?#/]+\/?$/i.test(href);

export const handler: Handler = async (event) => {
  const q = event.queryStringParameters?.q?.trim();
  if (!q) return { statusCode: 400, body: JSON.stringify({ error: 'Missing q' }) } as any;

  const url = `https://www.precero.com.au/?s=${encodeURIComponent(q)}&post_type=product`;
  const resp = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!resp.ok) return { statusCode: 500, body: JSON.stringify({ error: 'Fetch failed' }) } as any;

  const html = await resp.text();
  const $ = cheerio.load(html);
  const items: { title: string; url: string; image?: string }[] = [];

  $('ul.products li.product').each((_, el) => {
    const a = $(el).find('a.woocommerce-LoopProduct-link').first();
    const href = a.attr('href');
    const title = a.find('h2, h3, .woocommerce-loop-product__title').text().trim();
    const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
    if (isProductUrl(href) && title) items.push({ title, url: href!, image: img });
  });

  if (items.length === 0) {
    $('a[href*="/product/"]').each((_, a) => {
      const href = $(a).attr('href');
      if (!isProductUrl(href)) return;
      const title = $(a).text().trim() || $(a).attr('title')?.trim();
      if (href && title && !items.find(i => i.url === href)) items.push({ title, url: href });
    });
  }

  const deduped = Array.from(new Map(items.map(i => [i.url, i])).values());
  deduped.sort((a, b) => {
    const qa = q.toLowerCase();
    const da = (a.title || '').toLowerCase().includes(qa) ? -1 : 0;
    const db = (b.title || '').toLowerCase().includes(qa) ? -1 : 0;
    return da - db;
  });

  return { statusCode: 200, body: JSON.stringify({ results: deduped.slice(0, 12) }) } as any;
};
