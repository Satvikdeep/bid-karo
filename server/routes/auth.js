const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// Helper: generate JWT
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

// ==========================================
// POST /api/auth/register
// ==========================================
router.post(
    '/register',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('role').optional().isIn(['buyer', 'seller']).withMessage('Role must be buyer or seller'),
        body('hostel_name').optional().trim(),
        body('room_number').optional().trim(),
        body('phone').optional().trim(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password, name, role = 'buyer', hostel_name, room_number, phone } = req.body;

            // Check if user already exists
            const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Email already registered' });
            }

            // Hash password
            const salt = await bcrypt.genSalt(12);
            const password_hash = await bcrypt.hash(password, salt);

            // Create user
            const result = await db.query(
                `INSERT INTO users (email, password_hash, name, role, hostel_name, room_number, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, name, role, hostel_name, room_number, phone, avatar_url, created_at`,
                [email, password_hash, name, role, hostel_name, room_number, phone]
            );

            const user = result.rows[0];
            const token = generateToken(user.id);

            res.status(201).json({
                message: 'Registration successful',
                token,
                user,
            });
        } catch (err) {
            // Pass to global error handler for debugging details
            next(err);
        }
    }
);

// ==========================================
// POST /api/auth/login
// ==========================================
router.post(
    '/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password } = req.body;

            // Find user
            const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const user = result.rows[0];

            // Check if user registered via Google (no password)
            if (!user.password_hash) {
                return res.status(401).json({ error: 'Please sign in with Google' });
            }

            // Verify password
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = generateToken(user.id);

            res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    hostel_name: user.hostel_name,
                    room_number: user.room_number,
                    phone: user.phone,
                    avatar_url: user.avatar_url,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// ==========================================
// GET /api/auth/me - Get current user
// ==========================================
router.get('/me', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, email, name, role, phone, hostel_name, room_number, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// PUT /api/auth/profile - Update profile
// ==========================================
router.put(
    '/profile',
    authenticate,
    [
        body('name').optional().trim().notEmpty(),
        body('phone').optional().trim(),
        body('hostel_name').optional().trim(),
        body('room_number').optional().trim(),
        body('role').optional().isIn(['buyer', 'seller']),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, phone, hostel_name, room_number, role } = req.body;

            const result = await db.query(
                `UPDATE users SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          hostel_name = COALESCE($3, hostel_name),
          room_number = COALESCE($4, room_number),
          role = COALESCE($5, role)
        WHERE id = $6
        RETURNING id, email, name, role, phone, hostel_name, room_number, avatar_url`,
                [
                    name || null,
                    phone || null,
                    hostel_name || null,
                    room_number || null,
                    role || null,
                    req.user.id
                ]
            );

            res.json({ user: result.rows[0] });
        } catch (err) {
            console.error('Update profile error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// ==========================================
// Google OAuth Routes
// ==========================================
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        const token = generateToken(req.user.id);
        // Redirect to frontend with token
        res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
    }
);

module.exports = router;
