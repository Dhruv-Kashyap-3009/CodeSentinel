import { ZodError } from 'zod';

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  if (error instanceof ZodError || error.name === 'ValidationError') {
    return res.status(400).json({ error: { message: error instanceof ZodError ? error.issues.map((issue) => issue.message).join('; ') : error.message, code: 'VALIDATION_ERROR' } });
  }
  if (error.type === 'entity.too.large' || error.code === 'PAYLOAD_TOO_LARGE') return res.status(413).json({ error: { message: error.message || 'Request body exceeds the 200 KB limit.', code: 'PAYLOAD_TOO_LARGE' } });
  if (error.code === 'LLM_UNAVAILABLE' || String(error.code ?? '').startsWith('OLLAMA_')) return res.status(503).json({ error: { message: error.message, code: error.code } });
  if (error.code === 'MONGO_NOT_CONNECTED') return res.status(503).json({ error: { message: 'Review persistence is unavailable. Check the MongoDB connection.', code: 'DATABASE_UNAVAILABLE' } });
  const status = error.statusCode ?? error.status ?? 500;
  const message = status < 500 ? error.message : 'An unexpected server error occurred.';
  if (status >= 500) console.error(`Request failed (${error.code ?? 'INTERNAL_ERROR'}): ${error.message}`);
  res.status(status).json({ error: { message, code: error.code ?? 'INTERNAL_ERROR' } });
}
