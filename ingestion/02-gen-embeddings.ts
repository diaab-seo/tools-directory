import { GoogleGenAI } from '@google/genai';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/f6522056ca652881618a4a28bbf90b3caf8574dbf4f769103e7c3730287ad554.sqlite');
const db = new Database(dbPath);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const BATCH = 100;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function chunks<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function run() {
  const tools = db.prepare('SELECT id, name, description FROM tools WHERE embedding IS NULL').all() as any[];
  console.log(`Found ${tools.length} tools to embed.`);
  
  const batches = chunks(tools, BATCH);
  
  while (batches.length > 0) {
    const batch = batches.shift()!;
    console.log(`Processing batch of ${batch.length} tools... (${batches.length} batches remaining)`);
    const contents = batch.map(t => `${t.name}: ${t.description}`);
    
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: contents,
        config: {
          taskType: 'CLUSTERING',
          outputDimensionality: 768,
        }
      });

      const updateStmt = db.prepare('UPDATE tools SET embedding = ? WHERE id = ?');
      const updateMany = db.transaction((items: any[]) => {
        for (const item of items) {
          updateStmt.run(item.embedding, item.id);
        }
      });
      
      const updates = [];
      const embeddings = Array.isArray(response.embeddings) ? response.embeddings : [response.embeddings];
      
      for (let i = 0; i < batch.length; i++) {
        // Handle potentially missing values in batch response
        const emb = embeddings[i];
        if (emb && emb.values) {
             const vec = emb.values;
             updates.push({ embedding: JSON.stringify(vec), id: batch[i]!.id });
        }
      }
      if (updates.length > 0) {
        updateMany(updates);
      }
      
      console.log(`Stored ${updates.length} embeddings. Sleeping 4500ms...`);
      await sleep(4500);
    } catch (e: any) {
      console.error('Error generating embeddings:');
      let retryDelayMs = 15000; // default 15s backoff
      if (e.status === 429 && e.message) {
         const match = String(e.message).match(/retry in ([\d\.]+)s/i);
         if (match && match[1]) {
             retryDelayMs = (parseFloat(match[1]) * 1000) + 2000; // add 2s buffer
             console.log(`Rate limit reached. Extracted retry delay: ${retryDelayMs}ms`);
         }
      }
      console.log(`Waiting ${Math.round(retryDelayMs/1000)}s before retrying...`);
      await sleep(retryDelayMs);
      
      // Push the failed batch back to the front so it gets retried
      batches.unshift(batch);
    }
  }
  console.log('Embedding generation complete.');
}

run().catch(console.error);
