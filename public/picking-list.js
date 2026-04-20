// picking-list.js
// 품목별 피킹 리스트 (품목별 그룹화 및 하위 거래처 상세 수직 배열 레이아웃)

async function fetchPickingList() {
    const container = document.getElementById('picking-list-container');
    const startDate = document.getElementById('startDate').value;

    if (!startDate) return;

    container.innerHTML = '<div class="p-12 text-center text-slate-400"><div class="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div><br>피킹 리스트를 생성 중입니다...</div>';

    try {
        const query = `/api/picking-list?date=${startDate}`;
        const res = await fetch(query);
        const json = await res.json();
        const data = json.data;

        if (!json.data || json.data.length === 0) {
            container.innerHTML = '<div class="p-12 text-center text-slate-400 font-medium">해당 날짜에 주문 데이터가 없습니다.</div>';
            return;
        }

        // 1. 품목별로 데이터 그룹화
        const groups = {};
        json.data.forEach(item => {
            if (!groups[item.product_name]) {
                groups[item.product_name] = {
                    name: item.product_name,
                    code: item.product_code,
                    ipsu: item.ipsu || 1,
                    totalQty: 0,
                    totalWeight: 0,
                    customers: []
                };
            }
            groups[item.product_name].totalQty += Number(item.total_qty || 0);
            groups[item.product_name].totalWeight += Number(item.total_weight || 0);
            groups[item.product_name].customers.push(item);
        });

        // 2. HTML 빌드
        let html = `<div class="p-4 space-y-6 bg-slate-50">`;

        Object.values(groups).forEach(p => {
            const tBox = Math.floor(p.totalQty / p.ipsu);
            const tItem = p.totalQty % p.ipsu;

            html += `
                <div class="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    <!-- Product Header Section (전체 피킹 정보) -->
                    <div class="bg-slate-800 px-6 py-5 flex flex-wrap justify-between items-center text-white gap-4">
                        <div class="flex-grow">
                            <div class="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mb-1">Pick Item Name</div>
                            <div class="text-xl font-black tracking-tight truncate max-w-2xl">${p.name}</div>
                        </div>
                        <div class="flex items-center gap-8 pr-2">
                             <div class="text-right">
                                <div class="text-[10px] text-slate-400 font-bold mb-1 uppercase">Ipsu</div>
                                <div class="text-lg font-bold text-slate-200">${p.ipsu}</div>
                            </div>
                            <div class="text-right px-6 border-l border-slate-700">
                                <div class="text-[10px] text-indigo-400 font-bold mb-1 uppercase">Total Quantity</div>
                                <div class="flex items-baseline gap-2">
                                    <span class="text-3xl font-black text-indigo-400">${p.totalQty.toLocaleString()}</span>
                                    <span class="text-md font-bold text-slate-100 flex gap-2">
                                        <span class="px-2 py-0.5 bg-indigo-600 rounded text-xs">${tBox}박스</span>
                                        <span class="px-2 py-0.5 bg-amber-600 rounded text-xs">${tItem}개</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Customer Detail Table Section (거래처별 상세 분산) -->
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-[12px]">
                            <thead class="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                                <tr>
                                    <th class="px-6 py-3 w-[280px]">거래처명</th>
                                    <th class="px-6 py-3 w-[150px]">배차(기사)</th>
                                    <th class="px-6 py-3 text-right w-[100px]">수량</th>
                                    <th class="px-6 py-3 text-center w-[180px]">박스/낱개</th>
                                    <th class="px-6 py-3 text-right pr-12">중량</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
            `;

            p.customers.forEach(c => {
                const box = Math.floor(c.total_qty / p.ipsu);
                const item = c.total_qty % p.ipsu;

                html += `
                    <tr class="hover:bg-indigo-50/50 transition-colors">
                        <td class="px-6 py-3.5 font-bold text-slate-800 border-l-4 border-transparent hover:border-indigo-400 transition-all">${c.customer_name}</td>
                        <td class="px-6 py-3.5 text-slate-500">
                            <span class="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600 font-bold">${c.driver_name || '-'}</span>
                        </td>
                        <td class="px-6 py-3.5 text-right font-black text-slate-700">${c.total_qty.toLocaleString()}</td>
                        <td class="px-6 py-3.5">
                            <div class="flex justify-center gap-2">
                                <div class="flex items-center gap-1">
                                    <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
                                    <span class="font-bold text-indigo-600">${box} 박스</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                                    <span class="font-bold text-amber-600">${item} 개</span>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-3.5 text-right pr-12 font-mono text-indigo-600 font-bold">
                            ${Number(c.total_weight || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                    <!-- Sub Footer for Product -->
                    <div class="bg-slate-50 px-6 py-2 text-right border-t border-slate-100">
                        <span class="text-[10px] text-slate-400 font-bold mr-4 italic">Weighted Sum for ${p.name}:</span>
                        <span class="text-xs font-bold text-slate-500">${Number(p.totalWeight || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</span>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="p-12 text-center text-red-500 bg-red-50 rounded-xl m-4 border border-red-100">
            <svg class="w-8 h-8 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            리스트 생성 중 오류가 발생했습니다.<br><span class="text-xs font-mono">${e.message}</span>
        </div>`;
    }
}
