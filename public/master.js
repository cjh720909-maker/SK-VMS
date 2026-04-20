// master.js
// 거래처 및 차량 마스터 관리 로직

// --- 차량 관리 ---
async function fetchCars() {
    const tableBody = document.getElementById('vehicle-tableBody');
    tableBody.innerHTML = '<div class="p-8 text-center text-slate-400">데이터를 불러오는 중...</div>';

    try {
        const res = await fetch('/api/cars');
        const result = await res.json();
        const data = result.data;

        if (!data || data.length === 0) {
            tableBody.innerHTML = '<div class="p-8 text-center text-slate-400">등록된 차량이 없습니다.</div>';
            return;
        }

        tableBody.innerHTML = '';
        data.forEach(row => {
            const div = document.createElement('div');
            div.className = 'flex px-6 py-3 border-b border-gray-100 hover:bg-emerald-50 transition-colors text-sm items-center';
            div.innerHTML = `
                <div class="w-[120px] flex-shrink-0 font-bold text-emerald-700 truncate pr-2">${row.CB_DRIVER || '-'}</div>
                <div class="w-[100px] flex-shrink-0 font-medium text-slate-700 truncate pr-2">${row.CA_NAME || '-'}</div>
                <div class="w-[120px] flex-shrink-0 text-slate-500 truncate pr-2">${row.CA_NO || '-'}</div>
                <div class="w-[80px] flex-shrink-0 text-right pr-4 font-bold text-slate-600">${Number(row.CA_KG || 0).toFixed(1)}t</div>
                <div class="w-[80px] flex-shrink-0 text-center"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px]">${row.CA_DOCKNO || '-'}</span></div>
                <div class="flex-grow text-xs text-slate-400 truncate text-center">${row.CA_MEMO || ''}</div>
            `;
            tableBody.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<div class="p-8 text-center text-red-500">오류 발생: ' + e.message + '</div>';
    }
}

async function saveCar() {
    const driver = document.getElementById('car_driver').value;
    const name = document.getElementById('car_name').value;
    const no = document.getElementById('car_no').value;
    const kg = document.getElementById('car_kg').value;
    const dock = document.getElementById('car_dock').value;

    if (!driver) return alert('배차명(ID)을 입력해주세요.');

    try {
        const res = await fetch('/api/cars', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                CB_DRIVER: driver,
                CA_NAME: name,
                CA_NO: no,
                CA_KG: Number(kg || 0),
                CA_DOCKNO: dock
            })
        });
        const result = await res.json();
        if (result.success) {
            alert('차량이 등록되었습니다.');
            // 폼 초기화
            ['car_driver', 'car_name', 'car_no', 'car_kg', 'car_dock'].forEach(id => document.getElementById(id).value = '');
            fetchCars();
        } else {
            alert('등록 실패: ' + result.error);
        }
    } catch (e) {
        alert('통신 오류: ' + e.message);
    }
}

// --- 거래처 관리 ---
async function fetchCustomerMaster() {
    const tableBody = document.getElementById('customer-master-tableBody');
    tableBody.innerHTML = '<div class="p-8 text-center text-slate-400">데이터를 불러오는 중...</div>';

    try {
        const res = await fetch('/api/customers-master');
        const result = await res.json();
        const data = result.data;

        if (!data || data.length === 0) {
            tableBody.innerHTML = '<div class="p-8 text-center text-slate-400">등록된 거래처가 없습니다.</div>';
            return;
        }

        tableBody.innerHTML = '';
        data.forEach(row => {
            const div = document.createElement('div');
            div.className = 'flex px-6 py-3 border-b border-gray-100 hover:bg-indigo-50 transition-colors text-sm items-center';
            div.innerHTML = `
                <div class="w-[100px] flex-shrink-0 font-medium text-slate-400 truncate pr-2">${row.C_CODE || '-'}</div>
                <div class="w-[200px] flex-shrink-0 font-bold text-indigo-700 truncate pr-2">${row.C_NAME || '-'}</div>
                <div class="w-[120px] flex-shrink-0 text-slate-700 truncate pr-2">${row.C_CEO || '-'}</div>
                <div class="w-[150px] flex-shrink-0 text-slate-500 truncate pr-2">${row.C_TEL || '-'}</div>
                <div class="flex-grow text-xs text-slate-500 truncate">${row.C_ADDRESS || ''}</div>
            `;
            tableBody.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<div class="p-8 text-center text-red-500">오류 발생: ' + e.message + '</div>';
    }
}

async function saveCustomerMaster() {
    const name = document.getElementById('custMaster_name').value;
    const code = document.getElementById('custMaster_code').value;
    const tel = document.getElementById('custMaster_tel').value;
    const address = document.getElementById('custMaster_address').value;

    if (!name) return alert('거래처명을 입력해주세요.');

    try {
        const res = await fetch('/api/customers-master', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                C_NAME: name,
                C_CODE: code,
                C_TEL: tel,
                C_ADDRESS: address
            })
        });
        const result = await res.json();
        if (result.success) {
            alert('거래처가 등록되었습니다.');
            // 폼 초기화
            ['custMaster_name', 'custMaster_code', 'custMaster_tel', 'custMaster_address'].forEach(id => document.getElementById(id).value = '');
            fetchCustomerMaster();
        } else {
            alert('등록 실패: ' + result.error);
        }
    } catch (e) {
        alert('통신 오류: ' + e.message);
    }
}
