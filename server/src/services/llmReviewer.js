import { config } from '../config/env.js';
import { llmResponseSchema, verificationSchema } from '../schemas/finding.js';

const prompts = new Map();
async function languagePrompt(language) {
  if (!prompts.has(language)) {
    prompts.set(language, import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../prompts/${language}.md`, import.meta.url), 'utf8')).catch(() => 'Identify only concrete correctness and security defects.'));
  }
  return prompts.get(language);
}
async function ollama(messages, schema, purpose) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const body = { model: config.ollamaModel, stream: false, format: 'json', messages, options: { num_ctx: 8192, num_predict: 1200 } };
    try {
      const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.ollamaTimeoutMs),
      });
      if (!response.ok) {
        const text = (await response.text()).slice(0, 500);
        const failure = new Error(response.status === 404 && /model/i.test(text)
          ? `Ollama model "${config.ollamaModel}" is not installed. Run ollama pull ${config.ollamaModel}.`
          : /context length|context window|input too long/i.test(text)
            ? 'The selected Ollama model rejected this review because its context window is too small; reduce the source size or use a model with a larger context window.'
            : `Ollama request failed (${response.status}): ${text}`);
        failure.code = response.status === 404 && /model/i.test(text) ? 'OLLAMA_MODEL_NOT_FOUND' : /context length|context window|input too long/i.test(text) ? 'OLLAMA_CONTEXT_LENGTH' : 'OLLAMA_REQUEST_FAILED';
        throw failure;
      }
      const payload = await response.json();
      const raw = payload.message?.content ?? '';
      let parsed;
      try { parsed = JSON.parse(raw); } catch { throw new Error(`Ollama returned invalid JSON: ${raw.slice(0, 500)}`); }
      const validated = schema.safeParse(parsed);
      if (!validated.success) throw new Error(`Ollama ${purpose} response failed validation: ${validated.error.message}; response: ${raw.slice(0, 500)}`);
      return validated.data;
    } catch (error) {
      lastError = error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error(`Ollama ${purpose} request timed out after ${config.ollamaTimeoutMs} ms.`);
      if (error.code === 'OLLAMA_MODEL_NOT_FOUND' || error.code === 'OLLAMA_CONTEXT_LENGTH' || error.code === 'OLLAMA_REQUEST_FAILED') throw error;
      if (attempt < 2) messages = [...messages, { role: 'user', content: `Your previous response was invalid. Repair it and return ONLY valid JSON matching the required schema. Validation error: ${error.message}` }];
    }
  }
  throw new Error(`Ollama ${purpose} failed after 3 attempts: ${lastError?.message ?? 'unknown error'}`);
}

export async function reviewChunk(chunk, staticFindings = []) {
  if (config.mockLlm) {
    const issues = /\b(?:eval\s*\(|password\s*=\s*["']|SELECT\s+\*\s+FROM\s+\w+\s*\+|\b(?:gets|strcpy)\s*\()/i.test(chunk.source)
      ? [{ line: chunk.startLine, severity: 'medium', category: 'security', explanation: 'Potentially unsafe input handling or dynamic execution needs review.', suggestedFix: 'Validate and constrain untrusted input before use.', confidence: 0.82 }]
      : [];
    return issues.map((item) => ({ ...item, line: Math.min(chunk.endLine, Math.max(chunk.startLine, item.line)), verified: config.verify, verificationStatus: config.verify ? 'confirmed' : 'not_requested', verificationReason: config.verify ? 'Deterministic mock verification confirmed the candidate.' : undefined }));
  }
  const checklist = await languagePrompt(chunk.language);
  const system = `You are a careful senior code reviewer. Identify actual logic bugs, security vulnerabilities, incorrect assumptions and edge cases, null/undefined access, resource management, concurrency, performance, validation, and only defect-causing maintainability issues. Do not invent issues or make style-only complaints. Avoid vague advice, duplicates, and unsupported claims. Return strict JSON: {"issues":[{"line":number,"severity":"low|medium|high","category":string,"explanation":string,"suggestedFix":string,"confidence":number}]}. If no actionable issue exists return {"issues":[]}. Line numbers are original source lines.\nLanguage checklist:\n${checklist}`;
  const context = JSON.stringify({ language: chunk.language, name: chunk.name, lineRange: [chunk.startLine, chunk.endLine], imports: chunk.imports, source: chunk.source, staticFindings });
  const firstPass = await ollama([{ role: 'system', content: system }, { role: 'user', content: `Review this chunk and return strict JSON.\n${context}` }], llmResponseSchema, 'review');
  const candidates = firstPass.issues.map((issue, index) => ({ ...issue, line: Math.min(chunk.endLine, Math.max(chunk.startLine, issue.line)), id: `candidate-${index + 1}` }));
  if (!config.verify || candidates.length === 0) return candidates.map(({ id, ...issue }) => ({ ...issue, verified: false, verificationStatus: 'not_requested' }));
  const verification = await ollama([
    { role: 'system', content: 'Verify every candidate against the source. Return strict JSON {"candidates":[{"id":"candidate-1","verdict":"confirmed|rejected","reason":"..."}]}. Include every supplied candidate exactly once.' },
    { role: 'user', content: JSON.stringify({ language: chunk.language, lineRange: [chunk.startLine, chunk.endLine], source: chunk.source, candidates }) },
  ], verificationSchema, 'verification');
  const verdicts = new Map(verification.candidates.map((candidate) => [candidate.id, candidate]));
  return candidates.flatMap(({ id, ...issue }) => {
    const result = verdicts.get(id);
    if (!result) throw new Error(`Ollama verification omitted ${id}; report was not marked verified.`);
    if (result.verdict === 'rejected') return [];
    return [{ ...issue, verified: true, verificationStatus: 'confirmed', verificationReason: result.reason }];
  });
}
