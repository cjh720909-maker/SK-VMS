/**
 * Dispatch Status (Original MySQL Data) Logic
 */

async function fetchStatusData() {
    const sDate = document.getElementById('startDate').value;
    const eDate = document.getElementById('endDate').value;
    const searchVal = document.getElementById('searchInput').value;
    const custName = document.getElementById('custSelect').value;

    const tbody = document.getElementById('status-tableBody');
    const header = document.getElementById('status-header');

    if (!sDate || !eDate) return alert("날짜를 선택해주세요.");

    // Loading State
    tbody.innerHTML = '<tr><td colspan="50" class="p-12 text-center"><div class="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-2"></div><div class="text-indigo-600 font-bold">원본 데이터 조회 중...</div></td></tr>';

    try {
        const url = `/api/dispatch-status?startDate=${sDate}&endDate=${eDate}&search=${encodeURIComponent(searchVal)}&custName=${encodeURIComponent(custName)}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.error) {
            alert('데이터 에러: ' + json.error);
            tbody.innerHTML = '<tr><td colspan="50" class="p-8 text-center text-red-500">조회 실패</td></tr>';
            return;
        }

        window.appState.statusData = json.data;
        renderStatusData(json.data, tbody, header);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="50" class="p-8 text-center text-red-500">서버 통신 오류</td></tr>';
    }
}

function renderStatusData(data, tbody, header) {
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="50" class="p-8 text-center text-slate-400">데이터가 없습니다.</td></tr>';
        return;
    }

    // 1. Dynamic Header Generation (Exclude unwanted columns)
    const excludeCols = [
        'B_IDX', 'CB_IDX', 'CB_IDX_ORI', 'B_C_NAME_ORI',
        'B_C_PAN_NAME_ORI', 'B_C_PAN_NAME', 'B_NAP_DIV_ORI',
        'B_NAP_DIV', 'B_DAN', 'B_VAT_DIV', 'B_PKG', 'B_NAP_NO',
        'B_MEMO', 'B_EDT_E_NAME', 'C_NAME', 'B_EDT_DATETIME',
        'CB_NAME', 'CB_ADDRESS', 'CB_DIV_CUST',
        'CB_PHONE', 'CB_HP', 'CB_BIND', 'CB_CODE', 'O_IDX',
        'B_EX_SEQ', 'O_QTY', 'B_IN_CONFIRM', 'B_PICK_DONE',
        'B_GUM_DONE', 'B_GUM_DATE', 'B_GUM_E_NAME', 'B_QTY_DAS_STCOK'
    ];
    const columns = Object.keys(data[0]).filter(col => !excludeCols.includes(col));

    const getColWidth = (col) => {
        if (['B_KG', 'B_IN_QTY', 'B_QTY'].includes(col)) return 'w-[70px]';
        if (col === 'B_P_NAME') return 'w-[300px]'; // 50% 더 확대 (200px -> 300px)
        if (col === 'B_C_NAME') return 'w-[200px]';
        return 'w-[110px]';
    };

    header.innerHTML = `
        <div class="w-[50px] flex-shrink-0 text-center">No.</div>
        ${columns.map(col => `
            <div data-sort="${col}" onclick="handleSort('status', '${col}', 'string')"
                 class="${getColWidth(col)} flex-shrink-0 cursor-pointer hover:text-indigo-600 transition-colors truncate px-2">
                ${col}
            </div>
        `).join('')}
    `;

    // 2. Dynamic Body Generation
    tbody.innerHTML = data.map((row, i) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50 last:border-0 flex px-6">
            <td class="py-2.5 text-center text-slate-400 w-[50px] shrink-0 text-xs">${i + 1}</td>
            ${columns.map(col => {
        const isCust = col === 'B_C_NAME';
        const clickAttr = isCust ? `onclick="showDetails('${row.B_DATE}', '${row.B_C_NAME}')"` : '';
        const baseClass = `py-2.5 text-slate-600 ${getColWidth(col)} shrink-0 truncate px-2 text-xs border-r border-slate-50 last:border-0`;
        const interactiveClass = isCust ? 'cursor-pointer hover:text-indigo-600 hover:underline font-bold' : '';

        return `<td class="${baseClass} ${interactiveClass}" ${clickAttr}>
                    ${row[col] !== null ? row[col] : '-'}
                </td>`;
    }).join('')}
        </tr>
    `).join('');
}

async function showDetails(date, custName) {
    const modal = document.getElementById('detail-modal');
    const title = document.getElementById('modal-title');
    const tableBody = document.getElementById('modal-tableBody');

    title.innerText = `${custName} 상세 내역`;
    tableBody.innerHTML = '<tr><td colspan="2" class="p-8 text-center text-slate-400">품목 정보를 불러오는 중...</td></tr>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`/api/dispatch-status-details?date=${date}&custName=${encodeURIComponent(custName)}`);
        const json = await res.json();

        if (json.data && json.data.length > 0) {
            tableBody.innerHTML = json.data.map(item => `
                <tr class="hover:bg-indigo-50/50">
                    <td class="px-6 py-4 font-medium text-slate-700">${item.itemName}</td>
                    <td class="px-6 py-4 text-right font-bold text-indigo-600 tabular-nums">${formatNumber(item.qty)}</td>
                </tr>
            `).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="2" class="p-8 text-center text-slate-400">상세 정보가 없습니다.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="2" class="p-8 text-center text-red-500">데이터 로드 실패</td></tr>';
    }
}

function closeModal() {
    document.getElementById('detail-modal').classList.add('hidden');
}

// Close on backdrop click
document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') closeModal();
});
