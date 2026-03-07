-- Enable vector extension for RAG embeddings
create extension if not exists vector;

-- 1. Customers table
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  phone text,
  created_at timestamptz default now()
);

-- 2. Orders table
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  product_name text not null,
  status text check (status in ('pending','processing','shipped','delivered','cancelled')) default 'pending',
  amount numeric(10,2) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Knowledge base table (for RAG)
create table knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- 4. Conversation sessions table
create table sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  started_at timestamptz default now(),
  last_active timestamptz default now(),
  summary text
);

-- 5. Conversation messages table
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role text check (role in ('user','assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

-- Indexes for fast lookups
create index on orders(customer_id);
create index on messages(session_id);
create index on knowledge_base using ivfflat (embedding vector_cosine_ops);

-- Seed some sample customers
insert into customers (name, email, phone) values
  ('Rahul Sharma', 'rahul@example.com', '9876543210'),
  ('Priya Patel', 'priya@example.com', '9123456789'),
  ('Amit Kumar', 'amit@example.com', '9988776655');

-- Seed some sample orders
insert into orders (customer_id, product_name, status, amount)
select id, 'Samsung TV 55"', 'shipped', 45999.00 from customers where email = 'rahul@example.com';

insert into orders (customer_id, product_name, status, amount)
select id, 'iPhone 15', 'delivered', 79999.00 from customers where email = 'priya@example.com';

insert into orders (customer_id, product_name, status, amount)
select id, 'Nike Running Shoes', 'processing', 5999.00 from customers where email = 'amit@example.com';

-- Seed knowledge base
insert into knowledge_base (title, content, category) values
('Return Policy', 'HelpKart allows returns within 30 days of delivery. Items must be unused and in original packaging. Refunds are processed within 5-7 business days.', 'policy'),
('Shipping Policy', 'Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days. Free shipping on orders above Rs 999.', 'policy'),
('Cancellation Policy', 'Orders can be cancelled within 24 hours of placement. After 24 hours, cancellation is only possible if the order has not been shipped.', 'policy'),
('Payment Methods', 'HelpKart accepts UPI, credit cards, debit cards, net banking, and cash on delivery. EMI options available on orders above Rs 3000.', 'payment'),
('Track Order', 'You can track your order by logging into your account and visiting the My Orders section. A tracking link is also sent to your email once the order is shipped.', 'orders'),
('Damaged Item', 'If you receive a damaged item, please take photos and contact support within 48 hours of delivery. We will arrange a replacement or refund immediately.', 'support');