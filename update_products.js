const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

async function updateProducts() {
    try {
        const workbook = XLSX.readFile('정보.xlsx');
        // '제품업' 시트 우선 찾기, 없으면 첫 번째 시트
        let sheetName = workbook.SheetNames.find(n => n === '제품업') || workbook.SheetNames[0];
        console.log(`선택된 시트: ${sheetName}`);

        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        console.log(`엑셀에서 ${rows.length}개의 데이터를 읽었습니다.`);

        let successCount = 0;
        let updateCount = 0;

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
            const ipsu = parseInt(row['박스\r\n입수량']) || 1;
            const temp = row['품온'] || '상온';
            const maker = row['생산처'];
            const vat = row['면/과세'] === '면세' ? '0' : '1';
            const price = parseInt(row['정상\r\n판매가']) || 0;
            const memo = `${row['비고'] || ''} ${row['박스\r\nType'] || ''}`.trim();

            const isFrez = (temp === '냉동') ? 'Y' : 'N';

            const data = {
                P_NAME: name,
                P_BARCODE: barcode,
                P_KG: weight,
                P_KIHAN: kihan,
                P_PIBOX: pibox,
                P_IPSU: ipsu,
                P_DIV_STOCK: temp,
                P_IS_FREZ: isFrez,
                P_MAKER: maker,
                P_IS_VAT: vat,
                P_DAN: price,
                P_MEMO: memo
            };

            await prisma.nPS_t_product.upsert({
                where: {
                    P_CODE_P_GROUP: {
                        P_CODE: finalCode,
                        P_GROUP: category
                    }
                },
                update: data,
                create: {
                    ...data,
                    P_CODE: finalCode,
                    P_GROUP: category,
                    P_DIV_PICK: category,
                    P_DIV_BAS: category
                }
            });
            successCount++;
        }

        console.log(`업데이트 완료: 총 ${successCount}건 처리됨.`);

    } catch (e) {
        console.error('Update Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

updateProducts();
