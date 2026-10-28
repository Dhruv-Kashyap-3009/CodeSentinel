import { Review } from '../models/Review.js';

export async function getStats(_req, res) {
  const [categories, severity, languages, activity, reviews] = await Promise.all([
    Review.aggregate([{ $unwind: '$report.issues' }, { $group: { _id: '$report.issues.category', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
    Review.aggregate([{ $group: { _id: null, high: { $sum: '$report.summary.high' }, medium: { $sum: '$report.summary.medium' }, low: { $sum: '$report.summary.low' } } }]),
    Review.aggregate([{ $group: { _id: '$language', reviews: { $sum: 1 }, issues: { $sum: '$report.summary.total' } } }, { $sort: { _id: 1 } }]),
    Review.aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, reviews: { $sum: 1 }, issues: { $sum: '$report.summary.total' } } }, { $sort: { _id: 1 } }, { $limit: 30 }]),
    Review.countDocuments(),
  ]);
  res.json({ categories: categories.map((item) => ({ category: item._id ?? 'uncategorized', count: item.count })), severity: severity[0] ? { high: severity[0].high, medium: severity[0].medium, low: severity[0].low } : { high: 0, medium: 0, low: 0 }, languages: languages.map((item) => ({ language: item._id, reviews: item.reviews, issues: item.issues })), activity: activity.map((item) => ({ date: item._id, reviews: item.reviews, issues: item.issues })), reviews });
}
