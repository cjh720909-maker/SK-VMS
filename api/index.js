// dispatch_server.js
// [Universal VMS] 배차 요약 화면 (기사별 납품처/중량 집계)
require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const fs = require('fs');
const iconv = require('iconv-lite');
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer({ dest: 'uploads/' });

const app = express();
const port = 3011;
const prisma = new PrismaClient();

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

function fixEncoding(str) {
    if (typeof str !== 'string') return str;
    try {
        return iconv.decode(Buffer.from(str, 'binary'), 'euc-kr');
    } catch (e) { return str; }
}

// API: 배차 요약 정보 조회
app.get('/api/summary', async (req, res) => {
    try {
        const { startDate, endDate, drivers, custName } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ error: "날짜를 입력하세요." });

        let customerCondition = "";
        if (custName && custName !== "") {
            customerCondition = ` AND b."CB_DIV_CUST" = '${custName}'`;
        }

        const query = `
        SELECT
            b."CB_DRIVER",
            c."CA_NAME",
            c."CA_KG",
            COUNT(DISTINCT b."B_C_NAME") as delivery_dest_count,
            COUNT(DISTINCT (b."B_DATE", b."CB_DRIVER", b."B_P_NO")) as total_count,
            SUM(b."B_KG") as total_weight
        FROM "SK_vms"."NPS_t_balju" b
        LEFT JOIN "SK_vms"."NPS_t_car" c ON b."CB_DRIVER" = c."CB_DRIVER"
        WHERE b."B_DATE" >= '${startDate}' AND b."B_DATE" <= '${endDate}'
        ${customerCondition}
        AND b."CB_DRIVER" IS NOT NULL AND b."CB_DRIVER" <> ''
        GROUP BY b."CB_DRIVER", c."CA_NAME", c."CA_KG"
        ORDER BY COALESCE(c."CA_NAME", b."CB_DRIVER") ASC
        `;

        const result = await prisma.$queryRawUnsafe(query);
        const serializedResult = result.map(row => ({
            driverName: fixEncoding(row.CA_NAME) || fixEncoding(row.CB_DRIVER),
            dispatchName: fixEncoding(row.CB_DRIVER),
            maxWeight: Number(row.CA_KG || 0) * 1000,
            destCount: Number(row.delivery_dest_count || 0),
            totalCount: Number(row.total_count || 0),
            totalWeight: Number(row.total_weight || 0)
        }));

        res.json({
            data: serializedResult,
            summary: {
                totalDrivers: new Set(serializedResult.map(r => r.driverName)).size,
                totalDispatchNames: serializedResult.length,
                totalDestinations: serializedResult.reduce((acc, cur) => acc + cur.destCount, 0),
                totalShipments: serializedResult.reduce((acc, cur) => acc + cur.totalCount, 0),
                totalWeight: serializedResult.reduce((acc, cur) => acc + cur.totalWeight, 0)
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: 피킹 요약 정보 조회
app.get('/api/picking-summary', async (req, res) => {
    try {
        const { startDate, endDate, custName } = req.query;
        let whereClause = `WHERE b."B_DATE" >= '${startDate}' AND b."B_DATE" <= '${endDate}'`;
        if (custName && custName !== '') {
            whereClause += ` AND b."CB_DIV_CUST" = '${custName}'`;
        }

        const query = `
            SELECT 
                p_div_pick_fixed as picking_class,
                COUNT(*) as pick_count,
                SUM(qty) as total_qty,
                SUM(kg) as total_weight
            FROM (
                SELECT 
                    p."P_DIV_PICK" as p_div_pick_fixed,
                    b."CB_DRIVER",
                    b."B_P_NO",
                    SUM(b."B_QTY") as qty,
                    SUM(b."B_KG") as kg
                FROM "SK_vms"."NPS_t_balju" b
                LEFT JOIN "SK_vms"."NPS_t_product" p ON b."B_P_NO" = p."P_CODE"
                ${whereClause}
                GROUP BY p_div_pick_fixed, b."B_DATE", b."CB_DRIVER", b."B_P_NO"
            ) as sub
            GROUP BY picking_class
            ORDER BY pick_count DESC
        `;
        const result = await prisma.$queryRawUnsafe(query);
        const safeResult = result.map(row => ({
            className: fixEncoding(row.picking_class) || '미분류',
            pickCount: Number(row.pick_count || 0),
            totalQty: Number(row.total_qty || 0),
            totalWeight: Number(row.total_weight || 0)
        }));
        res.json({ data: safeResult });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: 피킹 분석 정보 조회
app.get('/api/picking-analysis', async (req, res) => {
    try {
        const { startDate, endDate, pickingClass } = req.query;
        let whereClause = `WHERE b."B_DATE" >= '${startDate}' AND b."B_DATE" <= '${endDate}'`;

        // [최종 진화형 쿼리] 서브쿼리에서 먼저 품목별로 묶고 외부에서 필터링하여 오차를 0으로 만듭니다.
        const query = `
            SELECT 
                group_name,
                driver_name,
                MAX(dock_no) as dock_no,
                COUNT(*) as pick_count,
                SUM(total_qty) as total_qty,
                SUM(total_weight) as total_weight,
                SUM(total_boxes) as total_boxes,
                SUM(total_items) as total_items
            FROM (
                SELECT 
                    COALESCE(c340."CD_GROUP", p."P_DIV_PICK") as group_name,
                    b."CB_DRIVER" as driver_name,
                    c."CA_DOCKNO" as dock_no,
                    b."B_P_NO",
                    SUM(b."B_QTY") as total_qty,
                    SUM(b."B_KG") as total_weight,
                    FLOOR(SUM(b."B_QTY") / NULLIF(MAX(p."P_IPSU"), 0)) as total_boxes,
                    SUM(b."B_QTY") % NULLIF(MAX(p."P_IPSU"), 0) as total_items
                FROM "SK_vms"."NPS_t_balju" b
                LEFT JOIN "SK_vms"."NPS_t_product" p ON b."B_P_NO" = p."P_CODE"
                LEFT JOIN "SK_vms"."NPS_t_code_340" c340 ON p."P_DIV_PICK" = c340."P_DIV_PICK"
                LEFT JOIN "SK_vms"."NPS_t_car" c ON b."CB_DRIVER" = c."CB_DRIVER"
                ${whereClause}
                GROUP BY group_name, b."B_DATE", b."CB_DRIVER", b."B_P_NO", c."CA_DOCKNO"
            ) as sub
            WHERE 1=1
            ${pickingClass && pickingClass !== '' ? ` AND group_name = '${pickingClass}'` : ''}
            GROUP BY group_name, driver_name
            ORDER BY group_name ASC, total_qty DESC
        `;

        const result = await prisma.$queryRawUnsafe(query);
        const safeResult = result.map(row => ({
            groupName: fixEncoding(row.group_name) || '미분류',
            driverName: fixEncoding(row.driver_name) || '-',
            dockNo: fixEncoding(row.dock_no) || '-',
            pickCount: Number(row.pick_count || 0),
            totalQty: Number(row.total_qty || 0),
            totalWeight: Number(row.total_weight || 0),
            totalBoxes: Number(row.total_boxes || 0),
            totalItems: Number(row.total_items || 0)
        }));
        res.json({ data: safeResult });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: 피킹 리스트 (품목별/차량별 피벗)
app.get('/api/picking-list', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "날짜를 입력하세요." });

        const query = `
            SELECT 
                b."B_P_NAME" as product_name,
                b."B_P_NO" as product_code,
                b."B_C_NAME" as customer_name,
                b."CB_DRIVER" as driver_name,
                p."P_IPSU" as ipsu,
                SUM(b."B_QTY") as total_qty,
                SUM(b."B_KG") as total_weight
            FROM "SK_vms"."NPS_t_balju" b
            LEFT JOIN "SK_vms"."NPS_t_product" p ON b."B_P_NO" = p."P_CODE"
            WHERE b."B_DATE" = '${date}'
            GROUP BY b."B_P_NAME", b."B_P_NO", b."B_C_NAME", b."CB_DRIVER", p."P_IPSU"
            ORDER BY b."B_P_NAME" ASC, b."B_C_NAME" ASC
        `;

        const result = await prisma.$queryRawUnsafe(query);
        // BigInt serialization fix
        const safeResult = result.map(row => ({
            ...row,
            total_qty: Number(row.total_qty || 0),
            total_weight: Number(row.total_weight || 0)
        }));
        res.json({ data: safeResult });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: 업로드된 주문 내역 조회 (로컬 DB)
app.get('/api/orders', async (req, res) => {
    try {
        const { startDate, endDate, search } = req.query;
        let where = {};

        if (startDate && endDate) {
            where.B_DATE = { gte: startDate, lte: endDate };
        }

        if (search) {
            where.OR = [
                { B_C_NAME: { contains: search, mode: 'insensitive' } },
                { B_P_NAME: { contains: search, mode: 'insensitive' } },
                { CB_DRIVER: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [orders, products] = await Promise.all([
            prisma.nPS_t_balju.findMany({
                where: where,
                orderBy: [
                    { B_DATE: 'desc' },
                    { B_C_NAME: 'asc' }
                ],
                take: 2000
            }),
            prisma.nPS_t_product.findMany({
                select: { P_CODE: true, P_IPSU: true }
            })
        ]);

        const productMap = products.reduce((acc, p) => {
            acc[p.P_CODE] = p.P_IPSU || 1;
            return acc;
        }, {});

        const result = orders.map(o => ({
            ...o,
            P_IPSU: productMap[o.B_P_NO] || 1
        }));

        res.json({ data: result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: 데이터 동기화 (최근 14일)
app.post('/api/sync', async (req, res) => {
    let mysqlConn = null;
    let pgClient = null;
    try {
        const sourceUrl = process.env.MYSQL_URL || "mysql://user_web:pass_web%40%23@221.143.21.135:3306/db_ndy?charset=utf8mb4";
        const targetUrl = process.env.DATABASE_URL;
        const targetSchema = 'SK_vms';

        const TARGET_TABLES = [
            { source: 't_balju', target: 'NPS_t_balju', useFilter: true },
            { source: 't_car', target: 'NPS_t_car', useFilter: false },
            { source: 't_code_340', target: 'NPS_t_code_340', useFilter: false },
            { source: 't_product', target: 'NPS_t_product', useFilter: false }
        ];

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const dateStr = fourteenDaysAgo.toISOString().split('T')[0];

        mysqlConn = await mysql.createConnection(sourceUrl);
        pgClient = new Client({ connectionString: targetUrl });
        await pgClient.connect();
        await pgClient.query(`SET search_path TO ${targetSchema}`);

        const batchSize = 1000;

        for (const table of TARGET_TABLES) {
            await pgClient.query(`TRUNCATE TABLE "${table.target}" RESTART IDENTITY`);

            let offset = 0;
            let hasMore = true;
            const filterClause = table.useFilter ? `WHERE B_DATE >= '${dateStr}'` : '';

            while (hasMore) {
                const query = `SELECT * FROM ${table.source} ${filterClause} LIMIT ${batchSize} OFFSET ${offset}`;
                const [rows] = await mysqlConn.execute(query);

                if (rows.length === 0) {
                    hasMore = false;
                    break;
                }

                const cols = Object.keys(rows[0]);
                const fields = cols.map(c => `"${c}"`).join(', ');
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
                await pgClient.query(bulkInsertQuery, values);

                offset += rows.length;
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('Sync Error:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (mysqlConn) await mysqlConn.end();
        if (pgClient) await pgClient.end();
    }
});

// API: 배차 현황 조회 (로컬 DB 조회로 전환)
app.get('/api/dispatch-status', async (req, res) => {
    try {
        const { startDate, endDate, search, custName } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ error: "날짜를 입력하세요." });

        let where = {
            B_DATE: { gte: startDate, lte: endDate }
        };

        if (search) {
            where.OR = [
                { CB_DRIVER: { contains: search, mode: 'insensitive' } },
                { B_C_NAME: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (custName) {
            where.CB_DIV_CUST = custName;
        }

        const stats = await prisma.nPS_t_balju.groupBy({
            by: ['B_DATE', 'B_C_NAME'],
            _sum: {
                B_QTY: true,
                B_KG: true
            },
            _max: {
                CB_DRIVER: true
            },
            _count: {
                B_P_NO: true
            },
            where: where,
            orderBy: [
                { B_DATE: 'asc' },
                { B_C_NAME: 'asc' }
            ],
            take: 1000
        });

        const formatted = stats.map(s => ({
            B_DATE: s.B_DATE,
            B_C_NAME: s.B_C_NAME,
            CB_DRIVER: s._max.CB_DRIVER,
            B_QTY: s._sum.B_QTY,
            B_KG: s._sum.B_KG,
            item_types: s._count.B_P_NO
        }));

        res.json({ data: formatted });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: 배차 현황 상세 품목 조회 (로컬 DB 조회로 전환)
app.get('/api/dispatch-status-details', async (req, res) => {
    try {
        const { date, custName } = req.query;
        if (!date || !custName) return res.status(400).json({ error: "날짜와 거래처명을 확인하세요." });

        const rows = await prisma.nPS_t_balju.findMany({
            where: {
                B_DATE: date,
                B_C_NAME: custName
            },
            select: {
                B_P_NAME: true,
                B_QTY: true
            },
            orderBy: {
                B_QTY: 'desc'
            }
        });

        const formatted = rows.reduce((acc, cur) => {
            const existing = acc.find(a => a.itemName === cur.B_P_NAME);
            if (existing) {
                existing.qty += cur.B_QTY;
            } else {
                acc.push({ itemName: cur.B_P_NAME, qty: cur.B_QTY });
            }
            return acc;
        }, []);

        res.json({ data: formatted });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/customers', async (req, res) => {
    try {
        const raw = await prisma.$queryRawUnsafe(`SELECT DISTINCT "CB_DIV_CUST" FROM "SK_vms"."NPS_t_balju" WHERE "B_DATE" >= (CURRENT_DATE - INTERVAL '30 days')::text AND "CB_DIV_CUST" IS NOT NULL`);
        res.json({ data: raw.map(r => fixEncoding(r.CB_DIV_CUST)).filter(c => c) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: 제품 정보 목록 조회
app.get('/api/products', async (req, res) => {
    try {
        const { search, category } = req.query;
        let where = {};

        if (search) {
            where.OR = [
                { P_NAME: { contains: search, mode: 'insensitive' } },
                { P_BARCODE: { contains: search, mode: 'insensitive' } },
                { P_CODE: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (category) {
            where.P_GROUP = category;
        }

        const products = await prisma.nPS_t_product.findMany({
            where: where,
            orderBy: { P_IDX: 'desc' },
            take: 1000
        });

        res.json({ data: products });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: 제품 정보 단일 등록/수정
app.post('/api/products', async (req, res) => {
    try {
        const { P_IDX, ...data } = req.body;
        // P_IDX가 ""(빈 문자열)로 오면 신규 등록(null 처리)
        const idx = (P_IDX && P_IDX !== "") ? Number(P_IDX) : null;

        // 필수값 검증
        if (!data.P_CODE) return res.status(400).json({ error: '제품코드는 필수 입력 사항입니다.' });
        if (!data.P_NAME) return res.status(400).json({ error: '제품명은 필수 입력 사항입니다.' });
        if (!data.P_IPSU || parseInt(data.P_IPSU) <= 0) return res.status(400).json({ error: '입수량(Ipsu)은 필수이며 1 이상이어야 합니다.' });

        // 숫자 형식 변환
        data.P_KG = parseFloat(data.P_KG) || 0;
        data.P_IPSU = parseInt(data.P_IPSU) || 1;
        data.P_DAN = parseInt(data.P_DAN) || 0;
        data.P_SUP_PRICE = parseInt(data.P_SUP_PRICE) || 0;
        // P_PIBOX는 String? 이므로 별도 변환 없이 유지하거나 빈 문자열 처리
        if (data.P_PIBOX === "") data.P_PIBOX = null;
        else if (data.P_PIBOX !== undefined) data.P_PIBOX = String(data.P_PIBOX);

        // 기타 빈 문자열 -> null 처리
        Object.keys(data).forEach(key => {
            if (data[key] === "" && key !== 'P_PIBOX') data[key] = null;
        });

        // 중복 체크 (P_CODE, P_NAME, P_BARCODE)
        const duplicateCheck = await prisma.nPS_t_product.findFirst({
            where: {
                OR: [
                    { P_CODE: data.P_CODE },
                    { P_NAME: data.P_NAME },
                    ...(data.P_BARCODE ? [{ P_BARCODE: data.P_BARCODE }] : [])
                ],
                NOT: idx ? { P_IDX: idx } : undefined
            }
        });

        if (duplicateCheck) {
            let field = '';
            if (duplicateCheck.P_CODE === data.P_CODE) field = '제품코드';
            else if (duplicateCheck.P_NAME === data.P_NAME) field = '제품명';
            else if (duplicateCheck.P_BARCODE === data.P_BARCODE) field = '바코드';
            return res.status(400).json({ error: `이미 등록된 ${field}입니다. 중복 사용이 불가능합니다.` });
        }

        if (idx) {
            const updated = await prisma.nPS_t_product.update({
                where: { P_IDX: idx },
                data: data
            });
            res.json({ success: true, data: updated });
        } else {
            const created = await prisma.nPS_t_product.create({ data });
            res.json({ success: true, data: created });
        }
    } catch (e) {
        console.error('Product Save Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// API: 제품 정보 엑셀 업로드
app.post('/api/products-upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        const batchData = data.map(row => ({
            P_CODE: String(row['제품코드'] || row['P_CODE'] || ''),
            P_BARCODE: String(row['바코드'] || row['P_BARCODE'] || ''),
            P_NAME: String(row['제품명'] || row['P_NAME'] || ''),
            P_GROUP: String(row['제품그룹'] || row['제품구분'] || row['P_GROUP'] || ''),
            P_KG: parseFloat(row['중량'] || row['P_KG'] || 0),
            P_IPSU: parseInt(row['입수량'] || row['입수'] || row['P_IPSU'] || 1),
            P_PIBOX: parseInt(row['박스당중량'] || row['박스중량'] || row['P_PIBOX'] || 0),
            P_BOX_TYPE: String(row['박스타입'] || row['BoxType'] || row['P_BOX_TYPE'] || ''),
            P_DAN: parseInt(row['판매가'] || row['단가'] || row['P_DAN'] || 0),
            P_SUP_PRICE: parseInt(row['공급가'] || row['P_SUP_PRICE'] || 0),
            P_MAKER: String(row['생산처'] || row['제조사'] || row['P_MAKER'] || ''),
            P_MEMO: String(row['비고'] || row['메모'] || row['P_MEMO'] || '')
        })).filter(item => item.P_CODE !== '');

        await prisma.nPS_t_product.deleteMany({});
        const chunkSize = 100;
        for (let i = 0; i < batchData.length; i += chunkSize) {
            await prisma.nPS_t_product.createMany({
                data: batchData.slice(i, i + chunkSize)
            });
        }
        fs.unlinkSync(req.file.path);
        res.json({ success: true, count: batchData.length });
    } catch (e) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
});


// API: 중량 조회 (날짜/거래처별 중량 합계)
app.get('/api/weight-summary', async (req, res) => {
    try {
        const { startDate, endDate, search } = req.query;
        let whereClause = `WHERE 1=1`;
        if (startDate && endDate) {
            whereClause += ` AND b."B_DATE" >= '${startDate}' AND b."B_DATE" <= '${endDate}'`;
        }
        if (search) {
            whereClause += ` AND b."B_C_NAME" ILIKE '%${search}%'`;
        }

        const query = `
            SELECT 
                b."B_DATE" as "B_DATE", 
                b."B_C_NAME" as "B_C_NAME", 
                CAST(COUNT(DISTINCT b."B_P_NO") AS FLOAT) as "item_count",
                CAST(SUM(b."B_QTY") AS FLOAT) as "total_qty",
                CAST(SUM(b."B_KG") AS FLOAT) as "total_weight"
            FROM "SK_vms"."NPS_t_balju" b
            ${whereClause}
            GROUP BY b."B_DATE", b."B_C_NAME"
            ORDER BY b."B_DATE" DESC, b."B_C_NAME" ASC
        `;

        const data = await prisma.$queryRawUnsafe(query);
        res.json({ data: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: 주문 정보 엑셀 업로드
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "파일을 업로드하세요." });

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = '주문';
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: "'주문' 시트를 찾을 수 없습니다." });
        }

        const rows = XLSX.utils.sheet_to_json(worksheet);

        // 제품 정보 로드 (중량 계산용)
        const products = await prisma.nPS_t_product.findMany();
        const productMap = new Map();
        products.forEach(p => {
            productMap.set(String(p.P_CODE), p);
            if (p.P_BARCODE) productMap.set(String(p.P_BARCODE), p);
        });

        function excelDateToISO(serial) {
            if (!serial) return null;
            const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }

        const batchData = [];
        for (const row of rows) {
            const outDate = excelDateToISO(row['출고일자']);
            const orderDate = excelDateToISO(row['주문일자']);
            const custName = row['거래처'];
            const pCode = String(row['품목코드'] || '');
            const pName = row['품명'];
            const qty = parseInt(row['수량']) || 0;
            const driver = row['차량'];
            const barcode = String(row['바코드'] || '');
            const orderNo = String(row['번호'] || '');

            if (!outDate || !custName || !pName) continue;

            let finalCustName = String(custName);
            if (finalCustName === '라온유통(N)') {
                const driverStr = String(driver || '');
                if (driverStr.includes('통영')) finalCustName = '라온유통(N)-통영';
                else if (driverStr.includes('진주')) finalCustName = '라온유통(N)-진주';
            }

            let kg = 0;
            const pInfo = productMap.get(pCode) || productMap.get(barcode);
            if (pInfo) kg = Number(pInfo.P_KG || 0) * qty;

            batchData.push({
                B_EX_SEQ: orderNo,
                B_ORDER_DATE: orderDate,
                B_DATE: outDate,
                B_C_NAME: finalCustName,
                B_C_NAME_ORI: String(custName),
                B_P_NO: pCode,
                B_P_NAME: String(pName),
                B_BARCODE: barcode,
                B_QTY: qty,
                B_KG: kg,
                CB_DRIVER: String(driver || ''),
                CB_DIV_CUST: String(row['품목군'] || '미분류'),
                B_DAN: parseInt(row['합계']) || 0,
                B_STATE: String(row['판매상태'] || ''),
                B_MAKER: String(row['생산처'] || ''),
                B_C_CODE: '',
                B_IN_CONFIRM: 'N',
                B_PICK_DONE: 'N',
                B_GUM_DONE: 'N'
            });
        }

        // 기존 데이터 삭제
        await prisma.nPS_t_balju.deleteMany({});

        // 벌크 인서트 (1000개씩)
        const chunkSize = 1000;
        for (let i = 0; i < batchData.length; i += chunkSize) {
            await prisma.nPS_t_balju.createMany({
                data: batchData.slice(i, i + chunkSize)
            });
        }

        fs.unlinkSync(req.file.path);
        res.json({ success: true, count: batchData.length });


    } catch (e) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
});

// API: 차량 상세 등록/수정
app.post('/api/cars', async (req, res) => {
    try {
        const { CA_IDX, ...data } = req.body;
        if (CA_IDX) {
            const updated = await prisma.nPS_t_car.update({
                where: { CA_IDX: Number(CA_IDX) },
                data: data
            });
            res.json({ success: true, data: updated });
        } else {
            const created = await prisma.nPS_t_car.create({ data });
            res.json({ success: true, data: created });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: 차량 목록 조회
app.get('/api/cars', async (req, res) => {
    try {
        const cars = await prisma.nPS_t_car.findMany({
            orderBy: { CA_IDX: 'desc' }
        });
        res.json({ data: cars });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: 거래처 상세 등록/수정
app.post('/api/customers-master', async (req, res) => {
    try {
        const { C_IDX, ...data } = req.body;
        if (C_IDX) {
            const updated = await prisma.nPS_t_customer.update({
                where: { C_IDX: Number(C_IDX) },
                data: data
            });
            res.json({ success: true, data: updated });
        } else {
            const created = await prisma.nPS_t_customer.create({ data });
            res.json({ success: true, data: created });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: 거래처 목록 조회
app.get('/api/customers-master', async (req, res) => {
    try {
        const { search } = req.query;
        let where = {};
        if (search) {
            where.OR = [
                { C_NAME: { contains: search, mode: 'insensitive' } },
                { C_CODE: { contains: search, mode: 'insensitive' } }
            ];
        }
        const customers = await prisma.nPS_t_customer.findMany({
            where: where,
            orderBy: { C_IDX: 'desc' }
        });
        res.json({ data: customers });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚚 Universal VMS 가동 중: http://localhost:${port}`);
});
