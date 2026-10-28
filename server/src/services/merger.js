import { config } from '../config/env.js';
import { findingSchema, reportSchema } from '../schemas/finding.js';

const severityRank = { high: 0, medium: 1, low: 2 };
const normalizeText = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const similar = (a, b) => {
  const left = new Set(normalizeText(`${a.category} ${a.message ?? a.explanation}`).split(' ').filter((word) => word.length > 3));
  const right = normalizeText(`${b.category} ${b.message ?? b.explanation}`).split(' ').filter((word) => word.length > 3);
  return right.some((word) => left.has(word));
};

export function mergeFindings({ language, staticFindings = [], llmFindings = [], warnings = [], verificationEnabled = config.verify, model = config.ollamaModel, cacheHit = false, minConfidence = config.minConfidence } = {}) {
  const candidates = [];
  const seenStatic = new Set();
  for (const finding of staticFindings) {
    const parsed = findingSchema.safeParse(finding);
    if (parsed.success) {
      const key = `${parsed.data.line}|${parsed.data.severity}|${parsed.data.category}|${normalizeText(parsed.data.message)}`;
      if (!seenStatic.has(key)) candidates.push({ ...parsed.data, message: parsed.data.message, sources: [parsed.data.sourceTool ?? 'static analyzer'] });
      seenStatic.add(key);
    }
  }
  for (const finding of llmFindings) {
    const parsed = findingSchema.safeParse({ ...finding, message: finding.message ?? finding.explanation });
    if (parsed.success && parsed.data.confidence >= minConfidence && parsed.data.verificationStatus !== 'rejected') candidates.push({ ...parsed.data, message: parsed.data.message ?? parsed.data.explanation, sources: ['LLM'] });
  }
  candidates.sort((a, b) => a.line - b.line || severityRank[a.severity] - severityRank[b.severity] || normalizeText(a.message).localeCompare(normalizeText(b.message)));
  const issues = [];
  for (const candidate of candidates) {
    const duplicate = issues.find((existing) => Math.abs(existing.line - candidate.line) <= 1 && normalizeText(existing.category) === normalizeText(candidate.category) && similar(existing, candidate) && (existing.sources.includes('LLM') || candidate.sources.includes('LLM')));
    if (!duplicate) { issues.push({ ...candidate, sources: [...new Set(candidate.sources)] }); continue; }
    duplicate.sources = [...new Set([...duplicate.sources, ...candidate.sources])].sort();
    if (!duplicate.explanation && candidate.explanation) duplicate.explanation = candidate.explanation;
    if (!duplicate.suggestedFix && candidate.suggestedFix) duplicate.suggestedFix = candidate.suggestedFix;
    if (candidate.severity === 'high' || severityRank[candidate.severity] < severityRank[duplicate.severity]) duplicate.severity = candidate.severity;
    if (candidate.confidence !== undefined) duplicate.confidence = Math.max(duplicate.confidence ?? 0, candidate.confidence);
    if (candidate.verified) {
      duplicate.verified = true; duplicate.verificationStatus = candidate.verificationStatus; duplicate.verificationReason = candidate.verificationReason;
    }
  }
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.line - b.line || normalizeText(a.category).localeCompare(normalizeText(b.category)));
  const summary = { high: 0, medium: 0, low: 0, total: issues.length };
  for (const issue of issues) summary[issue.severity] += 1;
  return reportSchema.parse({ language: language ?? 'javascript', summary, issues, warnings: [...new Set(warnings)].sort(), metadata: { verificationEnabled, model, cacheHit } });
}
