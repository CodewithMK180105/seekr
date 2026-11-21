import 'dotenv/config';
import { getEmbeddingProvider } from '../packages/shared/dist/index.js';

async function test() {
  const p = getEmbeddingProvider();
  console.log('Embedding provider:', p.name);
  console.log('API key length:', (process.env.GEMINI_API_KEY || '').length);
  console.log('API key start:', (process.env.GEMINI_API_KEY || '').slice(0, 10));
  try {
    const vec = await p.embedText('redis');
    console.log('Embedded successfully, length:', vec.length);
  } catch (err: any) {
    console.error('Embedding failed:', err.message);
  }
}

test();
