import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Auth } from 'firebase-auth-cloudflare-workers';
import { PRODUCTS, TENANTS } from './seed-data.js';
import { createPaymentIntent } from './payments/paymob.js';

/* The library requires a KeyStorer to cache Google's public JWKs. An in-memory
   store keeps local dev self-contained (no Workers KV namespace to provision);
   a cache miss simply refetches the certs using the endpoint's max-age. */
class MemoryKeyStore {
  private key = 'firebase-public-jwk';
  private cache = new Map<string, { value: string; expiresAt: number }>();

  async get<T = unknown>(): Promise<T | null> {
    const hit = this.cache.get(this.key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) { this.cache.delete(this.key); return null; }
    return JSON.parse(hit.value) as T;
  }

  async put(value: string, expirationTtl: number): Promise<void> {
    this.cache.set(this.key, { value, expiresAt: Date.now() + expirationTtl * 1000 });
  }
}

const firebaseAuth = Auth.getOrInitialize('dotstudio-pos', new MemoryKeyStore() as any);

/* Fail closed: only a cryptographically valid, unexpired Firebase ID token
   issued for this project is accepted. No token or any verification error -> 401. */
const verifyFirebaseToken = async (c: any, next: any) => {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const claims = await firebaseAuth.verifyIdToken(token);
    c.set('firebaseUser', claims);
  } catch (e) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

const authMiddleware = verifyFirebaseToken;

const app = new Hono();

const db = {
  tenants: TENANTS.map((t: any) => ({ ...t })),
  products: PRODUCTS.map((p: any) => ({ ...p })),
  orders: [],
  orderItems: []
};

function uuid() {
  return 'o-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Tenant-ID', 'Authorization'],
  exposeHeaders: ['Content-Length']
}));

app.use('*', async (c: any, next: any) => {
  const tenantId = c.req.header('X-Tenant-ID') || null;
  c.set('tenantId', tenantId);
  await next();
});

/* Every request to orders or checkout must come from a real Firebase user. */
app.use('/api/orders', authMiddleware);
app.use('/api/orders/*', authMiddleware);
app.use('/api/checkout', authMiddleware);
app.use('/api/checkout/*', authMiddleware);

app.get('/', (c: any) => c.json({ ok: true, service: 'DotStudio POS API', version: '0.1.0' }));

app.get('/api/products', (c: any) => {
  const tenantId = c.get('tenantId') || c.req.query('tenant_id');
  let list = db.products;
  if (tenantId) list = list.filter((p: any) => p.tenant_id === tenantId);
  list = list.filter((p: any) => p.is_active !== false);
  return c.json({ products: list });
});

app.get('/api/tenants', (c: any) => c.json({ tenants: db.tenants }));

app.post('/api/orders', async (c: any) => {
  let body: any = {};
  try { body = await c.req.json(); } catch (e) { body = {}; }

  const tenantHeader = c.get('tenantId');
  const customerName = body.customer_name || (body.customer && body.customer.name) || 'Customer';
  const items = Array.isArray(body.items) ? body.items : [];

  if (!items.length) {
    return c.json({ error: 'No items provided' }, 400);
  }

  let tenantId = tenantHeader || body.tenant_id || null;
  if (!tenantId && items.length) {
    const first = db.products.find((p: any) => p.id === (items[0].product_id || items[0].id));
    tenantId = first ? first.tenant_id : null;
  }

  const orderItems: any[] = [];
  for (const it of items) {
    const pid = it.product_id || it.id;
    const qty = Number(it.quantity || it.qty || 0);
    if (!pid || qty <= 0) continue;
    const prod = db.products.find((p: any) => p.id === pid);
    if (!prod) return c.json({ error: 'Product not found: ' + pid }, 404);
    if ((Number(prod.stock) || 0) < qty) {
      return c.json({ error: 'Insufficient stock for ' + prod.name }, 409);
    }
    prod.stock = Number(prod.stock) - qty;
    orderItems.push({ product_id: pid, quantity: qty, price: Number(prod.price) || 0 });
  }

  const total = body.total != null
    ? Number(body.total)
    : orderItems.reduce((s: number, oi: any) => s + oi.price * oi.quantity, 0);

  const order = {
    id: uuid(),
    tenant_id: tenantId,
    customer_name: customerName,
    total,
    status: body.status || 'pending',
    created_at: new Date().toISOString(),
    items: orderItems
  };

  db.orders.push(order);
  orderItems.forEach((oi: any) => {
    db.orderItems.push({ id: uuid(), order_id: order.id, product_id: oi.product_id, quantity: oi.quantity, price: oi.price });
  });

  return c.json({ order }, 201);
});

app.get('/api/orders/:id', (c: any) => {
  const id = c.req.param('id');
  const order = db.orders.find((o: any) => o.id === id);
  if (!order) return c.json({ error: 'Order not found' }, 404);
  return c.json({ order });
});

app.post('/api/checkout/paymob', async (c: any) => {
  let body: any = {};
  try { body = await c.req.json(); } catch (e) { body = {}; }
  const amount = body.amount != null ? Number(body.amount) : 0;
  const currency = body.currency || 'EGP';
  const customerInfo = body.customerInfo || body.customer || body.customer_info || {};
  const result = await createPaymentIntent(c.env, amount, currency, customerInfo);
  return c.json(result);
});

app.notFound((c: any) => c.json({ error: 'Not found' }, 404));

export default app;