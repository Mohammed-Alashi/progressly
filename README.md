# CareerFlow AI

Personal AI career assistant. It keeps normal project conversations, extracts confirmed achievements, writes a weekly LinkedIn post, and is designed to publish through LinkedIn's official API.

## Start locally

1. Copy `.env.example` to `.env.local` and add a free Groq API key.
2. Run `npm install`.
3. Run `npm run dev`.

The first UI works without a database. Set `DATABASE_URL` before enabling persistent chat history, achievements, and scheduled publishing.

## Important safety rule

The weekly job must only publish achievements marked `confirmed`. Never store API keys in source code or commit `.env.local`.
