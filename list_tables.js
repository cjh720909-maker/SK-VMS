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
    WHERE table_schema = 'prj_picking_system'
  `);
    console.log("Tables in prj_picking_system:");
    res.rows.forEach(row => console.log(row.table_name));
    await client.end();
}

listTables().catch(console.error);
