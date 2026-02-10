const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is missing in environment variables!');
} else {
  console.log('✅ DATABASE_URL is present. Connecting to DB...');
}

const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: isProduction ? 2 : 10, // Lower max connections for serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increase timeout
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  if (!isProduction) {
    process.exit(-1);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
