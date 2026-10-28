import { afterEach, describe, expect, it, vi } from 'vitest';

const originalMock = process.env.MOCK_LLM; const originalVerify = process.env.VERIFY;
afterEach(() => { if (originalMock === undefined) delete process.env.MOCK_LLM; else process.env.MOCK_LLM = originalMock; if (originalVerify === undefined) delete process.env.VERIFY; else process.env.VERIFY = originalVerify; vi.resetModules(); vi.restoreAllMocks(); });
describe('reviewChunk mock mode', () => {
  it('returns schema-shaped deterministic candidate and verified result', async () => {
    process.env.MOCK_LLM = 'true'; process.env.VERIFY = 'true';
    const fetch = vi.spyOn(globalThis, 'fetch');
    const { reviewChunk } = await import('../../src/services/llmReviewer.js');
    const result = await reviewChunk({ language: 'javascript', name: 'inline', startLine: 5, endLine: 6, source: 'eval(input);', imports: [] });
    expect(result[0]).toMatchObject({ line: 5, severity: 'medium', confidence: 0.82, verified: true, verificationStatus: 'confirmed' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('returns no candidates when mock source has no recognized issue', async () => {
    process.env.MOCK_LLM = 'true';
    const { reviewChunk } = await import('../../src/services/llmReviewer.js');
    expect(await reviewChunk({ language: 'css', name: 'rule', startLine: 1, endLine: 1, source: '.card { color: green; }', imports: [] })).toEqual([]);
  });
});
