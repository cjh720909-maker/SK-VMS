require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
    const sourceUrl = process.env.MYSQL_URL || "mysql://user_web:pass_web%40%23@221.143.21.135:3306/db_ndy?charset=utf8mb4";
    try {
        const conn = await mysql.createConnection(sourceUrl);
        // Let's find any row to see what the data looks like
        const [rows] = await conn.execute('SELECT B_C_NAME, B_DATE FROM t_balju ORDER BY B_DATE DESC LIMIT 10');
        console.log('Sample rows:', rows);

        // Try searching without CONVERT but with simple LIKE
        const search = '서원';
        const [searchRows] = await conn.execute(`SELECT B_C_NAME FROM t_balju WHERE B_C_NAME LIKE '%${search}%' LIMIT 5`);
        console.log('Search result for "서원":', searchRows);

        await conn.end();
    } catch (e) {
        console.error('❌ Test Failed:', e);
    }
}

test();
