const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkDb() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Database connected:', res.rows[0]);

        const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log('Tables:', tables.rows.map(r => r.table_name));

        const users = await pool.query('SELECT count(*) FROM users');
        console.log('User count:', users.rows[0].count);

        process.exit(0);
    } catch (err) {
        console.error('Database check failed:', err);
        process.exit(1);
    }
}

checkDb();
