import { describe, expect, it } from 'vitest';
import { mergeFindings } from '../../src/services/merger.js';

const staticIssue = (line, severity, message, sourceTool = 'ESLint') => ({ line, severity, category: 'security', message, sourceTool });
describe('mergeFindings', () => {
  it('deduplicates overlapping meaning, retains sources, and keeps verification details', () => {
    const result = mergeFindings({ language: 'javascript', staticFindings: [staticIssue(3, 'high', 'Unsafe HTML injection into element')], llmFindings: [{ line: 4, severity: 'high', category: 'security', explanation: 'Unsafe HTML injection into element allows XSS', suggestedFix: 'Use textContent.', confidence: 0.9, verified: true, verificationStatus: 'confirmed', verificationReason: 'Input is attacker controlled.' }] });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].sources).toEqual(['ESLint', 'LLM']);
    expect(result.issues[0]).toMatchObject({ verified: true, verificationReason: 'Input is attacker controlled.' });
  });
  it('filters low-confidence LLM results but preserves static findings', () => {
    const report = mergeFindings({ language: 'python', staticFindings: [staticIssue(2, 'medium', 'A warning')], llmFindings: [{ line: 5, severity: 'low', category: 'bug', explanation: 'low confidence', confidence: 0.2 }] });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].sources).toEqual(['ESLint']);
  });
  it('ranks severity then line and produces consistent counts', () => {
    const report = mergeFindings({ language: 'c', staticFindings: [staticIssue(4, 'low', 'late'), staticIssue(9, 'high', 'urgent'), staticIssue(2, 'high', 'early'), staticIssue(1, 'medium', 'mid')] });
    expect(report.issues.map((issue) => issue.line)).toEqual([2, 9, 1, 4]);
    expect(report.summary).toEqual({ high: 2, medium: 1, low: 1, total: 4 });
  });
  it('does not conflate unrelated nearby defects', () => {
    const report = mergeFindings({ staticFindings: [staticIssue(10, 'high', 'SQL parameter is injectable'), { line: 11, severity: 'high', category: 'resource', message: 'File handle is never closed', sourceTool: 'Pylint' }] });
    expect(report.issues).toHaveLength(2);
  });
  it('handles empty and invalid findings', () => {
    expect(mergeFindings({ language: 'sql', staticFindings: [{ line: 0, severity: 'urgent' }] })).toMatchObject({ summary: { high: 0, medium: 0, low: 0, total: 0 }, issues: [] });
  });
});
