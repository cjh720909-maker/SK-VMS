// list.js
// 주문 내역 상세 조회 로직

let currentTotalAmount = 0;
let currentTotalWeight = 0;

async function fetchOrderList() {
    const tableBody = document.getElementById('order-list-tableBody');
    const summaryCards = document.getElementById('order-list-summaryCards');
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const search = document.getElementById('searchInput').value;

    if (!startDate || !endDate) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400">데이터를 불러오는 중...</td></tr>';

    try {
        const query = `/api/orders?startDate=${startDate}&endDate=${endDate}&search=${encodeURIComponent(search)}`;
        const res = await fetch(query);
        const result = await res.json();
        const data = result.data;

        // Try to find both possible table bodies
        const tableOrder = document.getElementById('order-list-tableBody');
        const tableUpload = document.getElementById('upload-detail-tableBody');

        if (!data || data.length === 0) {
            const noDataMsg = '<tr><td colspan="13" class="p-8 text-center text-slate-400">등록된 주문 데이터가 없습니다. (업로드 메뉴에서 엑셀을 업로드해주세요)</td></tr>';
            if (tableOrder) tableOrder.innerHTML = noDataMsg;
            if (tableUpload) tableUpload.innerHTML = noDataMsg;
            summaryCards.innerHTML = '';
            return;
        }

        // 요약 정보 계산
        const totalQty = data.reduce((acc, cur) => acc + (cur.B_QTY || 0), 0);
        const totalWeight = data.reduce((acc, cur) => acc + Number(cur.B_KG || 0), 0);
        const totalAmount = data.reduce((acc, cur) => acc + Number(cur.B_DAN || 0), 0);
        const uniqueCustomers = new Set(data.map(d => d.B_C_NAME)).size;

        currentTotalAmount = totalAmount;
        currentTotalWeight = totalWeight;

        summaryCards.innerHTML = `
            <div class="flex w-full items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                <div class="flex items-center gap-2 flex-shrink-0">
                    <div class="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 text-[11px] font-bold whitespace-nowrap">주문: ${data.length.toLocaleString()}건</div>
                    <div class="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-slate-700 text-[11px] font-bold whitespace-nowrap">수량: ${totalQty.toLocaleString()}</div>
                    <div class="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-indigo-600 text-[11px] font-bold underline decoration-dotted whitespace-nowrap">중량: ${totalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}kg</div>
                    <div class="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-slate-700 text-[11px] font-bold whitespace-nowrap">거래처: ${uniqueCustomers}곳</div>
                </div>

                <!-- 물류비 계산 섹션 -->
                <div class="flex items-center gap-3 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 flex-shrink-0">
                    <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-bold text-slate-400 whitespace-nowrap">물류비(%)</span>
                        <select id="logisRate" class="text-[10px] border rounded px-1 py-0.5 bg-white outline-none" onchange="calculateLogis()">
                            <option value="0">선택</option>
                            <option value="0.08">8%</option>
                            <option value="0.09">9%</option>
                            <option value="0.10">10%</option>
                            <option value="0.11">11%</option>
                            <option value="0.12">12%</option>
                            <option value="0.13">13%</option>
                            <option value="0.14">14%</option>
                            <option value="0.15">15%</option>
                        </select>
                        <input type="number" id="logisRateInput" placeholder="%" class="w-10 text-[10px] border rounded px-1 py-0.5 bg-white outline-none" oninput="calculateLogis()">
                        <span id="logisResultRate" class="text-[11px] font-bold text-indigo-600 min-w-[70px] text-right">0원</span>
                    </div>

                    <div class="w-px h-3 bg-slate-300"></div>

                    <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-bold text-slate-400 whitespace-nowrap">물류비(kg단가)</span>
                        <input type="number" id="logisWeightPrice" placeholder="원/kg" class="w-14 text-[10px] border rounded px-1 py-0.5 bg-white outline-none" oninput="calculateLogis()">
                        <span id="logisResultWeight" class="text-[11px] font-bold text-emerald-600 min-w-[70px] text-right">0원</span>
                    </div>
                </div>

                <div class="px-3 py-1 bg-emerald-600 border border-emerald-700 rounded text-white text-xs font-bold shadow-sm whitespace-nowrap flex-shrink-0">총 합계: ${totalAmount.toLocaleString()}원</div>
            </div>
        `;

        const renderRows = (tbody) => {
            if (!tbody) return;
            tbody.innerHTML = '';
            data.forEach(row => {
                const div = document.createElement('div');
                div.className = 'flex px-6 py-2 border-b border-gray-100 hover:bg-indigo-50 transition-colors text-[11px] items-center text-slate-600';
                div.innerHTML = `
                    <div class="w-[50px] flex-shrink-0 font-medium text-slate-400">${row.B_EX_SEQ || '-'}</div>
                    <div class="w-[90px] flex-shrink-0 text-slate-500 font-mono">${row.B_ORDER_DATE || '-'}</div>
                    <div class="w-[90px] flex-shrink-0 text-slate-500 font-mono">${row.B_DATE || '-'}</div>
                    <div class="w-[110px] flex-shrink-0 text-slate-500 font-mono truncate pr-2">${row.B_BARCODE || '-'}</div>
                    <div class="w-[80px] flex-shrink-0 text-slate-500 truncate pr-2">${row.B_P_NO || '-'}</div>
                    <div class="w-[180px] flex-shrink-0 font-bold text-slate-700 truncate pr-2">${row.B_P_NAME || '-'}</div>
                    <div class="w-[80px] flex-shrink-0 text-center"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px]">${row.CB_DIV_CUST || ''}</span></div>
                    <div class="w-[70px] flex-shrink-0 text-center"><span class="px-1.5 py-0.5 border border-amber-200 bg-amber-50 text-amber-600 rounded text-[9px] font-bold">${row.B_STATE || '-'}</span></div>
                    <div class="w-[100px] flex-shrink-0 text-center truncate px-1">${row.B_MAKER || '-'}</div>
                    <div class="w-[60px] flex-shrink-0 text-right font-bold text-slate-700 pr-4">${(row.B_QTY || 0).toLocaleString()}</div>
                    <div class="w-[50px] flex-shrink-0 text-right pr-2 text-slate-400">${(row.P_IPSU || 1).toLocaleString()}</div>
                    <div class="w-[50px] flex-shrink-0 text-right pr-2 font-bold text-indigo-600">${Math.floor((row.B_QTY || 0) / (row.P_IPSU || 1))}</div>
                    <div class="w-[50px] flex-shrink-0 text-right pr-2 text-amber-600">${(row.B_QTY || 0) % (row.P_IPSU || 1)}</div>
                    <div class="w-[90px] flex-shrink-0 text-right pr-4 font-mono text-slate-400">${(row.B_DAN || 0).toLocaleString()}</div>
                    <div class="w-[100px] flex-shrink-0 text-right pr-4 font-mono font-bold text-indigo-600 border-r border-indigo-50 h-full flex items-center justify-end">${Number(row.B_KG || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                    <div class="w-[150px] flex-shrink-0 text-slate-600 truncate pl-4">${row.B_C_NAME || '-'}</div>
                    <div class="flex-grow text-center"><span class="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] text-slate-600 font-bold">${row.CB_DRIVER || '-'}</span></div>
                `;
                tbody.appendChild(div);
            });
        };

        renderRows(tableOrder);
        renderRows(tableUpload);

    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-red-400">오류 발생: ' + e.message + '</td></tr>';
    }
}

function calculateLogis() {
    const rateSelect = document.getElementById('logisRate');
    const rateInput = document.getElementById('logisRateInput');
    const weightPriceInput = document.getElementById('logisWeightPrice');

    // 1. 퍼센트 계산
    let rate = parseFloat(rateSelect.value) || 0;
    if (rateInput.value && rateInput.value !== '') {
        rate = parseFloat(rateInput.value) / 100;
    }
    const resultRate = Math.round(currentTotalAmount * rate);
    document.getElementById('logisResultRate').innerText = resultRate.toLocaleString() + '원';

    // 2. 중량 단가 계산
    const weightPrice = parseFloat(weightPriceInput.value) || 0;
    const resultWeight = Math.round(currentTotalWeight * weightPrice);
    document.getElementById('logisResultWeight').innerText = resultWeight.toLocaleString() + '원';
}
