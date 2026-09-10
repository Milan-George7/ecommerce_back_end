require('./setup');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

const createAdminAndToken = async () => {
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    password: 'adminpass123',
    role: 'admin',
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'adminpass123' });
  return { admin, token: res.body.data.token };
};

describe('Category management', () => {
  it('creates nested categories and returns the full tree', async () => {
    const { token } = await createAdminAndToken();

    const electronics = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' });
    expect(electronics.status).toBe(201);

    const mobiles = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mobiles', parent: electronics.body.data._id });
    expect(mobiles.status).toBe(201);

    const android = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Android Phones', parent: mobiles.body.data._id });
    expect(android.status).toBe(201);
    expect(android.body.data.ancestors).toHaveLength(2);

    const tree = await request(app).get('/api/categories/tree');
    expect(tree.status).toBe(200);
    expect(tree.body.data).toHaveLength(1);
    expect(tree.body.data[0].children[0].children[0].name).toBe('Android Phones');
  });

  it('prevents a category from becoming its own parent', async () => {
    const { token } = await createAdminAndToken();
    const electronics = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Electronics' });

    const res = await request(app)
      .patch(`/api/categories/${electronics.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parent: electronics.body.data._id });

    expect(res.status).toBe(400);
  });

  it('prevents circular parent-child relationships', async () => {
    const { token } = await createAdminAndToken();
    const parent = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Parent' });

    const child = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Child', parent: parent.body.data._id });

    // Try to make "Parent" a child of "Child" -> would create a cycle
    const res = await request(app)
      .patch(`/api/categories/${parent.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parent: child.body.data._id });

    expect(res.status).toBe(400);
  });

  it('rejects deleting a category that still has children', async () => {
    const { token } = await createAdminAndToken();
    const parent = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Parent' });
    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Child', parent: parent.body.data._id });

    const res = await request(app)
      .delete(`/api/categories/${parent.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
