import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { reviewRequestSchema } from '../schemas/review.js';
import { databaseReady } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createReview } from '../controllers/reviewController.js';

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { message: 'Too many review requests. Try again in a minute.', code: 'RATE_LIMITED' } } });
router.post('/', limiter, (req, _res, next) => {
  const parsed = reviewRequestSchema.safeParse(req.body);
  if (!parsed.success) { const error = parsed.error; return next(error); }
  req.validatedBody = parsed.data;
  if (!databaseReady()) { const error = new Error('MongoDB is not connected; reviews cannot be saved.'); error.code = 'MONGO_NOT_CONNECTED'; return next(error); }
  return next();
}, asyncHandler(createReview));
export default router;
