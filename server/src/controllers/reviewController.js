import { config } from '../config/env.js';
import { Review } from '../models/Review.js';
import { reviewHash } from '../utils/hash.js';
import { runReview } from '../services/reviewPipeline.js';
import { detectLanguage } from '../services/languageDetector.js';

export async function createReview(req, res) {
  const { code, language: requestedLanguage, filename } = req.validatedBody;
  const language = detectLanguage(code, filename, requestedLanguage).language;
  const cacheKey = reviewHash({ code, language, model: config.ollamaModel, verify: config.verify, minConfidence: config.minConfidence });
  const existing = await Review.findOne({ cacheKey }).select('+code').lean();
  if (existing) return res.json({ ...existing.report, reviewId: String(existing._id), cached: true });
  const report = await runReview({ code, language, filename });
  try {
    const saved = await Review.create({ code, cacheKey, language, filename: filename ?? null, report, configuration: { model: config.ollamaModel, verificationEnabled: config.verify } });
    return res.status(201).json({ ...report, reviewId: String(saved._id), cached: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const saved = await Review.findOne({ cacheKey }).select('+code').lean();
    if (!saved) throw error;
    return res.json({ ...saved.report, reviewId: String(saved._id), cached: true });
  }
}
