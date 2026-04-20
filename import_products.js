const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');
const fs = require('fs');

async function importProducts() {
    try {
        const workbook = XLSX.readFile('정보.xlsx');
        const sheetName = '제품업';
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            console.error(`시트 '${sheetName}'를 찾을 수 없습니다.`);
            return;
        }
        const rows = XLSX.utils.sheet_to_json(worksheet);

        console.log(`시트명: ${sheetName}, 데이터: ${rows.length}행`);

        // 1. 기존 데이터 백업
        const oldProducts = await prisma.nPS_t_product.findMany();
        if (!fs.existsSync('data')) fs.mkdirSync('data');
        fs.writeFileSync('data/backup_products_before_clear.jsonl', oldProducts.map(p => JSON.stringify(p)).join('\n'));
        console.log(`기존 데이터 ${oldProducts.length}건 백업 완료.`);

        // 2. 초기화
        console.log('NPS_t_product 테이블 초기화 중...');
        await prisma.nPS_t_product.deleteMany({});

        let successCount = 0;

        for (const row of rows) {
            const code = String(row['제품코드'] || '');
            const barcode = String(row['바코드'] || '');
            const name = row['제품명'];

            if (!name) continue;

            const finalCode = code || barcode;
            const category = row['제품구분'] || '미분류';
            const weight = parseFloat(row['중량']) || 0;
            const kihan = String(row['유통\r\n기한'] || '');
            const pibox = row['박스\r\n구분'];
            const boxType = row['박스\r\nType'];
            const ipsu = parseInt(row['박스\r\n입수량']) || 1;
            const temp = row['품온'];
            const maker = row['생산처'];
            const vat = row['면/과세'] === '면세' ? '0' : '1';
            const price = parseInt(row['정상\r\n판매가']) || 0;
            const supplyPrice = parseInt(row['공급가']) || 0;
            const supplyRate = parseFloat(row['공급율']) || 0;
            const memo = row['비고'] || '';

            const isFrez = temp === '냉동' ? 'Y' : 'N';

            const productData = {
                P_CODE: finalCode,
                P_NAME: name,
                P_GROUP: category,
                P_DIV_PICK: category,
                P_DIV_BAS: category,
                P_BARCODE: barcode,
                P_KG: weight,
                P_KIHAN: kihan,
                P_PIBOX: pibox,
                P_BOX_TYPE: boxType,
                P_IPSU: ipsu,
                P_DIV_STOCK: temp,
                P_IS_FREZ: isFrez,
                P_MAKER: maker,
                P_IS_VAT: vat,
                P_DAN: price,
                P_SUP_PRICE: supplyPrice,
                P_SUP_RATE: supplyRate,
                P_MEMO: memo
            };

            await prisma.nPS_t_product.upsert({
                where: {
                    P_CODE_P_GROUP: {
                        P_CODE: finalCode,
                        P_GROUP: category
                    }
                },
                update: productData,
                create: productData
            });
            successCount++;
        }

        console.log(`등록 완료: ${successCount}건`);

    } catch (e) {
        console.error('Import Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}


importProducts();
