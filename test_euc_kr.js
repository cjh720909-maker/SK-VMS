require('dotenv').config();
const mysql = require('mysql2/promise');
const iconv = require('iconv-lite');

async function test() {
    const sourceUrl = process.env.MYSQL_URL || "mysql://user_web:pass_web%40%23@221.143.21.135:3306/db_ndy?charset=latin1"; // Try latin1 connection
    try {
        const conn = await mysql.createConnection(sourceUrl);
        const search = '서원';
        const searchBuffer = iconv.encode(search, 'euc-kr');
        const searchHex = searchBuffer.toString('hex');

        console.log(`Searching for "${search}" in EUC-KR: hex ${searchHex}`);

        // Use BINARY search with hex version
        const [rows] = await conn.execute(`SELECT B_C_NAME FROM t_balju WHERE B_C_NAME LIKE BINARY ? LIMIT 5`, [searchBuffer]);

        console.log('Search Result:', rows.map(r => ({
            raw: r.B_C_NAME,
            fixed: iconv.decode(Buffer.from(r.B_C_NAME, 'binary'), 'euc-kr')
        })));

        await conn.end();
    } catch (e) {
        console.error('❌ Search Failed:', e);
    }
}

test();
