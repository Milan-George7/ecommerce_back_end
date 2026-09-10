/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const categoryService = require('../services/categoryService');
const Category = require('../models/Category');
const Product = require('../models/Product');

const run = async () => {
  await connectDB();

  // 1. Bootstrap admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Super Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    });
    console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
  }

  // 2. Sample multi-level categories (idempotent-ish for a demo script)
  const existingRoot = await Category.findOne({ slug: 'electronics', parent: null });
  if (!existingRoot) {
    const electronics = await categoryService.createCategory({ name: 'Electronics' });
    const mobiles = await categoryService.createCategory({
      name: 'Mobiles',
      parent: electronics._id,
    });
    const androidPhones = await categoryService.createCategory({
      name: 'Android Phones',
      parent: mobiles._id,
    });
    await categoryService.createCategory({ name: 'Samsung', parent: androidPhones._id });
    await categoryService.createCategory({ name: 'OnePlus', parent: androidPhones._id });
    await categoryService.createCategory({ name: 'iPhones', parent: mobiles._id });

    const computers = await categoryService.createCategory({
      name: 'Computers',
      parent: electronics._id,
    });
    await categoryService.createCategory({ name: 'Laptops', parent: computers._id });
    await categoryService.createCategory({ name: 'Desktops', parent: computers._id });

    console.log('Sample category tree created under "Electronics".');

    const samsung = await Category.findOne({ slug: 'samsung' });
    if (samsung) {
      const exists = await Product.findOne({ sku: 'SAM-GALAXY-S24' });
      if (!exists) {
        await Product.create({
          name: 'Samsung Galaxy S24',
          sku: 'SAM-GALAXY-S24',
          description: 'Flagship Android smartphone.',
          price: 899,
          salePrice: 799,
          stock: 25,
          category: samsung._id,
          status: 'active',
        });
        console.log('Sample product created: Samsung Galaxy S24');
      }
    }
  } else {
    console.log('Sample categories already exist, skipping.');
  }

  await mongoose.disconnect();
  console.log('Seeding complete.');
};

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
