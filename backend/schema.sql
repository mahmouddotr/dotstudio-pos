-- DotStudio® POS — PostgreSQL schema (Phase 2 real backend)
-- Multi-tenant store-management SaaS.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants (stores)
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  subdomain     VARCHAR(60)  NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_subdomain ON tenants (subdomain);

-- Users (belong to a tenant; super-admins may have NULL tenant_id)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants (id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  role          VARCHAR(40)  NOT NULL,
  firebase_uid  VARCHAR(128) UNIQUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant_id   ON users (tenant_id);
CREATE INDEX idx_users_firebase_uid ON users (firebase_uid);

-- Products (tenant-isolated catalogue)
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category    VARCHAR(80),
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_tenant_id ON products (tenant_id);
CREATE INDEX idx_products_category   ON products (category);

-- Orders (one per checkout, may span multiple vendors but stored per primary tenant)
CREATE TABLE orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  customer_name  VARCHAR(120) NOT NULL,
  total          NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  status         VARCHAR(40) NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_tenant_id  ON orders (tenant_id);
CREATE INDEX idx_orders_status     ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

-- Order items
CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  price      NUMERIC(12,2) NOT NULL CHECK (price >= 0)
);

CREATE INDEX idx_order_items_order_id   ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
