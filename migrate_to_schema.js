require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const sourceUrl = process.env.MYSQL_URL || "mysql://user_web:pass_web%40%23@221.143.21.135:3306/db_ndy?charset=utf8mb4";
const targetUrl = process.env.DATABASE_URL;
const targetSchema = 'prj_picking_system';

const TARGET_TABLES = [
    { source: 't_balju', target: 'NPS_t_balju', useFilter: true },
    { source: 't_car', target: 'NPS_t_car', useFilter: false },
    { source: 't_code_340', target: 'NPS_t_code_340', useFilter: false },
    { source: 't_product', target: 'NPS_t_product', useFilter: false }
];

async function main() {
    console.log('[1/4] 데이터 백업 및 최적화 이관 시작 (최신 14일 기준 + 벌크 삽입)...');

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const dateStr = fourteenDaysAgo.toISOString().split('T')[0];
    console.log(` - 기준 일자: ${dateStr} 이후 데이터만 처리`);

    const backupDir = path.join(__dirname, 'data');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
    const backupDate = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];

    const connection = await mysql.createConnection(sourceUrl);

    let pgClient = null;
    if (targetUrl) {
        pgClient = new Client({ connectionString: targetUrl });
        await pgClient.connect();
        await pgClient.query(`CREATE SCHEMA IF NOT EXISTS ${targetSchema}`);
        await pgClient.query(`SET search_path TO ${targetSchema}`);
        console.log(` - Schema [${targetSchema}] 준비 완료.`);

        await pgClient.query(`
            CREATE TABLE IF NOT EXISTS "NPS_t_balju" (
                "B_IDX" SERIAL PRIMARY KEY, "CB_IDX" INTEGER, "CB_IDX_ORI" INTEGER, "B_DATE" VARCHAR(10), "B_C_NAME_ORI" VARCHAR(80), "B_C_NAME" VARCHAR(80) NOT NULL,
                "B_C_CODE" VARCHAR(40), "B_C_PAN_NAME_ORI" VARCHAR(80), "B_C_PAN_NAME" VARCHAR(80), "B_NAP_DIV_ORI" VARCHAR(20), "B_NAP_DIV" VARCHAR(20),
                "B_P_NO" VARCHAR(20), "B_P_NAME" VARCHAR(80), "B_DAN" INTEGER DEFAULT 0, "B_VAT_DIV" VARCHAR(10), "B_KG" DECIMAL(11,2) DEFAULT 0,
                "B_IN_QTY" DECIMAL(11,1) DEFAULT 0, "B_QTY" INTEGER DEFAULT 0, "B_PKG" VARCHAR(10), "B_NAP_NO" VARCHAR(20), "B_ORDER_NO" VARCHAR(20),
                "B_MEMO" VARCHAR(80), "B_EDT_E_NAME" VARCHAR(20), "C_NAME" VARCHAR(50), "B_EDT_DATETIME" TIMESTAMP, "CB_NAME" VARCHAR(80), "CB_DRIVER" VARCHAR(40),
                "CB_DIV_CUST" VARCHAR(20), "CB_ADDRESS" VARCHAR(200), "CB_PHONE" VARCHAR(40), "CB_HP" VARCHAR(40), "CB_BIND" VARCHAR(80), "CB_CODE" VARCHAR(40),
                "O_IDX" INTEGER, "B_EX_SEQ" VARCHAR(20) DEFAULT '0', "O_QTY" INTEGER DEFAULT 0, "B_IN_CONFIRM" CHAR(1) DEFAULT 'N', "B_PICK_DONE" CHAR(1) DEFAULT 'N',
                "B_GUM_DONE" CHAR(1) DEFAULT 'N', "B_GUM_DATE" TIMESTAMP, "B_GUM_E_NAME" VARCHAR(20), "B_QTY_DAS_STCOK" INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS "NPS_t_car" (
                "CA_IDX" SERIAL PRIMARY KEY, "CB_DRIVER" VARCHAR(20), "CA_NAME" VARCHAR(20), "CA_HP" VARCHAR(20), "CA_NO" VARCHAR(20),
                "CA_KG" DECIMAL(11,1) DEFAULT 0, "CA_MEMO" VARCHAR(200), "CA_DOCKNO" VARCHAR(10) DEFAULT '''', "CA_NOPRINT" CHAR(1) DEFAULT 'N',
                "CA_NOPRINT1" CHAR(1) DEFAULT 'N', "CA_NOPRINT2" CHAR(1) DEFAULT 'N', "CA_DAS_NUM_1" VARCHAR(10), "CA_DAS_NUM_C1" CHAR(2) DEFAULT '00',
                "CA_DAS_NUM_2" VARCHAR(10), "CA_DAS_NUM_C2" CHAR(2) DEFAULT '00', "CA_DAS_NUM_3" VARCHAR(10), "CA_DAS_NUM_C3" CHAR(2) DEFAULT '00',
                "CA_GUN" VARCHAR(40), "CA_IS_SMS" CHAR(1) DEFAULT 'N'
            );
            CREATE TABLE IF NOT EXISTS "NPS_t_code_340" (
                "CD_IDX" SERIAL PRIMARY KEY, "CD_GROUP" VARCHAR(40), "P_DIV_PICK" VARCHAR(40)
            );
            CREATE TABLE IF NOT EXISTS "NPS_t_product" (
                "P_IDX" SERIAL PRIMARY KEY, "P_CODE" VARCHAR(20), "P_NAME" VARCHAR(80), "P_DIV_BAS" VARCHAR(20), "P_DIV_PICK" VARCHAR(20),
                "P_GROUP" VARCHAR(20), "P_PIBOX" VARCHAR(20), "P_PIBOX_QTY" INTEGER DEFAULT 0, "P_KG" DECIMAL(11,3) DEFAULT 0, "P_DAN" INTEGER DEFAULT 0,
                "P_BARCODE" VARCHAR(20), "P_BARCODE2" VARCHAR(20), "P_MEMO" VARCHAR(255), "P_KIHAN" VARCHAR(10), "P_IPSU" INTEGER DEFAULT 1,
                "P_STOCK_QTY" INTEGER DEFAULT 0, "P_IMG" BYTEA, "P_DIV_STOCK" VARCHAR(20), "P_IS_FREZ" CHAR(1) DEFAULT 'N', "F_DAMDANG" VARCHAR(40),
                "F_INS_DATE" VARCHAR(10), "F_QTY" INTEGER DEFAULT 0, "P_IS_VAT" CHAR(1) DEFAULT '1', "P_MAKER" VARCHAR(20), "SI_QTY" INTEGER DEFAULT 0,
                "P_IS_NO_BARCODE" CHAR(1) DEFAULT 'N'
            );
        `);
    }

    const batchSize = 1000; // 벌크 사이즈 조정

    for (const table of TARGET_TABLES) {
        console.log(`\n - 작업 테이블: ${table.source}`);
        await pgClient.query(`TRUNCATE TABLE "${table.target}" RESTART IDENTITY`);

        let offset = 0;
        let hasMore = true;
        const backupStream = fs.createWriteStream(path.join(backupDir, `${table.source}_${backupDate}_14d_bulk.jsonl`));

        const filterClause = table.useFilter ? `WHERE B_DATE >= '${dateStr}'` : '';

        while (hasMore) {
            const query = `SELECT * FROM ${table.source} ${filterClause} LIMIT ${batchSize} OFFSET ${offset}`;
            const [rows] = await connection.execute(query);

            if (rows.length === 0) {
                hasMore = false;
                break;
            }

            for (const r of rows) {
                const safeR = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v]));
                backupStream.write(JSON.stringify(safeR) + '\n');
            }

            // 벌크 삽입 구현
            const cols = Object.keys(rows[0]);
            const fields = cols.map(c => `"${c}"`).join(', ');

            // VALUES ($1, $2, ...), ($n, $n+1, ...) 형식 구성
            let valueIdx = 1;
            const values = [];
            const rowsPlaceholders = rows.map(() => {
                const rowPlaceholders = cols.map(() => `$${valueIdx++}`).join(', ');
                return `(${rowPlaceholders})`;
            }).join(', ');

            for (const row of rows) {
                for (const col of cols) {
                    values.push(row[col] !== undefined ? row[col] : null);
                }
            }

            const bulkInsertQuery = `INSERT INTO "${table.target}" (${fields}) VALUES ${rowsPlaceholders}`;
            try {
                await pgClient.query(bulkInsertQuery, values);
            } catch (e) {
                console.error(`❌ 벌크 삽입 중 에러발생 (${table.source}):`, e.message);
                // 에러 발생 시 행별 삽입 재시도 로직보다는 로그 확인 권장
            }

            offset += rows.length;
            console.log(`   ... ${offset} rows 처리완료`);
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        backupStream.end();
    }

    if (pgClient) await pgClient.end();
    await connection.end();
    console.log('\n✅ 14일 기준 데이터 벌크 동기화가 완료되었습니다.');
}

main().catch(e => {
    console.error(`\n❌ Failed:`, e);
    process.exit(1);
});
