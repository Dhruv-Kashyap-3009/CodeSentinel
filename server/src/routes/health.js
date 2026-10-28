import { Router } from 'express';
import { databaseReady } from '../config/database.js';
import { config } from '../config/env.js';

const router = Router();
router.get('/', (_req, res) => res.json({ status: 'ok', database: databaseReady() ? 'connected' : 'disconnected', llm: config.mockLlm ? 'mock' : 'ollama-configured', timestamp: new Date().toISOString() }));
export default router;
