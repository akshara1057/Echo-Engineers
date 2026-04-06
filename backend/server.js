// ─────────────────────────────────────────────────────────
//  ContentGen – AI Content Studio  ·  Backend Server
//  Node.js + Express + SambaNova API (Llama 3.1)
// ─────────────────────────────────────────────────────────

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// ── Validate API key on startup ──────────────────────────
const SAMBA_KEY = process.env.SAMBANOVA_API_KEY;
if (!SAMBA_KEY || SAMBA_KEY === 'your_api_key_here') {
  console.error('\n❌  SAMBANOVA_API_KEY is missing in .env');
  console.error('   → Get one at: https://cloud.sambanova.ai/\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Prompt Building Logic (Same as before) ────────────────

const TEMPLATE_INSTRUCTIONS = {
  blog: 'Write a well-structured blog post with subheadings.',
  social: 'Write a punchy social media post with hashtags.',
  email: 'Write a professional email with a subject line.',
  product: 'Write a persuasive product description.',
  ad: 'Write compelling ad copy.',
  thread: 'Write a Twitter/X thread (numbered tweets).',
};

const TONE_INSTRUCTIONS = {
  professional: 'Use a professional tone.',
  casual: 'Use a friendly, conversational tone.',
  witty: 'Use a clever, witty tone with humor.',
  persuasive: 'Use a highly persuasive tone.',
  inspirational: 'Use an inspirational tone.',
  formal: 'Use a formal and polished tone.',
};

const LENGTH_MAP = {
  0: 'Short (100-150 words).',
  1: 'Medium (250-400 words).',
  2: 'Long-form (600-900 words).',
};

function buildPrompt({ prompt, template, tone, length }) {
  let instructions = `You are a professional content creator. 
  Task: ${TEMPLATE_INSTRUCTIONS[template || 'blog']}
  Tone: ${TONE_INSTRUCTIONS[tone || 'professional']}
  Length: ${LENGTH_MAP[length || 1]}
  
  User Topic: ${prompt}`;
  return instructions;
}

// ── ROUTES ───────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', provider: 'SambaNova', model: 'Llama-3.1-8B' });
});

/**
 * POST /api/generate/stream – SambaNova Streaming
 */
app.post('/api/generate/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { prompt } = req.body;
    if (!prompt) throw new Error('Prompt is required');

    const finalPrompt = buildPrompt(req.body);

    const response = await axios({
      method: 'post',
      url: 'https://api.sambanova.ai/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${SAMBA_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: "Meta-Llama-3.1-8B-Instruct", // Fast & Reliable for hackathons
        messages: [{ role: "user", content: finalPrompt }],
        stream: true
      },
      responseType: 'stream'
    });

    response.data.on('data', chunk => {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        const message = line.replace(/^data: /, '');
        if (message === '[DONE]') {
          res.write('data: [DONE]\n\n');
          return;
        }
        try {
          const parsed = JSON.parse(message);
          const content = parsed.choices[0].delta.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
        } catch (e) {
          // Ignore parse errors for non-json chunks
        }
      }
    });

    response.data.on('end', () => res.end());

  } catch (err) {
    console.error('SambaNova Error:', err.response?.data || err.message);
    res.write(`data: ${JSON.stringify({ error: 'SambaNova Error: ' + err.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// Non-streaming fallback
app.post('/api/generate', async (req, res) => {
  try {
    const finalPrompt = buildPrompt(req.body);
    const response = await axios.post('https://api.sambanova.ai/v1/chat/completions', {
      model: "Meta-Llama-3.1-8B-Instruct",
      messages: [{ role: "user", content: finalPrompt }],
      stream: false
    }, {
      headers: { 'Authorization': `Bearer ${SAMBA_KEY}` }
    });
    res.json({ success: true, content: response.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SambaNova Backend ready on port ${PORT}`);
});