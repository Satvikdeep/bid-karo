const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');

// ==========================================
// GET /api/auctions - List auctions
// ==========================================
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { status = 'active', category, page = 1, limit = 12, sort = 'ending_soon' } = req.query;

        let queryText = `
      SELECT a.*, i.title, i.description, i.functional_condition, i.physical_condition,
             c.name as category_name, c.slug as category_slug,
             u.name as seller_name, u.hostel_name,
             (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY display_order LIMIT 1) as thumbnail
      FROM auctions a
      JOIN items i ON a.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON a.seller_id = u.id
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        if (status !== 'all') {
            const statuses = status.split(',');
            queryText += ` AND a.status IN (${statuses.map(() => `$${paramIndex++}`).join(',')})`;
            params.push(...statuses);
        }

        if (category) {
            queryText += ` AND c.slug = $${paramIndex++}`;
            params.push(category);
        }

        // Sorting
        switch (sort) {
            case 'ending_soon':
                queryText += ' ORDER BY a.end_time ASC';
                break;
            case 'newest':
                queryText += ' ORDER BY a.created_at DESC';
                break;
            case 'most_bids':
                queryText += ' ORDER BY a.total_bids DESC';
                break;
            case 'price_low':
                queryText += ' ORDER BY a.current_price ASC';
                break;
            case 'price_high':
                queryText += ' ORDER BY a.current_price DESC';
                break;
            default:
                queryText += ' ORDER BY a.end_time ASC';
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        queryText += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), offset);

        const result = await db.query(queryText, params);

        // Count
        let countQuery = `
      SELECT COUNT(*) FROM auctions a
      JOIN items i ON a.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE 1=1
    `;
        const countParams = [];
        let ci = 1;
        if (status !== 'all') {
            const sts = status.split(',');
            countQuery += ` AND a.status IN (${sts.map(() => `$${ci++}`).join(',')})`;
            countParams.push(...sts);
        }
        if (category) {
            countQuery += ` AND c.slug = $${ci++}`;
            countParams.push(category);
        }

        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            auctions: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error('List auctions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// GET /api/auctions/:id - Get auction detail
// ==========================================
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const auctionResult = await db.query(
            `SELECT a.*, i.title, i.description, i.bought_price, i.buying_date,
              i.functional_condition, i.physical_condition,
              c.name as category_name, c.slug as category_slug,
              u.name as seller_name, u.hostel_name, u.room_number, u.avatar_url as seller_avatar,
              u.phone as seller_phone, u.email as seller_email,
              w.name as winner_name
       FROM auctions a
       JOIN items i ON a.item_id = i.id
       LEFT JOIN categories c ON i.category_id = c.id
       LEFT JOIN users u ON a.seller_id = u.id
       LEFT JOIN users w ON a.winner_id = w.id
       WHERE a.id = $1`,
            [id]
        );

        if (auctionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Auction not found' });
        }

        const auction = auctionResult.rows[0];

        // Get images
        const imagesResult = await db.query(
            'SELECT * FROM item_images WHERE item_id = $1 ORDER BY display_order',
            [auction.item_id]
        );
        auction.images = imagesResult.rows;

        // Get bid history
        const bidsResult = await db.query(
            `SELECT b.id, b.amount, b.created_at, u.name as bidder_name
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.auction_id = $1
       ORDER BY b.amount DESC`,
            [id]
        );
        auction.bids = bidsResult.rows;

        // Show seller contact info only to winner
        if (auction.status === 'ended' && req.user && auction.winner_id === req.user.id) {
            auction.seller_contact = {
                phone: auction.seller_phone,
                email: auction.seller_email,
                hostel_name: auction.hostel_name,
                room_number: auction.room_number,
            };
        }
        delete auction.seller_phone;
        delete auction.seller_email;

        res.json({ auction });
    } catch (err) {
        console.error('Get auction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// POST /api/auctions - Create auction
// ==========================================
router.post(
    '/',
    authenticate,
    requireRole('seller', 'admin'),
    [
        body('item_id').isUUID(),
        body('starting_price').isDecimal({ decimal_digits: '0,2' }).custom(v => parseFloat(v) > 0),
        body('reserve_price').optional().isDecimal({ decimal_digits: '0,2' }),
        body('min_bid_increment').optional().isDecimal({ decimal_digits: '0,2' }),
        body('end_time').isISO8601(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { item_id, starting_price, reserve_price, min_bid_increment = 10, end_time } = req.body;

            // Verify item ownership
            const item = await db.query('SELECT * FROM items WHERE id = $1', [item_id]);
            if (item.rows.length === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }
            if (item.rows[0].seller_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized' });
            }
            if (item.rows[0].status === 'in_auction') {
                return res.status(400).json({ error: 'Item already has an active auction' });
            }

            // Validate end time is in the future
            const endTime = new Date(end_time);
            if (endTime <= new Date()) {
                return res.status(400).json({ error: 'End time must be in the future' });
            }

            const startTime = new Date();

            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                const auctionResult = await client.query(
                    `INSERT INTO auctions (item_id, seller_id, starting_price, reserve_price, current_price, min_bid_increment, start_time, end_time, original_end_time, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
           RETURNING *`,
                    [item_id, req.user.id, starting_price, reserve_price || null, starting_price, min_bid_increment, startTime, endTime, endTime]
                );

                // Update item status
                await client.query("UPDATE items SET status = 'in_auction' WHERE id = $1", [item_id]);

                await client.query('COMMIT');
                res.status(201).json({ auction: auctionResult.rows[0] });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } catch (err) {
            console.error('Create auction error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// ==========================================
// POST /api/auctions/:id/bid - Place a bid
// ==========================================
router.post(
    '/:id/bid',
    authenticate,
    requireRole('buyer', 'seller', 'admin'),
    [body('amount').isDecimal({ decimal_digits: '0,2' })],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const { amount } = req.body;
            const bidAmount = parseFloat(amount);

            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                // Lock auction row to prevent race conditions
                const auctionResult = await client.query(
                    'SELECT * FROM auctions WHERE id = $1 FOR UPDATE',
                    [id]
                );

                if (auctionResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Auction not found' });
                }

                const auction = auctionResult.rows[0];

                // Validations
                if (auction.status !== 'active') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Auction is not active' });
                }

                if (new Date() > new Date(auction.end_time)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Auction has ended' });
                }

                if (auction.seller_id === req.user.id) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Sellers cannot bid on their own items' });
                }

                const minBid = parseFloat(auction.current_price) + parseFloat(auction.min_bid_increment);
                if (bidAmount < minBid) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        error: `Bid must be at least ₹${minBid.toFixed(2)}`,
                        min_bid: minBid,
                    });
                }

                // Place the bid
                const bidResult = await client.query(
                    'INSERT INTO bids (auction_id, bidder_id, amount) VALUES ($1, $2, $3) RETURNING *',
                    [id, req.user.id, bidAmount]
                );

                // Soft close: extend by 2 minutes if bid placed in last 2 minutes
                let newEndTime = auction.end_time;
                const timeRemaining = new Date(auction.end_time) - new Date();
                if (timeRemaining < 2 * 60 * 1000) {
                    newEndTime = new Date(Date.now() + 2 * 60 * 1000);
                }

                // Update auction
                await client.query(
                    `UPDATE auctions SET
            current_price = $1,
            total_bids = total_bids + 1,
            end_time = $2
          WHERE id = $3`,
                    [bidAmount, newEndTime, id]
                );

                await client.query('COMMIT');

                const bid = bidResult.rows[0];
                bid.bidder_name = req.user.name;

                res.status(201).json({
                    bid,
                    auction: {
                        current_price: bidAmount,
                        end_time: newEndTime,
                        total_bids: auction.total_bids + 1,
                    },
                });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } catch (err) {
            console.error('Place bid error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// ==========================================
// POST /api/auctions/:id/end - End auction
// ==========================================
router.post('/:id/end', authenticate, requireRole('admin', 'seller'), async (req, res) => {
    try {
        const { id } = req.params;

        const auction = await db.query('SELECT * FROM auctions WHERE id = $1', [id]);
        if (auction.rows.length === 0) {
            return res.status(404).json({ error: 'Auction not found' });
        }
        if (auction.rows[0].seller_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Find highest bidder
            const highestBid = await client.query(
                'SELECT * FROM bids WHERE auction_id = $1 ORDER BY amount DESC LIMIT 1',
                [id]
            );

            const winnerId = highestBid.rows.length > 0 ? highestBid.rows[0].bidder_id : null;
            const meetReserve = !auction.rows[0].reserve_price ||
                (highestBid.rows.length > 0 && parseFloat(highestBid.rows[0].amount) >= parseFloat(auction.rows[0].reserve_price));

            await client.query(
                `UPDATE auctions SET status = 'ended', winner_id = $1 WHERE id = $2`,
                [meetReserve ? winnerId : null, id]
            );

            // Update item status
            await client.query(
                `UPDATE items SET status = $1 WHERE id = $2`,
                [meetReserve && winnerId ? 'sold' : 'listed', auction.rows[0].item_id]
            );

            await client.query('COMMIT');

            res.json({
                message: meetReserve ? 'Auction ended successfully' : 'Auction ended - reserve price not met',
                winner_id: meetReserve ? winnerId : null,
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('End auction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// GET /api/auctions/:id/bids - Get bid history
// ==========================================
router.get('/:id/bids', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT b.id, b.amount, b.created_at, u.name as bidder_name
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.auction_id = $1
       ORDER BY b.amount DESC`,
            [id]
        );
        res.json({ bids: result.rows });
    } catch (err) {
        console.error('Get bids error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// GET /api/auctions/user/mybids - Get user's bids
// ==========================================
router.get('/user/mybids', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT b.*, a.status as auction_status, a.current_price, a.end_time, a.winner_id,
              i.title, i.description,
              (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY display_order LIMIT 1) as thumbnail
       FROM bids b
       JOIN auctions a ON b.auction_id = a.id
       JOIN items i ON a.item_id = i.id
       WHERE b.bidder_id = $1
       ORDER BY b.created_at DESC`,
            [req.user.id]
        );
        res.json({ bids: result.rows });
    } catch (err) {
        console.error('Get my bids error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// GET /api/auctions/user/myauctions - Seller's auctions
// ==========================================
router.get('/user/myauctions', authenticate, requireRole('seller', 'admin'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT a.*, i.title, i.description,
              (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY display_order LIMIT 1) as thumbnail,
              w.name as winner_name
       FROM auctions a
       JOIN items i ON a.item_id = i.id
       LEFT JOIN users w ON a.winner_id = w.id
       WHERE a.seller_id = $1
       ORDER BY a.created_at DESC`,
            [req.user.id]
        );
        res.json({ auctions: result.rows });
    } catch (err) {
        console.error('Get my auctions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
