
- AI model catalog lives only in src/lib/ai-models.ts (shared by UI and server); provider routing and free-first fallbacks live in src/lib/ai-gateway.server.ts — avoids divergent model lists.
- Paid AI models (tier "pago-opt-in") are enforced server-side: callable only when the provider key AND its *_ACEITO_COBRANCA=sim secret exist, never in auto chains — guarantees zero cost by default.
- Provider API keys are server secrets only (never localStorage); the UI only reads booleans via ai-status.functions.ts.
