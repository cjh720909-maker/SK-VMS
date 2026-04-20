// weight.js
// 중량 조회 로직

let lastWeightData = [];
let weightSortOrder = {
    col: 'B_DATE',
    asc: false
};

async function fetchWeightSummary() {
    const tableBody = document.getElementById('weight-list-tableBody');
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const search = document.getElementById('custSelect').value;

    if (!startDate || !endDate) {
        tableBody.innerHTML = '<div class="p-8 text-center text-slate-400">날짜를 설정하여 조회해주세요.</div>';
        return;
    }

    tableBody.innerHTML = '<div class="p-8 text-center text-slate-400">데이터를 불러오는 중...</div>';

    try {
        const query = `/api/weight-summary?startDate=${startDate}&endDate=${endDate}&search=${encodeURIComponent(search)}`;
        const res = await fetch(query);
        const result = await res.json();

        lastWeightData = result.data || [];

        if (lastWeightData.length === 0) {
            tableBody.innerHTML = '<div class="p-8 text-center text-slate-400">조회된 중량 데이터가 없습니다.</div>';
            return;
        }

        renderWeightTable();

    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<div class="p-8 text-center text-red-400">오류 발생: ' + e.message + '</div>';
    }
}

function renderWeightTable() {
    const tableBody = document.getElementById('weight-list-tableBody');
    tableBody.innerHTML = '';

    const selectedDay = document.getElementById('daySelect').value;

    // 요일 필터링 및 정렬 적용
    let displayData = [...lastWeightData];

    if (selectedDay !== "") {
        displayData = displayData.filter(row => {
            const dateObj = new Date(row.B_DATE);
            return dateObj.getDay().toString() === selectedDay;
        });
    }

    const sorted = displayData.sort((a, b) => {
        let valA = a[weightSortOrder.col];
        let valB = b[weightSortOrder.col];

        if (typeof valA === 'string') {
            return weightSortOrder.asc
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        } else {
            return weightSortOrder.asc ? valA - valB : valB - valA;
        }
    });

    let grandItemCount = 0;
    let grandTotalQty = 0;
    let grandTotalWeight = 0;

    sorted.forEach((row, index) => {
        const div = document.createElement('div');
        div.className = 'flex px-6 py-3 border-b border-gray-100 hover:bg-indigo-50 transition-colors text-sm items-center text-slate-600';

        const itemCount = Number(row.item_count || 0);
        const totalQty = Number(row.total_qty || 0);
        const totalWeight = Number(row.total_weight || 0);

        grandItemCount += itemCount;
        grandTotalQty += totalQty;
        grandTotalWeight += totalWeight;

        const dateObj = new Date(row.B_DATE);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayLabel = days[dateObj.getDay()];

        div.innerHTML = `
            <div class="w-[50px] flex-shrink-0 font-medium text-slate-400">${index + 1}</div>
            <div class="w-[125px] flex-shrink-0 text-center font-mono text-slate-500">${row.B_DATE} (${dayLabel})</div>
            <div class="w-[200px] flex-shrink-0 font-bold text-slate-800 truncate pr-4">${row.B_C_NAME}</div>
            <div class="w-[100px] flex-shrink-0 text-right pr-4 font-bold text-slate-500">${itemCount.toLocaleString()}</div>
            <div class="w-[100px] flex-shrink-0 text-right pr-4 font-mono font-medium text-slate-600">${totalQty.toLocaleString()}</div>
            <div class="flex-grow text-right text-indigo-600 font-bold pr-12 font-mono text-lg">${totalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</div>
        `;
        tableBody.appendChild(div);
    });

    // 합계 행 추가
    const totalDiv = document.createElement('div');
    totalDiv.className = 'flex px-6 py-4 bg-indigo-50 border-t-2 border-indigo-200 sticky bottom-0 font-bold text-indigo-900 items-center';
    totalDiv.innerHTML = `
        <div class="w-[50px] flex-shrink-0">합계</div>
        <div class="w-[100px] flex-shrink-0"></div>
        <div class="w-[200px] flex-shrink-0 text-center">전체 내역 합계</div>
        <div class="w-[100px] flex-shrink-0 text-right pr-4 text-slate-700">${grandItemCount.toLocaleString()}</div>
        <div class="w-[100px] flex-shrink-0 text-right pr-4 text-slate-700">${grandTotalQty.toLocaleString()}</div>
        <div class="flex-grow text-right pr-12 text-xl text-indigo-700">${grandTotalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</div>
    `;
    tableBody.appendChild(totalDiv);

    // 아이콘 업데이트
    updateSortIcons();
}

function sortWeightTable(col) {
    if (weightSortOrder.col === col) {
        weightSortOrder.asc = !weightSortOrder.asc;
    } else {
        weightSortOrder.col = col;
        weightSortOrder.asc = true;
    }
    renderWeightTable();
}

function updateSortIcons() {
    const cols = ['B_DATE', 'B_C_NAME'];
    cols.forEach(c => {
        const iconEl = document.getElementById(`sort-icon-${c}`);
        if (!iconEl) return;

        if (weightSortOrder.col === c) {
            iconEl.innerHTML = weightSortOrder.asc ? '▴' : '▾';
            iconEl.className = 'text-[10px] text-indigo-500 ml-1';
        } else {
            iconEl.innerHTML = '▵';
            iconEl.className = 'text-[10px] text-slate-300 ml-1';
        }
    });
}
