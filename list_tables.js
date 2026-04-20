require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function listTables() {
    await client.connect();
    const res = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'SK_vms'
  `);
    console.log("Tables in SK_vms:");
    res.rows.forEach(row => console.log(row.table_name));
    await client.end();
}

listTables().catch(console.error);
