const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// All admin routes require admin role
router.use(authenticate, requireRole('admin'));

// ==========================================
// GET /api/admin/users - List all users
// ==========================================
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;

        let queryText = `
      SELECT id, email, name, role, phone, hostel_name, room_number, avatar_url, created_at,
             (SELECT COUNT(*) FROM items WHERE seller_id = users.id) as item_count,
             (SELECT COUNT(*) FROM bids WHERE bidder_id = users.id) as bid_count
      FROM users WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        if (role) {
            queryText += ` AND role = $${paramIndex++}`;
            params.push(role);
        }
        if (search) {
            queryText += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        queryText += ' ORDER BY created_at DESC';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        queryText += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), offset);

        const result = await db.query(queryText, params);
        res.json({ users: result.rows });
    } catch (err) {
        console.error('Admin list users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// PUT /api/admin/users/:id/role - Change user role
// ==========================================
router.put('/users/:id/role', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['admin', 'seller', 'buyer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const result = await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
            [role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error('Admin change role error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// DELETE /api/admin/users/:id - Delete user
// ==========================================
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// GET /api/admin/stats - Dashboard stats
// ==========================================
router.get('/stats', async (req, res) => {
    try {
        const [users, items, auctions, bids] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM users'),
            db.query('SELECT COUNT(*) as count FROM items'),
            db.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM auctions"),
            db.query('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM bids'),
        ]);

        res.json({
            stats: {
                total_users: parseInt(users.rows[0].count),
                total_items: parseInt(items.rows[0].count),
                total_auctions: parseInt(auctions.rows[0].total),
                active_auctions: parseInt(auctions.rows[0].active),
                total_bids: parseInt(bids.rows[0].count),
                total_bid_value: parseFloat(bids.rows[0].total_value),
            },
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// DELETE /api/admin/items/:id - Remove listing
// ==========================================
router.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("UPDATE items SET status = 'removed' WHERE id = $1", [id]);
        res.json({ message: 'Item removed' });
    } catch (err) {
        console.error('Admin remove item error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// POST /api/admin/auctions/:id/cancel - Cancel auction
// ==========================================
router.post('/auctions/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;

        const auction = await db.query('SELECT * FROM auctions WHERE id = $1', [id]);
        if (auction.rows.length === 0) {
            return res.status(404).json({ error: 'Auction not found' });
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query("UPDATE auctions SET status = 'cancelled' WHERE id = $1", [id]);
            await client.query("UPDATE items SET status = 'listed' WHERE id = $1", [auction.rows[0].item_id]);
            await client.query('COMMIT');
            res.json({ message: 'Auction cancelled' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Admin cancel auction error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
