import { Router } from 'express';
import { paginationSchema } from '../schemas/review.js';
import { listReviews, getReview } from '../controllers/historyController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.get('/', (req, res, next) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) return next(parsed.error);
  req.pagination = parsed.data;
  return asyncHandler(listReviews)(req, res, next);
});
router.get('/:id', asyncHandler(getReview));
export default router;
