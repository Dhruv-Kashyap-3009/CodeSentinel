import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  code: { type: String, required: true, select: false },
  cacheKey: { type: String, required: true, unique: true, index: true },
  language: { type: String, required: true, index: true },
  filename: { type: String, default: null },
  report: { type: mongoose.Schema.Types.Mixed, required: true },
  configuration: { model: String, verificationEnabled: Boolean },
}, { timestamps: true, minimize: false });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ language: 1, createdAt: -1 });
export const Review = mongoose.models.Review ?? mongoose.model('Review', reviewSchema);
