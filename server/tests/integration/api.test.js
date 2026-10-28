import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../../src/app.js';
import { connectDatabase, closeDatabase } from '../../src/config/database.js';
import { Review } from '../../src/models/Review.js';

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
}, 30000);
afterAll(async () => { await closeDatabase(); await mongo?.stop(); });
describe('REST API', () => {
  it('reports health without exposing settings', async () => {
    const result = await request(app).get('/health').expect(200);
    expect(result.body).toMatchObject({ status: 'ok', database: 'connected' });
    expect(JSON.stringify(result.body)).not.toContain('mongodb://');
  });
  it('validates empty review code and unsupported languages', async () => {
    await request(app).post('/api/review').send({ code: '' }).expect(400);
    await request(app).post('/api/review').send({ code: 'class A {}', language: 'rust' }).expect(400);
  });
  it('rejects an oversized JSON body', async () => {
    await request(app).post('/api/review').send({ code: 'x'.repeat(205 * 1024), language: 'javascript' }).expect(413);
  });
  it('paginates saved review history and returns a clear missing identifier response', async () => {
    await Review.create({ code: 'const x=1;', cacheKey: 'unique-cache-key', language: 'javascript', report: { summary: { high: 0, medium: 0, low: 0, total: 0 }, issues: [] } });
    const list = await request(app).get('/api/reviews?page=1&limit=1').expect(200);
    expect(list.body).toMatchObject({ page: 1, limit: 1, total: 1 });
    await request(app).get('/api/reviews/not-an-id').expect(404);
  });
  it('provides zero-valued stats when there are no findings', async () => {
    const response = await request(app).get('/api/stats').expect(200);
    expect(response.body).toHaveProperty('severity');
  });
});
