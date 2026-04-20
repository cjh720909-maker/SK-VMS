// product.js
// 제품 정보 관리 특화 로직

async function fetchProductData() {
    const tableBody = document.getElementById('product-tableBody');
    const search = document.getElementById('productSearchInput').value;

    tableBody.innerHTML = '<tr><td colspan="15" class="p-8 text-center text-slate-400">데이터를 불러오는 중...</td></tr>';

    try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(search)}`);
        const result = await res.json();
        const data = result.data;

        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="15" class="p-8 text-center text-slate-400">검색 결과가 없습니다.</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        data.forEach((row, index) => {
            const div = document.createElement('div');
            div.className = 'flex px-6 py-2 border-b border-gray-100 hover:bg-indigo-50 transition-colors text-[11px] items-center text-slate-600 cursor-default';
            div.innerHTML = `
                <div class="w-[50px] flex-shrink-0 font-medium text-slate-400">${index + 1}</div>
                <div onclick="openProductModal(${JSON.stringify(row).replace(/"/g, '&quot;')})" 
                     class="w-[120px] flex-shrink-0 font-bold text-indigo-600 truncate pr-2 cursor-pointer hover:underline">${row.P_CODE || '-'}</div>
                <div class="w-[120px] flex-shrink-0 text-slate-500 truncate pr-2 font-mono">${row.P_BARCODE || '-'}</div>
                <div class="w-[200px] flex-shrink-0 font-medium text-slate-800 truncate pr-2">${row.P_NAME || '-'}</div>
                <div class="w-[100px] flex-shrink-0 text-center"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px]">${row.P_GROUP || '미분류'}</span></div>
                <div class="w-[80px] flex-shrink-0 text-right pr-4 font-mono font-bold">${Number(row.P_KG || 0).toFixed(2)}</div>
                <div class="w-[100px] flex-shrink-0 text-center text-slate-500">${row.P_KIHAN || '-'}</div>
                <div class="w-[100px] flex-shrink-0 text-center text-slate-500">${row.P_PIBOX || '-'}</div>
                <div class="w-[100px] flex-shrink-0 text-center text-indigo-400 font-medium">${row.P_BOX_TYPE || '-'}</div>
                <div class="w-[80px] flex-shrink-0 text-right pr-4 font-bold text-slate-700 font-mono">${row.P_IPSU || 1}</div>
                <div class="w-[80px] flex-shrink-0 text-center"><span class="${row.P_IS_FREZ === 'Y' ? 'text-blue-500 border-blue-200 bg-blue-50' : 'text-orange-500 border-orange-200 bg-orange-50'} border px-1.5 py-0.5 rounded text-[9px] font-bold">${row.P_DIV_STOCK || '-'}</span></div>
                <div class="w-[120px] flex-shrink-0 text-center truncate px-1 text-slate-400">${row.P_MAKER || '-'}</div>
                <div class="w-[70px] flex-shrink-0 text-center font-bold ${row.P_IS_VAT === '0' ? 'text-green-600' : 'text-slate-400'}">${row.P_IS_VAT === '0' ? '면세' : '과세'}</div>
                <div class="w-[100px] flex-shrink-0 text-right pr-4 text-indigo-600 font-bold font-mono">${Number(row.P_DAN || 0).toLocaleString()}</div>
                <div class="w-[100px] flex-shrink-0 text-right pr-4 text-emerald-600 font-bold font-mono bg-emerald-50/50 h-full flex items-center justify-end">${Number(row.P_SUP_PRICE || 0).toLocaleString()}</div>
<!--                <div class="w-[70px] flex-shrink-0 text-right pr-2 text-emerald-500 font-medium font-mono">${Number(row.P_SUP_RATE || 0).toFixed(1)}%</div> -->
                <div class="flex-grow text-xs text-slate-400 truncate text-left pl-4 border-l border-slate-50">${row.P_MEMO || ''}</div>
            `;
            tableBody.appendChild(div);
        });

    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="15" class="p-8 text-center text-red-400">오류가 발생했습니다: ' + e.message + '</td></tr>';
    }
}

function openProductModal(prod = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    const title = document.getElementById('product-modal-title');

    form.reset();
    document.getElementById('prod_idx').value = '';

    if (prod) {
        title.innerText = '제품 정보 수정';
        document.getElementById('prod_idx').value = prod.P_IDX;
        document.getElementById('prod_code').value = prod.P_CODE || '';
        document.getElementById('prod_barcode').value = prod.P_BARCODE || '';
        document.getElementById('prod_name').value = prod.P_NAME || '';
        document.getElementById('prod_group').value = prod.P_GROUP || '';
        document.getElementById('prod_maker').value = prod.P_MAKER || '';
        document.getElementById('prod_kg').value = prod.P_KG || 0;
        document.getElementById('prod_ipsu').value = prod.P_IPSU || 1;
        document.getElementById('prod_pibox').value = prod.P_PIBOX || 0;
        document.getElementById('prod_box_type').value = prod.P_BOX_TYPE || '';
        document.getElementById('prod_dan').value = prod.P_DAN || 0;
        document.getElementById('prod_sup_price').value = prod.P_SUP_PRICE || 0;
        document.getElementById('prod_memo').value = prod.P_MEMO || '';
    } else {
        title.innerText = '새 제품 등록';
    }

    modal.classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

async function saveProduct(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert('저장되었습니다.');
            closeProductModal();
            fetchProductData();
        } else {
            alert('오류: ' + result.error);
        }
    } catch (e) {
        alert('저장 중 오류 발생: ' + e.message);
    }
}

async function uploadProductExcel(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    if (!confirm('제품 마스터 정보를 엑셀로 업로드하시겠습니까?\n기존 제품 정보가 초기화되고 새로 업로드됩니다.')) {
        input.value = '';
        return;
    }

    try {
        const res = await fetch('/api/products-upload', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();
        if (result.success) {
            alert(`${result.count}건의 제품 정보가 성공적으로 업로드되었습니다.`);
            fetchProductData();
        } else {
            alert('업로드 실패: ' + result.error);
        }
    } catch (e) {
        alert('업로드 중 오류 발생: ' + e.message);
    } finally {
        input.value = '';
    }
}
