# AI Book Concierge Feature
**Goal:** Automatically enrich book data when a user adds a new title.
**Stack:** React, Vite, Vercel API Routes, Vercel AI SDK.

**Workflow:**
1. User types a book title and clicks "Add".
2. The frontend calls a new Vercel API route: `/api/enrich-book`.
3. The API uses the Vercel AI SDK to call an LLM (like OpenAI).
4. The AI returns a JSON object with: { coverUrl, author, pageCount, aiRecommendation }.
5. The API saves this enriched data to Vercel KV.
6. The React UI updates optimistically.