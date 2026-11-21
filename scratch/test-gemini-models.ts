import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY?.trim();

async function run() {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey!,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
    }),
  });
  console.log('Status:', res.status);
  console.log('Response:', await res.text());
}

run();
