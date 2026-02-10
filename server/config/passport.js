const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

const configurePassport = () => {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Check if user already exists with this Google ID
                    let result = await db.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);

                    if (result.rows.length > 0) {
                        return done(null, result.rows[0]);
                    }

                    // Check if user exists with same email
                    const email = profile.emails[0].value;
                    result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

                    if (result.rows.length > 0) {
                        // Link Google account to existing user
                        const updated = await db.query(
                            'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE email = $3 RETURNING *',
                            [profile.id, profile.photos[0]?.value, email]
                        );
                        return done(null, updated.rows[0]);
                    }

                    // Create new user
                    const newUser = await db.query(
                        'INSERT INTO users (email, name, google_id, avatar_url, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                        [email, profile.displayName, profile.id, profile.photos[0]?.value, 'buyer']
                    );

                    return done(null, newUser.rows[0]);
                } catch (err) {
                    return done(err, null);
                }
            }
        )
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
            done(null, result.rows[0]);
        } catch (err) {
            done(err, null);
        }
    });
};

module.exports = configurePassport;
