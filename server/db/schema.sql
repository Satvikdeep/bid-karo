-- Bid Karo Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    hostel_name VARCHAR(100),
    room_number VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin', 'seller', 'buyer')),
    avatar_url TEXT,
    google_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    icon VARCHAR(50),
    description TEXT
);

-- Seed default categories
INSERT INTO categories (name, slug, icon, description) VALUES
    ('Electronics', 'electronics', '🔌', 'Coolers, heaters, mini fridges, and other electronics'),
    ('Furniture', 'furniture', '🪑', 'Chairs, tables, shoe racks, and shelving'),
    ('Kitchen', 'kitchen', '🍳', 'Utensil sets, cookware, and kitchen appliances'),
    ('Bedding', 'bedding', '🛏️', 'Mattresses, pillows, bed sheets, and blankets'),
    ('Stationery', 'stationery', '📚', 'Books, notebooks, pens, and study supplies'),
    ('Other', 'other', '📦', 'Miscellaneous items')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    bought_price DECIMAL(10, 2),
    buying_date DATE,
    functional_condition VARCHAR(20) NOT NULL CHECK (
        functional_condition IN ('excellent', 'good', 'fair', 'poor', 'not_working')
    ),
    physical_condition VARCHAR(20) NOT NULL CHECK (
        physical_condition IN ('like_new', 'minor_wear', 'visible_wear', 'heavy_wear')
    ),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'listed', 'in_auction', 'sold', 'removed')
    ),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ITEM IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS item_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AUCTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS auctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    starting_price DECIMAL(10, 2) NOT NULL,
    reserve_price DECIMAL(10, 2),
    current_price DECIMAL(10, 2) NOT NULL,
    min_bid_increment DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    original_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (
        status IN ('upcoming', 'active', 'ended', 'cancelled')
    ),
    winner_id UUID REFERENCES users(id),
    total_bids INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BIDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_items_seller ON items(seller_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_item_images_item ON item_images(item_id);
CREATE INDEX IF NOT EXISTS idx_auctions_item ON auctions(item_id);
CREATE INDEX IF NOT EXISTS idx_auctions_seller ON auctions(seller_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_bids_amount ON bids(auction_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auctions_updated_at BEFORE UPDATE ON auctions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
