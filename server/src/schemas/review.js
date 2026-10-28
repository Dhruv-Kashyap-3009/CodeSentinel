import { z } from 'zod';

export const languages = ['javascript', 'java', 'python', 'c', 'cpp', 'html', 'css', 'sql'];
export const reviewRequestSchema = z.object({
  code: z.string().min(1, 'Code must not be empty').max(200 * 1024, 'Code exceeds the 200 KB limit'),
  language: z.enum(languages).optional(),
  filename: z.string().max(255).optional(),
});
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
