import { z } from 'zod';
import { findingSchema } from '../../schemas/finding.js';

export const severityFrom = (value) => {
  const normalized = String(value ?? '').toLowerCase();
  if (['error', 'critical', 'high', 'fatal', 'security'].some((term) => normalized.includes(term))) return 'high';
  if (['warning', 'medium', 'moderate'].some((term) => normalized.includes(term))) return 'medium';
  return 'low';
};
export const validateFindings = (findings) => z.array(findingSchema).parse(findings);
export const warningFor = (tool, result) => `${tool} ${result.error === 'missing' ? 'is unavailable' : result.message ?? `exited with code ${result.exitCode}`}; check its installation and configuration.`;
export const makeFinding = ({ line, severity, category, message, sourceTool }) => ({
  line: Math.max(1, Number.parseInt(line, 10) || 1),
  severity: severityFrom(severity),
  category: String(category || 'quality').toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
  message: String(message || 'Analyzer reported an issue').slice(0, 1000),
  sourceTool,
});
