import { describe, expect, it } from 'vitest';
import { reviewHash } from '../../src/utils/hash.js';

describe('reviewHash', () => {
  const payload = { code: 'const x = 1;', language: 'javascript', model: 'local-model', verify: true, minConfidence: 0.65 };
  it('is stable for identical review inputs', () => expect(reviewHash(payload)).toBe(reviewHash({ ...payload })));
  it('includes every behavior-affecting review option', () => {
    expect(reviewHash(payload)).not.toBe(reviewHash({ ...payload, language: 'python' }));
    expect(reviewHash(payload)).not.toBe(reviewHash({ ...payload, verify: false }));
    expect(reviewHash(payload)).not.toBe(reviewHash({ ...payload, model: 'other' }));
  });
});
