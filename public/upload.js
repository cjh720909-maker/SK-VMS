// upload.js
// 주문 정보 엑셀 업로드 로직

async function uploadExcel() {
    const fileInput = document.getElementById('excelFileInput');
    const statusText = document.getElementById('uploadStatusText');
    const uploadBtn = document.getElementById('uploadBtn');

    if (!fileInput.files || fileInput.files.length === 0) {
        alert('파일을 선택해주세요.');
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    statusText.innerText = '업로드 중... (서버에서 주문 시트를 처리하고 있습니다)';
    statusText.className = 'mt-4 text-sm text-indigo-600 animate-pulse';
    uploadBtn.disabled = true;

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        if (result.success) {
            statusText.innerText = `성공: 총 ${result.count}건의 주문 데이터가 등록되었습니다.`;
            statusText.className = 'mt-4 text-sm text-green-600 font-bold';
            // integrated detail refresh
            if (typeof fetchOrderList === 'function') fetchOrderList();
        } else {
            throw new Error(result.error || '업로드 실패');
        }
    } catch (e) {
        console.error(e);
        statusText.innerText = '실패: ' + e.message;
        statusText.className = 'mt-4 text-sm text-red-600 font-bold';
    } finally {
        uploadBtn.disabled = false;
        fileInput.value = ''; // 초기화
    }
}

// 파일 선택 시 이름 표시
document.getElementById('excelFileInput').addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name || '파일 선택하기';
    document.getElementById('fileNameDisplay').innerText = fileName;
});
