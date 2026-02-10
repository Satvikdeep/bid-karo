const express = require('express');
const router = express.Router();
const { body, validationResult, query: queryValidator } = require('express-validator');
const db = require('../db');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ==========================================
// GET /api/items - List items with filters
// ==========================================
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { category, condition, status = 'listed,in_auction', search, page = 1, limit = 12, sort = 'newest' } = req.query;

        let queryText = `
      SELECT i.*, c.name as category_name, c.slug as category_slug,
             u.name as seller_name, u.hostel_name,
             (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY display_order LIMIT 1) as thumbnail,
             a.id as auction_id, a.current_price, a.starting_price, a.end_time, a.status as auction_status, a.total_bids
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.seller_id = u.id
      LEFT JOIN auctions a ON a.item_id = i.id AND a.status IN ('upcoming', 'active')
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        // Filter by status
        const statuses = status.split(',');
        queryText += ` AND i.status IN (${statuses.map(() => `$${paramIndex++}`).join(',')})`;
        params.push(...statuses);

        // Filter by category
        if (category) {
            queryText += ` AND c.slug = $${paramIndex++}`;
            params.push(category);
        }

        // Filter by functional condition
        if (condition) {
            queryText += ` AND i.functional_condition = $${paramIndex++}`;
            params.push(condition);
        }

        // Search by title or description
        if (search) {
            queryText += ` AND (i.title ILIKE $${paramIndex} OR i.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Sorting
        switch (sort) {
            case 'price_low':
                queryText += ' ORDER BY COALESCE(a.current_price, i.bought_price) ASC NULLS LAST';
                break;
            case 'price_high':
                queryText += ' ORDER BY COALESCE(a.current_price, i.bought_price) DESC NULLS LAST';
                break;
            case 'ending_soon':
                queryText += ' ORDER BY a.end_time ASC NULLS LAST';
                break;
            default:
                queryText += ' ORDER BY i.created_at DESC';
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        queryText += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), offset);

        const result = await db.query(queryText, params);

        // Get total count for pagination
        let countQuery = `
      SELECT COUNT(*) FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE 1=1
    `;
        const countParams = [];
        let countParamIndex = 1;

        const countStatuses = status.split(',');
        countQuery += ` AND i.status IN (${countStatuses.map(() => `$${countParamIndex++}`).join(',')})`;
        countParams.push(...countStatuses);

        if (category) {
            countQuery += ` AND c.slug = $${countParamIndex++}`;
            countParams.push(category);
        }
        if (condition) {
            countQuery += ` AND i.functional_condition = $${countParamIndex++}`;
            countParams.push(condition);
        }
        if (search) {
            countQuery += ` AND (i.title ILIKE $${countParamIndex} OR i.description ILIKE $${countParamIndex})`;
            countParams.push(`%${search}%`);
        }

        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            items: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error('List items error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// GET /api/items/:id - Get item detail
// ==========================================
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const itemResult = await db.query(
            `SELECT i.*, c.name as category_name, c.slug as category_slug,
              u.name as seller_name, u.hostel_name, u.room_number, u.phone, u.email as seller_email, u.avatar_url as seller_avatar
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       LEFT JOIN users u ON i.seller_id = u.id
       WHERE i.id = $1`,
            [id]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Get images
        const imagesResult = await db.query(
            'SELECT * FROM item_images WHERE item_id = $1 ORDER BY display_order',
            [id]
        );

        // Get active auction
        const auctionResult = await db.query(
            `SELECT a.*, u.name as winner_name
       FROM auctions a
       LEFT JOIN users u ON a.winner_id = u.id
       WHERE a.item_id = $1
       ORDER BY a.created_at DESC LIMIT 1`,
            [id]
        );

        const item = itemResult.rows[0];
        item.images = imagesResult.rows;
        item.auction = auctionResult.rows[0] || null;

        // Only show seller contact info to auction winner
        if (item.auction && item.auction.status === 'ended' && req.user && item.auction.winner_id === req.user.id) {
            item.seller_contact = {
                phone: item.phone,
                email: item.seller_email,
                hostel_name: item.hostel_name,
                room_number: item.room_number,
            };
        }

        // Remove sensitive contact info for non-winners
        delete item.phone;
        delete item.seller_email;

        res.json({ item });
    } catch (err) {
        console.error('Get item error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// POST /api/items - Create item
// ==========================================
router.post(
    '/',
    authenticate,
    requireRole('seller', 'admin'),
    upload.array('images', 6),
    [
        body('title').trim().notEmpty().isLength({ max: 200 }),
        body('description').trim().notEmpty(),
        body('category_id').isInt(),
        body('bought_price').optional().isDecimal(),
        body('buying_date').optional().isISO8601(),
        body('functional_condition').isIn(['excellent', 'good', 'fair', 'poor', 'not_working']),
        body('physical_condition').isIn(['like_new', 'minor_wear', 'visible_wear', 'heavy_wear']),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            if (!req.files || req.files.length < 1) {
                return res.status(400).json({ error: 'At least 1 image is required' });
            }

            const {
                title, description, category_id, bought_price, buying_date,
                functional_condition, physical_condition,
            } = req.body;

            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                // Create item
                const itemResult = await client.query(
                    `INSERT INTO items (seller_id, title, description, category_id, bought_price, buying_date, functional_condition, physical_condition, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'listed')
           RETURNING *`,
                    [req.user.id, title, description, category_id, bought_price || null, buying_date || null, functional_condition, physical_condition]
                );

                const item = itemResult.rows[0];

                // Save images
                for (let i = 0; i < req.files.length; i++) {
                    await client.query(
                        'INSERT INTO item_images (item_id, image_url, display_order) VALUES ($1, $2, $3)',
                        [item.id, `/uploads/${req.files[i].filename}`, i]
                    );
                }

                await client.query('COMMIT');

                // Fetch complete item with images
                const images = await db.query(
                    'SELECT * FROM item_images WHERE item_id = $1 ORDER BY display_order',
                    [item.id]
                );

                item.images = images.rows;
                res.status(201).json({ item });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } catch (err) {
            console.error('Create item error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// ==========================================
// PUT /api/items/:id - Update item
// ==========================================
router.put(
    '/:id',
    authenticate,
    requireRole('seller', 'admin'),
    async (req, res) => {
        try {
            const { id } = req.params;

            // Check ownership
            const existing = await db.query('SELECT * FROM items WHERE id = $1', [id]);
            if (existing.rows.length === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }
            if (existing.rows[0].seller_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized' });
            }
            if (existing.rows[0].status === 'in_auction') {
                return res.status(400).json({ error: 'Cannot edit item while in auction' });
            }

            const { title, description, category_id, bought_price, buying_date, functional_condition, physical_condition } = req.body;

            const result = await db.query(
                `UPDATE items SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          category_id = COALESCE($3, category_id),
          bought_price = COALESCE($4, bought_price),
          buying_date = COALESCE($5, buying_date),
          functional_condition = COALESCE($6, functional_condition),
          physical_condition = COALESCE($7, physical_condition)
        WHERE id = $8
        RETURNING *`,
                [title, description, category_id, bought_price, buying_date, functional_condition, physical_condition, id]
            );

            res.json({ item: result.rows[0] });
        } catch (err) {
            console.error('Update item error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// ==========================================
// DELETE /api/items/:id - Delete item
// ==========================================
router.delete('/:id', authenticate, requireRole('seller', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await db.query('SELECT * FROM items WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (existing.rows[0].seller_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await db.query('DELETE FROM items WHERE id = $1', [id]);
        res.json({ message: 'Item deleted' });
    } catch (err) {
        console.error('Delete item error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// GET /api/items/categories/all - List categories
// ==========================================
router.get('/categories/all', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM categories ORDER BY name');
        res.json({ categories: result.rows });
    } catch (err) {
        console.error('List categories error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
