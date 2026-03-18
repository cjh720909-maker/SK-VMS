const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, 'data');

console.log('📌 데이터 사전 백업 상태 점검');

if (!fs.existsSync(backupDir)) {
    console.log('❌ data/ 폴더가 존재하지 않습니다. 먼저 migrate_to_schema.js를 실행하여 백업을 생성하세요.');
    process.exit(1);
}

const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
    console.log('❌ 백업된 JSON 파일이 없습니다.');
} else {
    for (const file of files) {
        const filePath = path.join(backupDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`✅ [${file}]: ${data.length} 건 백업 존재`);
    }
}
