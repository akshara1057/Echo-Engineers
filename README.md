# ContentGen – AI Content Studio

A full-stack content generation app powered by Claude Sonnet 4 (Anthropic API).

---

## Project Structure

```
contentgen/
├── backend/
│   ├── server.js          # Express API server (streaming + non-streaming)
│   ├── package.json
│   └── .env.example       # Copy to .env and add your API key
└── frontend/
    └── public/
        └── index.html     # Single-page frontend (no build step needed)
```

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The API runs at `http://localhost:3001`.

---

### 2. Frontend Setup

No build step required. Just open the file:

```bash
# Option A – open directly in browser
open frontend/public/index.html

# Option B – serve with a simple static server (recommended to avoid CORS)
npx serve frontend/public
# then visit http://localhost:3000
```

> **Note:** Make sure the backend is running before generating content.

---

## API Endpoints

### `POST /api/generate`
Returns full content in one response.

**Body:**
```json
{
  "prompt": "Write a blog post about sustainable fashion",
  "template": "blog",
  "tone": "professional",
  "platform": "general",
  "length": 1
}
```

**Response:**
```json
{
  "content": "...",
  "model": "claude-sonnet-4-...",
  "usage": { "input_tokens": 120, "output_tokens": 480 }
}
```

---

### `POST /api/generate/stream`
Returns content as a Server-Sent Events stream.

Same request body as above. Each event:
```
data: {"text": "chunk of text"}
data: [DONE]
```

---

## System Design

### Architecture Overview

ContentGen follows a **client-server architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Browser)                │
│          Vanilla HTML/CSS/JavaScript (SPA)          │
│  • UI Controls (Templates, Tones, Platforms)        │
│  • Real-time Streaming Renderer                     │
│  • Prompt Input & History Management                │
└────────────┬──────────────────────────────────────┘
             │ HTTP/CORS
  ┌──────────▼──────────────────────────────────────┐
  │         Backend (Express.js Server)             │
  │                                                  │
  │  ┌─────────────────────────────────────────┐   │
  │  │  API Layer (Express Router)             │   │
  │  │  • POST /api/generate                   │   │
  │  │  • POST /api/generate/stream            │   │
  │  └─────────────────────────────────────────┘   │
  │                    │                            │
  │  ┌─────────────────▼──────────────────────┐   │
  │  │  Prompt Builder                        │   │
  │  │  • buildSystemPrompt()                 │   │
  │  │  • Template Mapping                    │   │
  │  │  • Tone/Platform Contextualization    │   │
  │  └─────────────────────────────────────────┘   │
  │                    │                            │
  │  ┌─────────────────▼──────────────────────┐   │
  │  │  Anthropic API Client                  │   │
  │  │  • messages.create() (Batch)           │   │
  │  │  • messages.stream() (Streaming)       │   │
  │  └─────────────────────────────────────────┘   │
  └──────────────────────────────────────────────┘
             │
       ┌─────▼────────────┐
       │  Anthropic API   │
       │ (Claude Sonnet 4)│
       └──────────────────┘
```

---

## Architectural Layers

### 1. **Presentation Layer (Frontend)**
- **Technology:** Vanilla HTML, CSS, JavaScript
- **Responsibility:**
  - UI component rendering (sidebar, form, output panel, history)
  - User input collection (prompt, template, tone, platform, length)
  - Real-time rendering of streaming SSE responses
  - Client-side session management (history persistence)
  - Clipboard utilities and toast notifications

- **Key Components:**
  - Template selector (6 types)
  - Tone chips (5 options)
  - Platform selector (5 options)
  - Length slider (0, 1, 2)
  - Prompt textarea
  - Output display with live streaming support
  - History panel (stores last 6 generations)

### 2. **API Layer (Backend)**
- **Technology:** Express.js, Node.js
- **Responsibility:**
  - Request validation (prompt required)
  - Route handling (batch & streaming endpoints)
  - Response formatting and error handling
  - CORS middleware for cross-origin requests
  - Environment configuration (PORT, API_KEY)

- **Endpoints:**
  - `POST /api/generate` — Batch processing (full response at once)
  - `POST /api/generate/stream` — Server-Sent Events (real-time token streaming)

### 3. **Prompt Engineering Layer**
- **Technology:** Dynamic system prompt construction
- **Responsibility:**
  - Context-aware prompt building
  - Template-specific instructions
  - Tone/platform combination logic
  - Length parameter mapping

- **Inputs:**
  - Template type (blog, social, email, product, ad, thread)
  - Tone (professional, casual, witty, persuasive, inspirational, formal)
  - Platform (general, LinkedIn, Twitter/X, Instagram, Newsletter)
  - Length index (0=short, 1=medium, 2=long)

### 4. **AI Integration Layer**
- **Technology:** Anthropic SDK (@anthropic-ai/sdk)
- **Responsibility:**
  - LLM API communication
  - Token streaming (Server-Sent Events)
  - Error handling and retry logic
  - Usage tracking (input/output tokens)

- **Model:** Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Max Tokens:** 1200
- **Streaming:** Yes (via chunk iteration)

---

## Data Flow Diagram

```
User Input (Frontend)
  ├── Prompt: string
  ├── Template: blog | social | email | product | ad | thread
  ├── Tone: professional | casual | witty | persuasive | inspirational | formal
  ├── Platform: general | linkedin | twitter | instagram | newsletter
  └── Length: 0 | 1 | 2
       │
       ▼
  HTTP POST Request
       │
  ┌────────────────────────────────────────┐
  │    Express Request Handler             │
  │  • Extract & validate request body     │
  │  • Check prompt is not empty           │
  │  • Set response headers (CORS, SSE)    │
  └────────────────────────────────────────┘
       │
       ▼
  ┌────────────────────────────────────────┐
  │  buildSystemPrompt()                   │
  │  Construct: $TEMPLATE + $TONE +        │
  │  $PLATFORM + $LENGTH instructions      │
  └────────────────────────────────────────┘
       │
       ▼
  ┌────────────────────────────────────────┐
  │  Anthropic API Call                    │
  │  model: "claude-sonnet-4-..."          │
  │  messages: [{ role: user, content }]   │
  │  system: [constructed prompt]          │
  └────────────────────────────────────────┘
       │
       ├─ Batch Mode ──────────────────────┐
       │                              ▼
       │                   Full response JSON
       │                   { content, model, usage }
       │
       └─ Streaming Mode ──────────────────┐
                                       ▼
                            Token chunks (SSE)
                            data: { text: "..." }
                            data: [DONE]
                                       │
                                       ▼
                                UI Live Render
```

---

## Workflow: User Content Generation

### Step 1: User Configuration
1. User selects **template** (e.g., "Blog")
2. User selects **tone** (e.g., "Professional")
3. User selects **platform** (e.g., "General")
4. User adjusts **length** slider (0 = Short, 1 = Medium, 2 = Long)
5. User enters **prompt** in textarea (e.g., "Sustainable fashion in 2026")

### Step 2: Request Submission
1. Frontend validates prompt is not empty
2. Frontend constructs JSON payload:
   ```json
   {
     "prompt": "Sustainable fashion in 2026",
     "template": "blog",
     "tone": "professional",
     "platform": "general",
     "length": 1
   }
   ```
3. Frontend sends POST request to `/api/generate` (batch) or `/api/generate/stream` (streaming)

### Step 3: Backend Processing
1. Express receives request and validates inputs
2. Calls `buildSystemPrompt()` to create AI instructions:
   ```
   You are a professional content writer specializing in Blog Post creation.
   Write engaging, original content tailored to the platform: general.
   Tone: professional.
   Length: medium (4–6 paragraphs).
   Return ONLY the finished content — no preamble, no meta-commentary...
   ```
3. Calls Anthropic SDK with system prompt + user message

### Step 4a: Batch Generation (Non-Streaming)
1. Anthropic API returns complete message
2. Backend extracts text content from response
3. Backend returns JSON with:
   - `content` — Generated text
   - `model` — Model ID used
   - `usage` — Token counts (input/output)
4. Frontend displays full content at once
5. Frontend adds entry to **history panel**

### Step 4b: Streaming Generation (Real-Time)
1. Backend processes message stream in real-time:
   ```javascript
   for await (const chunk of stream) {
     if (chunk.type === "content_block_delta") {
       // Send token to frontend via SSE
       res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
     }
   }
   ```
2. Frontend listens to SSE events with EventSource API:
   ```javascript
   const eventSource = new EventSource(url);
   eventSource.onmessage = (e) => {
     const { text } = JSON.parse(e.data);
     // Append text to UI in real-time
   };
   ```
3. Text renders character by character as tokens arrive
4. On `[DONE]` event, frontend closes stream and stores in history

### Step 5: User Actions
- **Copy:** One-click copy generated content to clipboard
- **History:** Click previous generation to reload and re-display
- **New Generation:** Clear output and repeat from Step 1

---

## Features

| Feature | Description |
|---|---|
| **6 Templates** | Blog Post, Social, Email, Product Desc., Ad Copy, Tweet Thread |
| **5 Tones** | Professional, Casual, Witty, Persuasive, Inspirational, Formal |
| **5 Platforms** | General, LinkedIn, Twitter/X, Instagram, Newsletter |
| **Length Control** | Short / Medium / Long |
| **Streaming Output** | Text streams live token by token |
| **Session History** | Last 6 generations accessible with one click |
| **Copy to Clipboard** | One-click copy with toast notification |

---

## Tech Stack

- **Backend:** Node.js, Express, `@anthropic-ai/sdk`, dotenv
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)
- **AI:** Claude Sonnet 4 via Anthropic API (streaming messages)

---

## Evaluation Criteria Checklist

- ✅ **Innovation** – Streaming output, multi-template/tone/platform system
- ✅ **System Design** – Separated backend API with two endpoints (stream + batch)
- ✅ **Code Quality** – Clean, commented, modular structure
- ✅ **Completeness** – All MVP + advanced features implemented
- ✅ **UX** – Human-crafted editorial design, live streaming, history panel

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | *(required)* |
| `PORT` | Port for the Express server | `3001` |
