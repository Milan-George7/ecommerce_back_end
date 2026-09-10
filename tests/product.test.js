require('./setup');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const categoryService = require('../src/services/categoryService');
const Product = require('../src/models/Product');

const setupAdmin = async () => {
  await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    password: 'adminpass123',
    role: 'admin',
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'adminpass123' });
  return res.body.data.token;
};

describe('Product filtering', () => {
  it('returns products from child categories when filtering by parent category', async () => {
    const electronics = await categoryService.createCategory({ name: 'Electronics' });
    const mobiles = await categoryService.createCategory({
      name: 'Mobiles',
      parent: electronics._id,
    });
    const android = await categoryService.createCategory({
      name: 'Android Phones',
      parent: mobiles._id,
    });

    await Product.create({
      name: 'Pixel 9',
      sku: 'GOOG-PIXEL-9',
      price: 700,
      stock: 10,
      category: android._id,
    });
    await Product.create({
      name: 'Random Laptop',
      sku: 'RND-LAP-1',
      price: 900,
      stock: 5,
      category: electronics._id,
    });

    const res = await request(app).get(`/api/products?category=${electronics._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    const resDeep = await request(app).get(`/api/products?category=${mobiles._id}`);
    expect(resDeep.status).toBe(200);
    expect(resDeep.body.data).toHaveLength(1);
    expect(resDeep.body.data[0].name).toBe('Pixel 9');
  });

  it('filters by price range and paginates results', async () => {
    const category = await categoryService.createCategory({ name: 'Misc' });
    await Product.create([
      { name: 'A', sku: 'A-1', price: 10, stock: 5, category: category._id },
      { name: 'B', sku: 'B-1', price: 50, stock: 5, category: category._id },
      { name: 'C', sku: 'C-1', price: 100, stock: 5, category: category._id },
    ]);

    const res = await request(app).get('/api/products?minPrice=20&maxPrice=100&limit=1&page=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(2);
  });

  it('hides inactive products from anonymous customers but shows them to admins', async () => {
    const token = await setupAdmin();
    const category = await categoryService.createCategory({ name: 'Hidden' });
    await Product.create({
      name: 'Hidden Product',
      sku: 'HID-1',
      price: 20,
      stock: 5,
      category: category._id,
      status: 'inactive',
    });

    const anonRes = await request(app).get('/api/products');
    expect(anonRes.body.data).toHaveLength(0);

    const adminRes = await request(app)
      .get('/api/products?status=inactive')
      .set('Authorization', `Bearer ${token}`);
    expect(adminRes.body.data).toHaveLength(1);
  });
});
