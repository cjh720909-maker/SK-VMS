require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
    const sourceUrl = process.env.MYSQL_URL || "mysql://user_web:pass_web%40%23@221.143.21.135:3306/db_ndy?charset=utf8mb4";
    try {
        const conn = await mysql.createConnection(sourceUrl);
        const [rows] = await conn.execute('SELECT * FROM t_balju LIMIT 1');
        console.log('Columns found:', Object.keys(rows[0]));
        await conn.end();
    } catch (e) {
        console.error('❌ Query Failed:', e);
    }
}

test();
