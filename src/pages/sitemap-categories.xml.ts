import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const { results: categories } = await env.DB.prepare('SELECT slug FROM categories').all();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Base /categories/ URL
  xml += `
  <url>
    <loc>${baseUrl}/categories/</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

  // Individual category URLs
  if (categories) {
      for (const cat of categories) {
        xml += `
  <url>
    <loc>${baseUrl}/tools/${cat.slug}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
      }
  }

  xml += `\n</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
