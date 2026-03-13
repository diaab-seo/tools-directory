import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { slugify } from './slugify.js'; // Note .js extension for tsx
import { execSync } from 'child_process';
import path from 'path';

// Fix __dirname for Windows in ES modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.resolve(__dirname, '../ai-tools.csv');
const rows = parse(fs.readFileSync(csvPath), { columns: true });

function normalizePricing(p: string) {
  if (!p) return 'paid';
  const pLower = p.toLowerCase();
  if (pLower.includes('gratuit') || pLower === 'free') return 'free';
  if (pLower.includes('freemium') || pLower.includes('free trial')) return 'freemium';
  if (pLower.includes('paid') || pLower.includes('contact')) return 'paid';
  return 'paid'; // Default fallback
}

function parseRating(r: string) {
  let rating = 0;
  let votes = 0;
  if (!r) return { rating, votes };

  const ratingMatch = r.match(/([\d\.]+)\/5/);
  if (ratingMatch) rating = parseFloat(ratingMatch[1]);
  
  const votesMatch = r.match(/\((\d+)\s+votes\)/);
  if (votesMatch) votes = parseInt(votesMatch[1], 10);
  else {
    const upvotesMatch = r.match(/(\d+)\s+upvotes/);
    if (upvotesMatch) votes = parseInt(upvotesMatch[1], 10);
  }
  return { rating, votes };
}

const uniqueSlugs = new Set<string>();
const duplicates: any[] = [];
const validRows: any[] = [];
const allCategories = new Set<string>();
const toolCategoryLinks: { toolSlug: string; catSlug: string }[] = [];

for (const r of rows) {
  const slug = slugify(r['tool-name'] || '');
  if (!slug) continue;

  if (uniqueSlugs.has(slug)) {
    duplicates.push({ slug, name: r['tool-name'] });
    continue;
  }
  uniqueSlugs.add(slug);
  r.slug = slug;
  validRows.push(r);

  // Process categories
  const catString = r['tool-categories'] || '';
  const cats = catString.split(';').map((c: string) => c.trim()).filter(Boolean);
  for (const c of cats) {
    const catSlug = slugify(c);
    allCategories.add(c); // Store original name
    toolCategoryLinks.push({ toolSlug: slug, catSlug });
  }
}

// 1. Generate Categories SQL
let sqlContent = '';
const catArray = Array.from(allCategories);
for (let i = 0; i < catArray.length; i += 100) {
  const chunk = catArray.slice(i, i + 100);
  const values = chunk.map(c => {
    return `('${slugify(c)}', '${c.replace(/'/g, "''")}')`;
  }).join(',\n');
  sqlContent += `INSERT OR IGNORE INTO categories (slug, name) VALUES \n${values};\n\n`;
}

// 2. Generate Tools SQL in batches of 100
for (let i = 0; i < validRows.length; i += 100) {
  const chunk = validRows.slice(i, i + 100);
  const values = chunk.map(r => {
    const name = r['tool-name'].replace(/'/g, "''");
    const desc = r['tool-description'].replace(/'/g, "''");
    const url = r['tool-url'].replace(/'/g, "''");
    const img = (r['tool-image'] || '').replace(/'/g, "''");
    const pRaw = r['tool-pricing'].replace(/'/g, "''");
    const pSlug = normalizePricing(r['tool-pricing']);
    const { rating, votes } = parseRating(r['tool-reviews']);
    return `('${r.slug}', '${name}', '${desc}', '${url}', '${img}', '${pRaw}', '${pSlug}', ${rating}, ${votes})`;
  }).join(',\n');
  
  sqlContent += `INSERT OR IGNORE INTO tools (slug, name, description, url, image_url, pricing_raw, pricing_slug, rating, votes) VALUES \n${values};\n\n`;
}

// 3. Generate Junction SQL
let junctionCount = 0;
for (const link of toolCategoryLinks) {
  sqlContent += `INSERT OR IGNORE INTO tool_categories (tool_id, category_id) SELECT t.id, c.id FROM tools t, categories c WHERE t.slug = '${link.toolSlug}' AND c.slug = '${link.catSlug}';\n`;
  junctionCount++;
  if (junctionCount % 100 === 0) {
    sqlContent += '\n'; // Just add a newline for readability
  }
}

const seedPath = path.resolve(__dirname, '../seed.sql');
fs.writeFileSync(seedPath, sqlContent);

console.log('Duplicates found:', duplicates.length);
if (duplicates.length > 0 && duplicates.length <= 20) {
  console.log(duplicates);
} else if (duplicates.length > 20) {
  console.log(duplicates.slice(0, 10), '... and more');
}

console.log(`Generated ${validRows.length} valid tools in seed.sql`);
try {
  console.log('Initializing D1 locally...');
  execSync('npx wrangler d1 execute ai-tools --local --file=schema.sql', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  console.log('Inserting into D1 locally (this may take a moment)...');
  execSync('npx wrangler d1 execute ai-tools --local --file=seed.sql', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  
  const result = execSync('npx wrangler d1 execute ai-tools --local --command="SELECT COUNT(*) as tool_count FROM tools;"', { cwd: path.resolve(__dirname, '..') });
  console.log('D1 Total Tools Count:');
  console.log(result.toString());
} catch (e: any) {
  console.error('Execution Error:', e.message);
  if (e.stdout) console.error(e.stdout.toString());
  if (e.stderr) console.error(e.stderr.toString());
}
