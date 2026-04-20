// picking-pivot.js
// 품목별/차량별 가로 피벗 피킹 리스트 (두 번째 형식)

async function fetchPickingPivot() {
    const container = document.getElementById('picking-pivot-container');
    const startDate = document.getElementById('startDate').value;

    if (!startDate) return;

    container.innerHTML = '<div class="p-12 text-center text-slate-400"><div class="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div><br>피킹 현황(피벗)을 생성 중입니다...</div>';

    try {
        const query = `/api/picking-list?date=${startDate}`;
        const res = await fetch(query);
        const json = await res.json();
        const data = json.data;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="p-12 text-center text-slate-400 font-medium">해당 날짜에 데이터가 없습니다.</div>';
            return;
        }

        // 1. 유니크 리스트 추출 (제품 & 차량)
        const products = [...new Set(data.map(d => d.product_name))];
        const vehicles = [...new Set(data.map(d => d.driver_name))];

        // 2. 매트릭스 구성
        const matrix = {};
        const ipsuMap = {};
        const productTotal = {};

        data.forEach(d => {
            if (!matrix[d.product_name]) matrix[d.product_name] = {};
            matrix[d.product_name][d.driver_name] = (matrix[d.product_name][d.driver_name] || 0) + Number(d.total_qty);
            ipsuMap[d.product_name] = d.ipsu || 1;
            productTotal[d.product_name] = (productTotal[d.product_name] || 0) + Number(d.total_qty);
        });

        // 3. 테이블 빌드
        let html = `
            <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-slate-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th class="px-4 py-4 border-b border-r border-slate-200 font-bold text-slate-700 w-[250px] sticky left-0 bg-slate-100 z-20">제품명 \\ 차량명</th>
                        ${vehicles.map(v => `
                            <th class="px-4 py-4 border-b border-slate-200 font-bold text-slate-600 text-center min-w-[120px] whitespace-nowrap">${v || '미배차'}</th>
                        `).join('')}
                        <th class="px-4 py-4 border-b border-l border-slate-200 font-bold text-indigo-700 text-center min-w-[150px] bg-indigo-50 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">총합계</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
        `;

        products.forEach(p => {
            const ipsu = ipsuMap[p];
            const total = productTotal[p] || 0;
            const tBox = Math.floor(total / ipsu);
            const tItem = total % ipsu;

            html += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-4 border-r border-slate-100 font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        <div class="truncate max-w-[220px]" title="${p}">${p}</div>
                        <div class="text-[9px] text-slate-400 font-normal">입수: ${ipsu}</div>
                    </td>
                    ${vehicles.map(v => {
                const qty = matrix[p][v] || 0;
                if (qty === 0) return '<td class="px-4 py-4 text-center text-slate-100">-</td>';

                const box = Math.floor(qty / ipsu);
                const item = qty % ipsu;

                return `
                            <td class="px-4 py-4 text-center border-r border-slate-50">
                                <div class="font-bold text-slate-700 text-[13px]">${qty.toLocaleString()}</div>
                                <div class="text-[9px] mt-1 text-slate-400">
                                    <span class="text-indigo-600 font-bold">${box}박스</span> / <span class="text-amber-600 font-bold">${item}개</span>
                                </div>
                            </td>
                        `;
            }).join('')}
                    <td class="px-4 py-4 border-l border-indigo-50 text-center bg-indigo-50/20">
                        <div class="font-bold text-indigo-700 text-[15px]">${total.toLocaleString()}</div>
                        <div class="text-[10px] font-bold text-slate-500 mt-1">
                             ${tBox}박스 ${tItem}개
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="p-12 text-center text-red-500 bg-red-50 rounded-xl m-4 border border-red-100">
            데이터 로드 중 오류가 발생했습니다.<br><span class="text-xs font-mono">${e.message}</span>
        </div>`;
    }
}
