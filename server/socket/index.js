const jwt = require('jsonwebtoken');
const db = require('../db');

const initializeSocket = (io) => {
    // Authentication middleware for Socket.IO
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const result = await db.query(
                'SELECT id, name, role FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                return next(new Error('User not found'));
            }

            socket.user = result.rows[0];
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.name} (${socket.user.id})`);

        // ==========================================
        // Join auction room
        // ==========================================
        socket.on('join_auction', (auctionId) => {
            socket.join(`auction:${auctionId}`);
            console.log(`${socket.user.name} joined auction room: ${auctionId}`);
        });

        // ==========================================
        // Leave auction room
        // ==========================================
        socket.on('leave_auction', (auctionId) => {
            socket.leave(`auction:${auctionId}`);
            console.log(`${socket.user.name} left auction room: ${auctionId}`);
        });

        // ==========================================
        // Handle disconnect
        // ==========================================
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.name}`);
        });
    });

    return io;
};

// Utility to broadcast bid updates
const broadcastBid = (io, auctionId, bidData) => {
    io.to(`auction:${auctionId}`).emit('new_bid', {
        auction_id: auctionId,
        bid: bidData.bid,
        current_price: bidData.current_price,
        total_bids: bidData.total_bids,
        end_time: bidData.end_time,
    });
};

// Utility to broadcast auction ending
const broadcastAuctionEnd = (io, auctionId, data) => {
    io.to(`auction:${auctionId}`).emit('auction_ended', {
        auction_id: auctionId,
        winner_id: data.winner_id,
        winner_name: data.winner_name,
        final_price: data.final_price,
    });
};

// Utility to broadcast auction ending soon
const broadcastAuctionEndingSoon = (io, auctionId, timeRemaining) => {
    io.to(`auction:${auctionId}`).emit('auction_ending_soon', {
        auction_id: auctionId,
        time_remaining: timeRemaining,
    });
};

module.exports = { initializeSocket, broadcastBid, broadcastAuctionEnd, broadcastAuctionEndingSoon };
