-- =====================================================================
-- VisagShop · Sprint 6 · Script de estructura (PostgreSQL 14+)
--
-- Crea la base de datos completa: tablas, tipos de datos, restricciones
-- (PRIMARY KEY, NOT NULL, UNIQUE, DEFAULT, CHECK) y relaciones (FOREIGN KEY).
--
-- Uso con psql:
--   psql -U postgres -f database/structure.sql
--   psql -U postgres -d visagshop -f database/data.sql      (opcional)
--
-- En Neon la base "neondb" ya existe: en ese caso omite las dos primeras
-- sentencias y ejecuta el resto conectado a esa base.
-- Debe coincidir con los modelos de Sequelize de database/models.
-- =====================================================================

DROP DATABASE IF EXISTS visagshop;
CREATE DATABASE visagshop ENCODING 'UTF8';
\connect visagshop

-- ---------------------------------------------------------------------
-- Tablas secundarias de productos
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(70)  NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE sizes (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(25)  NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE colors (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(25)  NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fotografías subidas desde el panel de administración.
-- Las fotos originales del catálogo viven en public/img y no usan esta tabla.
CREATE TABLE uploads (
  id         UUID         PRIMARY KEY,
  mime       VARCHAR(20)  NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  data       BYTEA        NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Productos
-- La referencia pública (p001, p002...) se conserva como clave primaria
-- porque aparece en las URLs y en los carritos guardados por los clientes.
-- ---------------------------------------------------------------------
CREATE SEQUENCE product_number_seq START WITH 1;

CREATE TABLE products (
  id          VARCHAR(10)   PRIMARY KEY CHECK (id ~ '^p[0-9]{3,}$'),
  name        VARCHAR(120)  NOT NULL CHECK (char_length(name) >= 3),
  description VARCHAR(1000) NOT NULL DEFAULT '',
  price       INTEGER       NULL CHECK (price >= 0),
  image       VARCHAR(200)  NOT NULL,
  category_id INTEGER       NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  upload_id   UUID          NULL     REFERENCES uploads(id)    ON UPDATE CASCADE ON DELETE SET NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX products_category_idx ON products(category_id);

-- Relación muchos a muchos: productos <-> tallas (con orden de presentación)
CREATE TABLE product_sizes (
  product_id VARCHAR(10) NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  size_id    INTEGER     NOT NULL REFERENCES sizes(id)    ON UPDATE CASCADE ON DELETE RESTRICT,
  position   SMALLINT    NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, size_id)
);

-- Relación muchos a muchos: productos <-> colores
CREATE TABLE product_colors (
  product_id VARCHAR(10) NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  color_id   INTEGER     NOT NULL REFERENCES colors(id)   ON UPDATE CASCADE ON DELETE RESTRICT,
  position   SMALLINT    NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, color_id)
);

-- ---------------------------------------------------------------------
-- Usuarios y sesiones
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            UUID         PRIMARY KEY,
  first_name    VARCHAR(75)  NOT NULL CHECK (char_length(first_name) >= 2),
  last_name     VARCHAR(75)  NOT NULL CHECK (char_length(last_name) >= 2),
  email         VARCHAR(180) NOT NULL UNIQUE,
  phone         VARCHAR(25)  NOT NULL DEFAULT '',
  password_hash VARCHAR(200) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer' CHECK (role IN ('customer')),
  avatar        VARCHAR(200) NULL,                     -- foto de perfil (Sprint 7)
  upload_id     UUID         NULL REFERENCES uploads(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- El navegador solo guarda un token aleatorio; aquí se almacena su SHA-256.
CREATE TABLE sessions (
  token_hash CHAR(64)    PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  remember   BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sessions_user_idx    ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

-- ---------------------------------------------------------------------
-- Pedidos (carrito de compras guardado)
-- Copian los datos de entrega y de cada prenda al momento de la compra.
-- ---------------------------------------------------------------------
CREATE SEQUENCE order_number_seq START WITH 1001;

CREATE TABLE orders (
  id              UUID         PRIMARY KEY,
  number          INTEGER      NOT NULL UNIQUE,          -- se muestra como VS-1001
  user_id         UUID         NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'nuevo'
                  CHECK (status IN ('nuevo', 'confirmado', 'enviado', 'entregado', 'cancelado')),
  first_name      VARCHAR(65)  NOT NULL,
  last_name       VARCHAR(65)  NOT NULL,
  phone           VARCHAR(22)  NOT NULL,
  email           VARCHAR(120) NOT NULL DEFAULT '',
  document        VARCHAR(20)  NOT NULL DEFAULT '',
  department      VARCHAR(70)  NOT NULL,
  city            VARCHAR(70)  NOT NULL,
  address         VARCHAR(140) NOT NULL,
  address_extra   VARCHAR(140) NOT NULL DEFAULT '',
  postal_code     VARCHAR(12)  NOT NULL DEFAULT '',
  billing_address VARCHAR(300) NOT NULL DEFAULT '',
  payment_method  VARCHAR(20)  NOT NULL CHECK (payment_method IN ('contraentrega', 'nequi', 'tarjeta')),
  subtotal        INTEGER      NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  has_unpriced    BOOLEAN      NOT NULL DEFAULT FALSE,
  admin_note      VARCHAR(500) NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX orders_user_idx   ON orders(user_id);
CREATE INDEX orders_status_idx ON orders(status);

CREATE TABLE order_items (
  id           SERIAL       PRIMARY KEY,
  order_id     UUID         NOT NULL REFERENCES orders(id)   ON UPDATE CASCADE ON DELETE CASCADE,
  product_id   VARCHAR(10)  NULL     REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL,
  product_name VARCHAR(120) NOT NULL,
  image        VARCHAR(200) NOT NULL DEFAULT '',
  size         VARCHAR(50)  NOT NULL DEFAULT '',
  quantity     SMALLINT     NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price   INTEGER      NULL CHECK (unit_price >= 0),
  position     SMALLINT     NOT NULL DEFAULT 0
);
CREATE INDEX order_items_order_idx ON order_items(order_id);

-- ---------------------------------------------------------------------
-- Tabla técnica: registra los ajustes de datos que la aplicación ejecuta
-- una sola vez al arrancar (no tiene relaciones con el resto).
-- ---------------------------------------------------------------------
CREATE TABLE app_meta (
  key        VARCHAR(80) PRIMARY KEY,
  value      JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
