// Cloudflare Worker for onlykcal.
// - GET /api/search?term=...  -> server-side proxy to Open Food Facts
//   (avoids browser CORS problems and lets us send a proper User-Agent).
//   Tries the faster Search-a-licious API first, then the legacy search.
// - everything else           -> static files from ./public

const UA = 'onlykcal - personal calorie tracker';
const FIELDS = 'product_name,brands,nutriments';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function fetchJson(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('not_json');
    }
  } finally {
    clearTimeout(timer);
  }
}

async function searchALicious(term) {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(term)}&langs=it,en&page_size=20&fields=${FIELDS}`;
  const data = await fetchJson(url, 4500);
  const hits = data.hits || data.products || [];
  return hits.map((h) => ({
    product_name: Array.isArray(h.product_name) ? h.product_name[0] : h.product_name,
    brands: Array.isArray(h.brands) ? h.brands.join(', ') : h.brands,
    nutriments: h.nutriments || {},
  }));
}

async function legacySearch(term) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`;
  const data = await fetchJson(url, 4500);
  return (data.products || []).map((p) => ({
    product_name: p.product_name,
    brands: p.brands,
    nutriments: p.nutriments || {},
  }));
}

async function handleSearch(url) {
  const term = (url.searchParams.get('term') || '').trim();
  if (term.length < 2) return json(400, { error: 'missing_term' });

  const failures = [];
  for (const [name, fn] of [['sal', searchALicious], ['legacy', legacySearch]]) {
    try {
      const products = await fn(term);
      if (products.length > 0 || name === 'legacy') {
        return json(200, { products, source: name });
      }
      failures.push(name + ':empty');
    } catch (e) {
      failures.push(name + ':' + (e.name === 'AbortError' ? 'timeout' : e.message));
    }
  }

  if (failures.some((f) => f.endsWith(':empty'))) return json(200, { products: [], source: 'empty' });
  const rateLimited = failures.some((f) => f.endsWith('http_429'));
  return json(rateLimited ? 429 : 502, {
    error: rateLimited ? 'rate_limited' : 'all_sources_failed',
    details: failures,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/search') {
      if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' });
      return handleSearch(url);
    }
    return env.ASSETS.fetch(request);
  },
};
