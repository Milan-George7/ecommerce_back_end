require('./setup');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

const setupUsersAndProduct = async () => {
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    password: 'adminpass123',
    role: 'admin',
  });
  const customer = await User.create({
    name: 'Customer',
    email: 'customer@test.com',
    password: 'customerpass123',
    role: 'customer',
  });

  const category = await Category.create({ name: 'Phones', slug: 'phones', ancestors: [] });
  const product = await Product.create({
    name: 'Test Phone',
    sku: 'TP-001',
    price: 100,
    stock: 5,
    category: category._id,
  });

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'adminpass123' });
  const customerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@test.com', password: 'customerpass123' });

  return {
    adminToken: adminLogin.body.data.token,
    customerToken: customerLogin.body.data.token,
    product,
    customer,
  };
};

describe('Order management', () => {
  it('creates an order, computes total on the server, and decrements stock', async () => {
    const { customerToken, product } = await setupUsersAndProduct();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product: product._id, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(200);
    expect(res.body.data.status).toBe('Pending');

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(3);
  });

  it('rejects an order when requested quantity exceeds stock', async () => {
    const { customerToken, product } = await setupUsersAndProduct();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product: product._id, quantity: 999 }] });

    expect(res.status).toBe(400);

    const unchangedProduct = await Product.findById(product._id);
    expect(unchangedProduct.stock).toBe(5);
  });

  it('prevents a customer from viewing another customer order', async () => {
    const { customerToken, product } = await setupUsersAndProduct();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product: product._id, quantity: 1 }] });

    const otherCustomer = await User.create({
      name: 'Other',
      email: 'other@test.com',
      password: 'otherpass123',
      role: 'customer',
    });
    const otherLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'other@test.com', password: 'otherpass123' });

    const res = await request(app)
      .get(`/api/orders/my/${orderRes.body.data._id}`)
      .set('Authorization', `Bearer ${otherLogin.body.data.token}`);

    expect(res.status).toBe(404);
  });

  it('allows admin to transition order status and restocks on cancellation', async () => {
    const { adminToken, customerToken, product } = await setupUsersAndProduct();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product: product._id, quantity: 2 }] });

    const cancelRes = await request(app)
      .patch(`/api/orders/${orderRes.body.data._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Cancelled' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('Cancelled');

    const restockedProduct = await Product.findById(product._id);
    expect(restockedProduct.stock).toBe(5); // fully restocked
  });

  it('rejects invalid status transitions', async () => {
    const { adminToken, customerToken, product } = await setupUsersAndProduct();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product: product._id, quantity: 1 }] });

    // Pending -> Delivered directly is not allowed
    const res = await request(app)
      .patch(`/api/orders/${orderRes.body.data._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Delivered' });

    expect(res.status).toBe(400);
  });
});
