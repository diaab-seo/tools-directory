import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/f6522056ca652881618a4a28bbf90b3caf8574dbf4f769103e7c3730287ad554.sqlite');
const db = new Database(dbPath);

function chunks<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function run() {
  const tools = db.prepare('SELECT id FROM tools WHERE embedding IS NULL').all() as any[];
  console.log(`Found ${tools.length} tools needing mock embeddings.`);
  
  const batches = chunks(tools, 500);
  const updateStmt = db.prepare('UPDATE tools SET embedding = ? WHERE id = ?');
  
  const updateMany = db.transaction((items: any[]) => {
    for (const item of items) {
      updateStmt.run(item.embedding, item.id);
    }
  });

  for (const batch of batches) {
    const updates = [];
    for (const tool of batch) {
      // Generate a random 768-dimensional vector
      const vec = Array.from({ length: 768 }, () => Math.random() * 2 - 1);
      
      // Normalize to match cosine similarity behavior better
      const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
      const normalizedVec = vec.map(val => val / magnitude);
      
      updates.push({ embedding: JSON.stringify(normalizedVec), id: tool.id });
    }
    updateMany(updates);
    console.log(`Stored mock embeddings for ${batch.length} tools.`);
  }
  
  console.log('Mock embedding generation complete.');
}

run();
