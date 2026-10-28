import pLimit from 'p-limit';
import { config } from '../config/env.js';
import { reviewRequestSchema } from '../schemas/review.js';
import { detectLanguage } from './languageDetector.js';
import { chunkSource } from './chunker.js';
import { analyze } from './analyzers/index.js';
import { reviewChunk } from './llmReviewer.js';
import { mergeFindings } from './merger.js';

export async function runReview(input) {
  const request = reviewRequestSchema.parse(input);
  if (Buffer.byteLength(request.code, 'utf8') > config.maxSourceBytes) {
    const error = new Error(`Source exceeds the configured ${config.maxSourceBytes}-byte limit.`); error.code = 'PAYLOAD_TOO_LARGE'; throw error;
  }
  const detection = detectLanguage(request.code, request.filename, request.language);
  const chunks = await chunkSource(request.code, detection.language);
  const staticResult = await analyze(request.code, detection.language);
  const limit = pLimit(config.llmConcurrency);
  const warnings = [...staticResult.warnings];
  let llmFindings = [];
  try {
    const reviewed = await Promise.all(chunks.map((chunk) => limit(async () => {
      const associated = staticResult.findings.filter((finding) => finding.line >= chunk.startLine && finding.line <= chunk.endLine);
      return reviewChunk(chunk, associated);
    })));
    llmFindings = reviewed.flat();
  } catch (error) {
    if (!error.code) error.code = 'LLM_UNAVAILABLE';
    throw error;
  }
  if (detection.method === 'content-heuristic' || detection.method === 'default-heuristic') warnings.push(`Language was inferred heuristically (${detection.language}, confidence ${detection.confidence}); choose a language explicitly when uncertain.`);
  return mergeFindings({ language: detection.language, staticFindings: staticResult.findings, llmFindings, warnings });
}
