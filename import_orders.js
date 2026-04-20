const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

function excelDateToISO(serial) {
    if (!serial) return null;
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
}

async function importOrders() {
    try {
        const workbook = XLSX.readFile('정보.xlsx');
        const sheetName = '주문';
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            console.error("'주문' 시트를 찾을 수 없습니다.");
            return;
        }

        const rows = XLSX.utils.sheet_to_json(worksheet);
        console.log(`'주문' 시트에서 ${rows.length}개의 데이터를 읽었습니다.`);

        // 1. 기존 배차 데이터 초기화
        console.log('NPS_t_balju 테이블 초기화 중...');
        await prisma.nPS_t_balju.deleteMany({});

        // 제품 정보 미리 로드
        const products = await prisma.nPS_t_product.findMany();
        const productMap = new Map();
        products.forEach(p => {
            productMap.set(String(p.P_CODE), p);
            if (p.P_BARCODE) productMap.set(String(p.P_BARCODE), p);
        });

        const batchData = [];
        let skippedCount = 0;

        for (const row of rows) {
            const outDate = excelDateToISO(row['출고일자']);
            const custName = row['거래처'];
            const pCode = String(row['품목코드'] || '');
            const pName = row['품명'];
            const qty = parseInt(row['수량']) || 0;
            const driver = row['차량'];
            const barcode = String(row['바코드'] || '');

            if (!outDate || !custName || !pName) {
                skippedCount++;
                continue;
            }

            let kg = 0;
            const pInfo = productMap.get(pCode) || productMap.get(barcode);
            if (pInfo) {
                kg = Number(pInfo.P_KG || 0) * qty;
            }

            batchData.push({
                B_DATE: outDate,
                B_C_NAME: String(custName),
                B_C_NAME_ORI: String(custName),
                B_P_NO: pCode,
                B_P_NAME: String(pName),
                B_QTY: qty,
                B_KG: kg,
                CB_DRIVER: String(driver || ''),
                CB_DIV_CUST: String(row['품목군'] || '미분류'),
                B_DAN: parseInt(row['합계']) || 0,
                B_C_CODE: '',
                B_IN_CONFIRM: 'N',
                B_PICK_DONE: 'N',
                B_GUM_DONE: 'N'
            });
        }

        // 1000개씩 벌크 인서트
        const chunkSize = 1000;
        for (let i = 0; i < batchData.length; i += chunkSize) {
            const chunk = batchData.slice(i, i + chunkSize);
            await prisma.nPS_t_balju.createMany({
                data: chunk
            });
            console.log(`${i + chunk.length}건 처리 중...`);
        }

        console.log(`등록 완료: ${batchData.length}건 (누락: ${skippedCount}건)`);

    } catch (e) {
        console.error('Import Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

importOrders();
