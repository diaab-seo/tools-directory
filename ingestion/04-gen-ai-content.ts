import { GoogleGenAI } from '@google/genai';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/f6522056ca652881618a4a28bbf90b3caf8574dbf4f769103e7c3730287ad554.sqlite');
const db = new Database(dbPath);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const BATCH = 20;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function chunks<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

const SYSTEM = `You are an SEO copywriter for an AI tools directory.
For each tool, you must generate a title, meta description, intro, and a list of use cases.
You MUST format the output as a JSON array of objects, one for each tool provided in the prompt.
Do NOT output any markdown (no \`\`\`json or \`\`\`), output ONLY the raw JSON format.
Each object in the array MUST contain exact keys:
  "id": integer - the exact tool id provided in the prompt
  "title": string - unique <title> tag, 50-60 chars, includes tool name + primary use
  "meta": string - meta description, 140-155 chars, action-oriented
  "intro": string - 2-sentence unique intro paragraph, ~120 words, mentions category
  "use_cases": array of strings - 4 short use case strings (max 8 words each)`;

async function run() {
  const tools = db.prepare(`
    SELECT t.id, t.name, t.description, t.pricing_slug, GROUP_CONCAT(c.name) as categories 
    FROM tools t 
    LEFT JOIN tool_categories tc ON t.id = tc.tool_id 
    LEFT JOIN categories c ON tc.category_id = c.id 
    WHERE t.ai_title IS NULL
    GROUP BY t.id
  `).all() as any[];

  console.log(`Found ${tools.length} tools needing AI content.`);

  for (const batch of chunks(tools, BATCH)) {
    const prompt = batch.map(t => `
id: ${t.id}
Tool: ${t.name}
Description: ${t.description}
Category: ${t.categories || ''}
Pricing: ${t.pricing_slug}`).join('\n\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: SYSTEM + '\n\n' + prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const text = response.text || '[]';
      let jsonArray;
      try {
        // Extra safeguard in case of trailing properties or markdown
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        jsonArray = JSON.parse(cleanText);
      } catch (e) {
        console.error('Failed to parse JSON for batch, skipping. Response:', text);
        console.log('Sleeping 12500ms before next attempt...');
        await sleep(12500);
        continue;
      }

      if (!Array.isArray(jsonArray)) {
          if (jsonArray.id) {
              jsonArray = [jsonArray]; // Wrapped in array if model drops it
          } else {
              console.error('Model did not return an array. Skipping batch.');
              console.log('Sleeping 12500ms before next attempt...');
              await sleep(12500);
              continue;
          }
      }

      const updateStmt = db.prepare('UPDATE tools SET ai_title=?, ai_meta=?, ai_intro=?, ai_use_cases=? WHERE id=?');
      const updateMany = db.transaction((items: any[]) => {
        for (const item of items) {
          if (item.id) {
              updateStmt.run(item.title, item.meta, item.intro, JSON.stringify(item.use_cases || []), item.id);
          }
        }
      });
      
      updateMany(jsonArray);
      console.log(`Updated content for ${jsonArray.length} tools. Sleeping 12500ms to respect 5 RPM limit...`);
      await sleep(12500);
    } catch(e) {
      console.error('Error generating AI content:', e);
      await sleep(5000);
    }
  }
  console.log('AI content generation complete.');
}

run().catch(console.error);
