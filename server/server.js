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

// Check for ended auctions every 10 seconds
setInterval(checkEndedAuctions, 10000);

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
