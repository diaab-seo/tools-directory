import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/f6522056ca652881618a4a28bbf90b3caf8574dbf4f769103e7c3730287ad554.sqlite');
const db = new Database(dbPath);

console.log('Loading tools and embeddings...');
const tools = db.prepare('SELECT id, embedding FROM tools WHERE embedding IS NOT NULL').all() as { id: number, embedding: string }[];
const vecs = tools.map(t => ({ id: t.id, vec: JSON.parse(t.embedding) as number[] }));
console.log(`Loaded ${vecs.length} vectors.`);

function cosine(a: number[], b: number[]) {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; ma += a[i]**2; mb += b[i]**2;
  }
  if (ma === 0 || mb === 0) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

const insertStmt = db.prepare('INSERT OR REPLACE INTO related_tools (tool_id, related_id, similarity) VALUES (?, ?, ?)');
const insertMany = db.transaction((relations: {tool_id: number, related_id: number, sim: number}[]) => {
  for (const r of relations) {
    insertStmt.run(r.tool_id, r.related_id, r.sim);
  }
});

let count = 0;
for (const tool of vecs) {
  const scored = vecs
    .filter(v => v.id !== tool.id)
    .map(v => ({ id: v.id, sim: cosine(tool.vec, v.vec) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 6);

  const relations = scored.map(r => ({ tool_id: tool.id, related_id: r.id, sim: r.sim }));
  insertMany(relations);
  
  count++;
  if (count % 100 === 0) {
    console.log(`Computed related tools for ${count} items.`);
  }
}
console.log('Finished computing related tools.');
