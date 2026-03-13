import { GoogleGenAI } from '@google/genai';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/f6522056ca652881618a4a28bbf90b3caf8574dbf4f769103e7c3730287ad554.sqlite');
const db = new Database(dbPath);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const CAT_SYSTEM = `Write a 200-word editorial intro for an AI tools category page. 
The text should explain what this category of AI tools does, who uses them, and what to look for when choosing one. Do not start with 'Welcome'.
Return ONLY raw JSON, without markdown formatting or backticks: { "description": "string", "meta": "string (140-155 chars limit)" }`;

async function run() {
  const categories = db.prepare('SELECT id, name FROM categories WHERE ai_description IS NULL').all() as any[];
  console.log(`Found ${categories.length} categories needing content.`);

  for (const cat of categories) {
    const prompt = `Category Name: ${cat.name}`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: CAT_SYSTEM + '\n\n' + prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const text = response.text || '{}';
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      let result;
      try {
         result = JSON.parse(cleanText);
      } catch(e) {
         console.error(`Failed to parse response for Category ${cat.name}. Text was:`, cleanText);
         await sleep(12500);
         continue;
      }

      if (result && result.description && result.meta) {
          db.prepare('UPDATE categories SET ai_description=?, ai_meta=? WHERE id=?')
            .run(result.description, result.meta, cat.id);
          console.log(`Updated content for category: ${cat.name}.`);
      } else {
          console.log(`Missing properties in response for category: ${cat.name}`);
      }
      
      console.log(`Sleeping 12500ms to respect 5 RPM limit...`);
      await sleep(12500);
    } catch(e) {
      console.error(`Error processing category ${cat.name}:`, e);
      await sleep(12500);
    }
  }
  console.log('Category content generation complete.');
}

run().catch(console.error);
