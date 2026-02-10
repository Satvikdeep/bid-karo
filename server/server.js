require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const passport = require('passport');

const db = require('./db');
const configurePassport = require('./config/passport');
const { initializeSocket, broadcastBid, broadcastAuctionEnd } = require('./socket');

// Route imports
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const auctionRoutes = require('./routes/auctions');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Initialize Socket.IO
initializeSocket(io);

// Make io accessible in routes
app.set('io', io);

// ==========================================
// Middleware
// ==========================================
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
configurePassport();

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// API Routes
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DEBUG: Check Environment
app.get('/api/debug', (req, res) => {
    res.json({
        status: 'alive',
        env: {
            node_env: process.env.NODE_ENV,
            has_db_url: !!process.env.DATABASE_URL,
            db_url_masked: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@') : 'MISSING',
            port: process.env.PORT
        }
    });
});

// DEBUG: Check Database Connection
app.get('/api/debug-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW() as now');
        res.json({
            status: 'connected',
            time: result.rows[0].now,
            connection_string_used: process.env.DATABASE_URL ? 'Yes (Masked)' : 'No'
        });
    } catch (err) {
        console.error('DB Debug Error:', err);
        res.status(500).json({
            error: 'DB Connection Failed',
            details: err.message,
            code: err.code
        });
    }
});

// SETUP: Initialize Database Schema (Run once)
app.get('/api/setup-db', async (req, res) => {
    try {
        const schema = `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            slug VARCHAR(50) UNIQUE NOT NULL,
            icon VARCHAR(50),
            description TEXT
        );

        INSERT INTO categories (name, slug, icon, description) VALUES
            ('Electronics', 'electronics', '🔌', 'Coolers, heaters, mini fridges, and other electronics'),
            ('Furniture', 'furniture', '🪑', 'Chairs, tables, shoe racks, and shelving'),
            ('Kitchen', 'kitchen', '🍳', 'Utensil sets, cookware, and kitchen appliances'),
            ('Bedding', 'bedding', '🛏️', 'Mattresses, pillows, bed sheets, and blankets'),
            ('Stationery', 'stationery', '📚', 'Books, notebooks, pens, and study supplies'),
            ('Other', 'other', '📦', 'Miscellaneous items')
        ON CONFLICT (slug) DO NOTHING;

        CREATE TABLE IF NOT EXISTS items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            category_id INTEGER REFERENCES categories(id),
            bought_price DECIMAL(10, 2),
            buying_date DATE,
            functional_condition VARCHAR(20) NOT NULL CHECK (functional_condition IN ('excellent', 'good', 'fair', 'poor', 'not_working')),
            physical_condition VARCHAR(20) NOT NULL CHECK (physical_condition IN ('like_new', 'minor_wear', 'visible_wear', 'heavy_wear')),
            status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'listed', 'in_auction', 'sold', 'removed')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS item_images (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

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
            status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended', 'cancelled')),
            winner_id UUID REFERENCES users(id),
            total_bids INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS bids (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
            bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        `;

        await db.query(schema);
        res.json({ message: 'Database Initialized Successfully', tables: ['users', 'categories', 'items', 'item_images', 'auctions', 'bids'] });
    } catch (err) {
        console.error('Setup Error:', err);
        res.status(500).json({ error: 'Setup Failed', details: err.message });
    }
});

// ==========================================
// Auction Auto-Ending Scheduler
// ==========================================
const checkEndedAuctions = async () => {
    try {
        const result = await db.query(
            "SELECT * FROM auctions WHERE status = 'active' AND end_time <= NOW()"
        );

        for (const auction of result.rows) {
            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                // Find highest bid
                const highestBid = await client.query(
                    'SELECT b.*, u.name as bidder_name FROM bids b JOIN users u ON b.bidder_id = u.id WHERE b.auction_id = $1 ORDER BY b.amount DESC LIMIT 1',
                    [auction.id]
                );

                const winnerId = highestBid.rows.length > 0 ? highestBid.rows[0].bidder_id : null;
                const meetReserve = !auction.reserve_price ||
                    (highestBid.rows.length > 0 && parseFloat(highestBid.rows[0].amount) >= parseFloat(auction.reserve_price));

                const finalWinnerId = meetReserve ? winnerId : null;

                await client.query(
                    "UPDATE auctions SET status = 'ended', winner_id = $1 WHERE id = $2",
                    [finalWinnerId, auction.id]
                );

                await client.query(
                    `UPDATE items SET status = $1 WHERE id = $2`,
                    [finalWinnerId ? 'sold' : 'listed', auction.item_id]
                );

                await client.query('COMMIT');

                // Broadcast auction end via Socket.IO
                broadcastAuctionEnd(io, auction.id, {
                    winner_id: finalWinnerId,
                    winner_name: highestBid.rows.length > 0 ? highestBid.rows[0].bidder_name : null,
                    final_price: highestBid.rows.length > 0 ? highestBid.rows[0].amount : auction.starting_price,
                });

                console.log(`Auction ${auction.id} ended. Winner: ${finalWinnerId || 'none'}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`Error ending auction ${auction.id}:`, err);
            } finally {
                client.release();
            }
        }
    } catch (err) {
        console.error('Auction check error:', err);
    }
};

// Check for ended auctions every 10 seconds (ONLY IN DEV)
// In production, Serverless functions die immediately, so this interval prevents the function from finishing, causing a timeout/crash.
if (process.env.NODE_ENV !== 'production') {
    setInterval(checkEndedAuctions, 10000);
} else {
    // In production, we'll check ONCE per request (lazy check) or specifically when hitting a dashboard
    // For now, let's just disable the loop to fix the crash.
    console.log("Skipping background auction check loop in Serverless environment.");
}

// ==========================================
// Error handling
// ==========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    // TEMPORARY: Return full error details to debug Vercel 500 issue
    res.status(500).json({
        error: 'Server error',
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? 'Hidden in prod' : err.stack,
        details: err
    });
});

// ==========================================
// Start Server
// ==========================================
// ==========================================
// Start Server
// ==========================================
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`🚀 Bid Karo server running on port ${PORT}`);
        console.log(`📡 Socket.IO ready for connections`);
    });
}

module.exports = app;
