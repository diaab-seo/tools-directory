import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // In a full production scenario with >50k tools, we would parse params for sitemap-tools-[page].xml
  // But since we have ~4,000 tools, we can fit them all in one sitemap-tools-1.xml easily (limit is 50k URLs).
  const { results: tools } = await env.DB.prepare('SELECT slug FROM tools').all();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  if (tools) {
      for (const tool of tools) {
        xml += `
  <url>
    <loc>${baseUrl}/tools/${tool.slug}/</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
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
