import { z } from 'zod';

export const severitySchema = z.enum(['low', 'medium', 'high']);
export const findingSchema = z.object({
  line: z.number().int().positive(),
  severity: severitySchema,
  category: z.string().min(1),
  message: z.string().min(1),
  explanation: z.string().optional(),
  suggestedFix: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  verified: z.boolean().optional(),
  verificationStatus: z.enum(['confirmed', 'rejected', 'unverified', 'not_requested']).optional(),
  verificationReason: z.string().optional(),
  sourceTool: z.string().optional(),
  sources: z.array(z.string()).optional(),
}).passthrough();
export const llmResponseSchema = z.object({
  issues: z.array(z.object({
    line: z.number().int().positive(),
    severity: severitySchema,
    category: z.string().min(1),
    explanation: z.string().min(1),
    suggestedFix: z.string(),
    confidence: z.number().min(0).max(1),
  })),
});
export const verificationSchema = z.object({
  candidates: z.array(z.object({ id: z.string().min(1), verdict: z.enum(['confirmed', 'rejected']), reason: z.string() })),
});
export const reportSchema = z.object({
  language: z.string(),
  summary: z.object({ high: z.number().int(), medium: z.number().int(), low: z.number().int(), total: z.number().int() }),
  issues: z.array(findingSchema),
  warnings: z.array(z.string()),
  metadata: z.object({ verificationEnabled: z.boolean(), model: z.string(), cacheHit: z.boolean() }),
});
