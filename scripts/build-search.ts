import * as pagefind from 'pagefind';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/f6522056ca652881618a4a28bbf90b3caf8574dbf4f769103e7c3730287ad554.sqlite');

async function buildSearchIndex() {
  console.log('Starting custom PageFind index generation from D1...');
  
  // 1. Initialize Pagefind CLI API equivalent
  const { index } = await pagefind.createIndex({});
  
  // 2. Connect to local D1
  const db = new Database(dbPath);
  
  const tools = db.prepare(`
    SELECT t.slug, t.name, t.description, t.ai_intro, t.pricing_slug,
           GROUP_CONCAT(c.slug) AS cat_slug
    FROM tools t
    LEFT JOIN tool_categories tc ON tc.tool_id = t.id
    LEFT JOIN categories c ON c.id = tc.category_id
    GROUP BY t.id
  `).all() as any[];
  
  console.log(`Extracting ${tools.length} tools into search index...`);

  // 3. Inject each tool directly into the PageFind build
  if (!index) {
     console.error("Failed to initialize Pagefind index");
     return;
  }

  for (const tool of tools) {
     const url = `/tools/${tool.slug}/`;
     
     // What PageFind actually searches
     const content = `${tool.name} ${tool.description} ${tool.ai_intro || ''}`;
     
     const primaryCategory = tool.cat_slug ? tool.cat_slug.split(',')[0] : 'uncategorized';

     await index.addCustomRecord({
       url: url,
       content: content,
       language: "en",
       meta: {
         title: tool.name,
         pricing: tool.pricing_slug || 'free'
       },
       filters: {
         category: [primaryCategory],
         pricing: [tool.pricing_slug || 'free']
       }
     });
  }

  // 4. Output the index
  const outputPath = path.resolve(__dirname, '../public/pagefind');
  console.log(`Writing index to ${outputPath}...`);
  await index.writeFiles({ outputPath });
  
  console.log('PageFind indexing complete!');
  await pagefind.close();
}

buildSearchIndex().catch(console.error);
