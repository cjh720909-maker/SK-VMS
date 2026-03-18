require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
    const sourceUrl = process.env.MYSQL_URL || "mysql://user_web:pass_web%40%23@221.143.21.135:3306/db_ndy?charset=utf8mb4";
    console.log('Connecting to:', sourceUrl.replace(/:[^:@]+@/, ':***@')); // Hide password
    try {
        const conn = await mysql.createConnection(sourceUrl);
        console.log('✅ Connection Success!');
        const [rows] = await conn.execute('SELECT COUNT(*) as count FROM t_balju WHERE B_DATE >= DATE_SUB(NOW(), INTERVAL 1 DAY)');
        console.log('Query result:', rows);
        await conn.end();
    } catch (e) {
        console.error('❌ Connection Failed:', e);
    }
}

test();
