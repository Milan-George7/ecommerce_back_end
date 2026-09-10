# E-commerce REST API

A backend REST API for a basic e-commerce application, built with **Node.js**, **Express.js**,
**MongoDB/Mongoose**, and **JWT authentication**.

Modules: User Management, Multi-Level Category Management, Product Management, Order Management.

---

## Table of Contents

- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Setup & running the project](#setup--running-the-project)
- [Running with Docker](#running-with-docker)
- [Running tests](#running-tests)
- [Authentication & roles](#authentication--roles)
- [Multi-level categories — design notes](#multi-level-categories--design-notes)
- [Order & stock handling — design notes](#order--stock-handling--design-notes)
- [API reference](#api-reference)
- [Postman collection](#postman-collection)

---

## Tech stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **Auth:** JWT (jsonwebtoken) + bcrypt password hashing
- **Validation:** Joi
- **Security/ops:** helmet, cors, express-mongo-sanitize, express-rate-limit, morgan + winston logging
- **Testing:** Jest, Supertest, mongodb-memory-server

## Project structure

```
ecommerce-api/
├── server.js                  # entry point (env, DB connect, start server)
├── src/
│   ├── app.js                 # express app: middleware + route mounting
│   ├── config/
│   │   └── db.js              # mongoose connection
│   ├── models/                # Mongoose schemas (User, Category, Product, Order)
│   ├── controllers/           # request handlers (thin - delegate to services)
│   ├── services/               # business logic (category tree, order/stock)
│   ├── routes/                 # express routers per resource
│   ├── middlewares/            # auth, role guard, validation, error handler, rate limit
│   ├── validators/             # Joi schemas per resource
│   └── utils/                  # ApiError, ApiResponse, asyncHandler, logger, token, seed
├── tests/                      # Jest + Supertest integration tests
├── postman_collection.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

**Separation of concerns:** routes wire HTTP verbs + middleware, controllers handle
request/response shape only, and services contain the actual business rules (category
tree math, stock/transaction logic) so they can be tested and reused independently of
Express.

## Setup & running the project

### Prerequisites

- Node.js 18+
- A running MongoDB instance (local, Docker, or Atlas). For **transactional** order
  creation, MongoDB needs to be a replica set (Atlas is one by default). The app
  automatically falls back to a non-transactional-but-still-safe stock update path
  if it detects a standalone MongoDB without replica set support (see
  [Order & stock handling](#order--stock-handling--design-notes)).

### Steps

```bash
# 1. Clone and install
git clone <your-repo-url> ecommerce-api
cd ecommerce-api
npm install

# 2. Configure environment
cp .env.example .env
# edit .env with your MongoDB URI and a strong JWT_SECRET

# 3. (Optional) seed an admin user + sample category tree/product
npm run seed

# 4. Run in development (auto-reload)
npm run dev

# ...or run in production mode
npm start
```

The API will be available at `http://localhost:5000`. A health check is available at
`GET /health`.

The seed script creates an admin using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`
(defaults to `admin@example.com` / `Admin@12345`) plus a sample `Electronics` category
tree and one sample product, so you can start testing immediately.

## Running with Docker

```bash
docker compose up --build
```

This starts the API plus a MongoDB container configured as a single-node replica set
(so transactional order creation is fully exercised). The API will be on
`http://localhost:5000`. Set `JWT_SECRET` in your shell or a `.env` file next to
`docker-compose.yml` before starting in a real deployment.

## Running tests

```bash
npm test
```

Tests spin up an in-memory MongoDB instance (`mongodb-memory-server`), so no external
database is required. Coverage includes auth flows, category tree/circular-reference
prevention, product filtering (including subcategory inheritance), and order/stock
handling (including cancellation restock and invalid status transitions).

## Authentication & roles

- `POST /api/auth/register` always creates a **customer** account (role cannot be
  self-assigned via the public API).
- `POST /api/auth/login` returns a JWT (`Authorization: Bearer <token>`).
- Two roles: `admin` and `customer`. Role-based access is enforced with the
  `protect` (verifies JWT, loads user, blocks deactivated accounts) and
  `authorize('admin' | 'customer')` middlewares.
- Admin accounts are created either via the seed script or by editing a user's role
  directly in the database — there is intentionally no public "become an admin"
  endpoint.
- Admins can list all users and activate/deactivate any account
  (`PATCH /api/users/:id/status`); a deactivated user cannot log in or use existing
  tokens (checked on every request).

## Multi-level categories — design notes

Categories support **unlimited nesting depth**, modelled with a hybrid approach:

- `parent`: direct parent reference (or `null` for a root category) — used for
  simple operations (direct children, moving a node).
- `ancestors`: a materialized path array containing every ancestor id from root down
  to the immediate parent. This lets us fetch an entire subtree
  (`Category.find({ ancestors: someId })`) in a single indexed query instead of a
  recursive walk — this is exactly what powers "products in this category and all
  its subcategories" filtering.

**Circular reference prevention:** before re-parenting a category, the service
checks that the new parent is not the category itself, and is not already one of
the category's own descendants (i.e. not in the target's `ancestors` — the new
parent's ancestor list can never legally contain the node being moved without
first creating a cycle). See `src/services/categoryService.js#assertNoCycle`.

**Re-parenting cascades correctly:** when a category is moved, its own `ancestors`
is recomputed and the change is cascaded (via `bulkWrite`) to every descendant so
their materialized paths stay correct.

**Safety on delete:** a category cannot be deleted while it still has child
categories or products assigned to it, avoiding orphaned data.

`GET /api/categories/tree` returns the complete nested hierarchy in one call, built
from a single flat query plus an in-memory tree assembly (`O(n)`).

## Order & stock handling — design notes

- Prices are **never** trusted from the client — the server loads each product,
  uses its `salePrice` (if set) or `price`, and computes line subtotals and the
  order total itself.
- Before creating an order, each product is checked for `status: 'active'` and
  sufficient `stock`.
- Stock is decremented atomically per line item with
  `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })`,
  which prevents overselling under concurrent requests (the update simply fails to
  match if stock is insufficient by the time it runs).
- The whole "decrement stock for every item + create the order" operation runs
  inside a **MongoDB transaction** when the deployment supports it (replica set /
  Atlas / the provided `docker-compose.yml` setup), so a failure partway through
  never leaves stock decremented without an order, or vice versa. If transactions
  aren't available (e.g. a bare standalone `mongod` in local dev), the service
  automatically falls back to a manual compensating-rollback strategy that keeps
  the same guarantees for the common case.
- Order status follows a controlled state machine:
  `Pending → Confirmed → Processing → Shipped → Delivered`, with `Cancelled`
  reachable from `Pending`/`Confirmed`/`Processing`. Invalid transitions (e.g.
  `Pending → Delivered`) are rejected. Cancelling an order restocks its items.
- Customers can only ever see their own orders (`/api/orders/my`,
  `/api/orders/my/:id`); admins can see and manage all orders.

## API reference

Base URL: `/api`

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | public | Register a new customer |
| POST | `/login` | public | Login, returns JWT |
| GET | `/me` | any authenticated user | Get own profile |
| PATCH | `/me` | any authenticated user | Update own profile / password |

### Users (`/api/users`) — admin only

| Method | Path | Description |
|---|---|---|
| GET | `/` | List users (`?role=&isActive=&page=&limit=`) |
| GET | `/:id` | Get a single user |
| PATCH | `/:id/status` | Activate/deactivate a user (`{ "isActive": true|false }`) |

### Categories (`/api/categories`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tree` | public | Full nested category hierarchy |
| GET | `/` | public | Flat list (`?parent=&isActive=`) |
| GET | `/:id` | public | Get a single category |
| POST | `/` | admin | Create a category (`{ name, parent?, description? }`) |
| PATCH | `/:id` | admin | Update / re-parent a category |
| DELETE | `/:id` | admin | Delete a category (blocked if it has children/products) |

### Products (`/api/products`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | public (optional auth) | List with `search`, `category` (includes subtree), `minPrice`, `maxPrice`, `sortBy` (`price`,`-price`,`name`,`-name`,`createdAt`,`-createdAt`), `page`, `limit`. Admins can additionally pass `status` to see inactive products. |
| GET | `/:id` | public | Get a single product |
| POST | `/` | admin | Create a product |
| PATCH | `/:id` | admin | Update a product |
| DELETE | `/:id` | admin | Delete a product |

### Orders (`/api/orders`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | customer | Place an order: `{ items: [{ product, quantity }], shippingAddress? }` |
| GET | `/my` | customer | List own orders |
| GET | `/my/:id` | customer | Get own order by id |
| GET | `/` | admin | List all orders |
| GET | `/:id` | admin | Get any order |
| PATCH | `/:id/status` | admin | Update order status |

All list endpoints return:

```json
{
  "success": true,
  "message": "...",
  "data": [...],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

All errors follow:

```json
{ "success": false, "message": "...", "errors": ["optional detail array"] }
```

## Postman collection

Import [`postman_collection.json`](./postman_collection.json) into Postman. It uses two
collection variables, `baseUrl` (defaults to `http://localhost:5000/api`) and `token`
(auto-populated by the Register/Login requests via a small test script), so most
requests work out of the box after running Register or Login once.
