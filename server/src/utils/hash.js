import { createHash } from 'node:crypto';

export function reviewHash({ code, language, model, verify, minConfidence }) {
  const stableInput = JSON.stringify({ code, language, model, verify, minConfidence, pipelineVersion: 1 });
  return createHash('sha256').update(stableInput, 'utf8').digest('hex');
}
