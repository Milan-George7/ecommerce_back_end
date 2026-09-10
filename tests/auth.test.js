require('./setup');
const request = require('supertest');
const app = require('../src/app');

describe('Auth', () => {
  const userPayload = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'password123',
  };

  it('registers a new customer', async () => {
    const res = await request(app).post('/api/auth/register').send(userPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.token).toBeDefined();
  });

  it('rejects duplicate email registration', async () => {
    await request(app).post('/api/auth/register').send(userPayload);
    const res = await request(app).post('/api/auth/register').send(userPayload);
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(userPayload);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userPayload.email, password: userPayload.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    await request(app).post('/api/auth/register').send(userPayload);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userPayload.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('rejects access to protected route without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
