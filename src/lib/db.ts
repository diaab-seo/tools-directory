export interface Tool {
  id: number;
  slug: string;
  name: string;
  description: string;
  pricing_slug?: string;
  pricing?: string;
  rating?: number;
  votes?: number;
  url: string;
  image_url: string;
  embedding?: string;
  ai_title?: string;
  ai_meta?: string;
  ai_intro?: string;
  ai_use_cases?: string;
  cat_slugs?: string;
  cat_names?: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  ai_description?: string;
  ai_meta?: string;
}

export interface RelatedTool {
  slug: string;
  name: string;
  ai_meta: string;
  image_url: string;
  pricing_slug: string;
}

// Helper to get tools securely mapped to their categories
export const getToolBySlug = async (env: any, slug: string): Promise<Tool | null> => {
  const tool = await env.DB.prepare(`
    SELECT t.*, GROUP_CONCAT(c.slug) AS cat_slugs,
           GROUP_CONCAT(c.name)      AS cat_names
    FROM tools t
    JOIN tool_categories tc ON tc.tool_id = t.id
    JOIN categories c       ON c.id = tc.category_id
    WHERE t.slug = ?
    GROUP BY t.id
  `).bind(slug).first();
  return tool || null;
};

// Fetch related tools dynamically computed from D1
export const getRelatedTools = async (env: any, toolId: number): Promise<RelatedTool[]> => {
  const related = await env.DB.prepare(`
    SELECT t.slug, t.name, t.ai_meta, t.image_url, t.pricing_slug
    FROM related_tools rt JOIN tools t ON t.id = rt.related_id
    WHERE rt.tool_id = ? ORDER BY rt.similarity DESC LIMIT 6
  `).bind(toolId).all();
  
  return related.results || [];
};

// Advanced query builder for filter/category pages
export const getFilteredTools = async (
  env: any, 
  { catSlugs, pricingFilter, sortFilter, cursor, limit = 24 }: 
  { catSlugs?: string[], pricingFilter?: string | null, sortFilter?: string | null, cursor?: number, limit?: number }
) => {
  let query = 'SELECT DISTINCT t.* FROM tools t';
  const params: any[] = [];
  const conditions: string[] = [];

  if (catSlugs && catSlugs.length > 0) {
    query += ' JOIN tool_categories tc ON tc.tool_id = t.id JOIN categories c ON tc.category_id = c.id';
    const placeholders = catSlugs.map(() => '?').join(',');
    conditions.push(`c.slug IN (${placeholders})`);
    params.push(...catSlugs);
  }

  if (pricingFilter) {
    conditions.push('t.pricing_slug = ?');
    params.push(pricingFilter);
  }

  if (cursor) {
    conditions.push('t.id > ?');
    params.push(cursor);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  if (sortFilter === 'top-rated') {
    query += ' ORDER BY t.rating DESC, t.id ASC';
  } else if (sortFilter === 'newest') {
    query += ' ORDER BY t.id DESC';
  } else {
    query += ' ORDER BY t.id ASC';
  }

  query += ' LIMIT ?';
  params.push(limit);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results as Tool[];
};

export const getCategoryBySlug = async (env: any, slug: string): Promise<Category | null> => {
  return await env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
};
