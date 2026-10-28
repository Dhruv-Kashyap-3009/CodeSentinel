import mongoose from 'mongoose';
import { Review } from '../models/Review.js';

export async function listReviews(req, res) {
  const { page, limit } = req.pagination;
  const [records, total] = await Promise.all([
    Review.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).select('+code').lean(),
    Review.countDocuments(),
  ]);
  res.json({ items: records.map((record) => ({
    id: String(record._id), createdAt: record.createdAt, language: record.language,
    summary: record.report.summary, codePreview: record.code.slice(0, 180), code: record.code, report: record.report,
  })), page, limit, total, pages: Math.ceil(total / limit) });
}
export async function getReview(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: { message: 'Review not found', code: 'NOT_FOUND' } });
  const record = await Review.findById(req.params.id).select('+code').lean();
  if (!record) return res.status(404).json({ error: { message: 'Review not found', code: 'NOT_FOUND' } });
  res.json({ id: String(record._id), createdAt: record.createdAt, language: record.language, code: record.code, report: record.report });
}
