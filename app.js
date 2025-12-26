// --- FRUTIX APP LOGIC (STABILIZED + DELETION) ---

// 1. STATE MANAGEMENT
let products = JSON.parse(localStorage.getItem('products')) || [];
let movements = JSON.parse(localStorage.getItem('movements')) || [];
let bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 45.00;
let theme = localStorage.getItem('theme') || 'dark';
let debts = JSON.parse(localStorage.getItem('debts')) || [];
let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];

function saveData() {
    localStorage.setItem('products', JSON.stringify(products));
    localStorage.setItem('movements', JSON.stringify(movements));
    localStorage.setItem('debts', JSON.stringify(debts));
    localStorage.setItem('suppliers', JSON.stringify(suppliers));
    localStorage.setItem('bcvRate', bcvRate);
    localStorage.setItem('theme', theme);
}

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    try {
        initApp();
    } catch (err) {
        console.error("Critical Init Error:", err);
    }
});

function initApp() {
    const bcvInput = document.getElementById('bcv-rate');
    if (bcvInput) bcvInput.value = bcvRate;

    applyTheme(theme);
    renderAll();
    setupNavigation();
    setupThemeToggle();
    setupEventListeners();
}

function setupEventListeners() {
    const bcvInput = document.getElementById('bcv-rate');
    if (bcvInput) bcvInput.addEventListener('change', (e) => { bcvRate = parseFloat(e.target.value) || 0; saveData(); renderAll(); });

    const searchInput = document.getElementById('files-search');
    if (searchInput) searchInput.addEventListener('input', (e) => renderInventory(e.target.value));

    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) addProductForm.addEventListener('submit', handleAddProduct);

    const addMovementForm = document.getElementById('add-movement-form');
    if (addMovementForm) {
        addMovementForm.addEventListener('submit', handleAddMovement);
        const mQty = addMovementForm.querySelector('input[name="quantity"]');
        const mType = document.getElementById('movement-type');
        const mProd = document.getElementById('movement-product-select');
        if (mQty) mQty.addEventListener('input', updateMovementInfo);
        if (mType) mType.addEventListener('change', updateMovementInfo);
        if (mProd) mProd.addEventListener('change', updateMovementInfo);
    }

    const addSupplierForm = document.getElementById('add-supplier-form');
    if (addSupplierForm) addSupplierForm.addEventListener('submit', handleAddSupplier);

    const mPayMethod = document.getElementById('movement-payment-method');
    if (mPayMethod) mPayMethod.addEventListener('change', window.togglePaymentMethod);
}

// 3. NAVIGATION & UI
function setupNavigation() {
    const items = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    items.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            const target = document.getElementById(targetId);
            if (target) {
                items.forEach(nav => nav.classList.remove('active'));
                pages.forEach(sec => sec.classList.remove('active'));
                target.classList.add('active');
                item.classList.add('active');
            }
        });
    });
}

function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); saveData(); });
}

function applyTheme(currentTheme) {
    const icon = document.getElementById('theme-icon');
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
        if (icon) icon.setAttribute('name', 'sunny-outline');
    } else {
        document.body.classList.remove('light-theme');
        if (icon) icon.setAttribute('name', 'moon-outline');
    }
}

// 4. RENDERING
function renderAll() {
    renderDashboard();
    renderInventory();
    renderMovements();
    renderFinances();
    renderReports();
    renderDebts();
    renderSuppliers();
}

function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    let totalValueUSD = products.reduce((acc, p) => acc + (p.cost * p.stock), 0);
    setElText('total-inventory-usd', formatCurrency(totalValueUSD));
    setElText('total-inventory-bs', `Bs ${formatCurrency(totalValueUSD * bcvRate, false)}`);
    let todayMovs = movements.filter(m => m.date.startsWith(today));
    let salesToday = todayMovs.filter(m => m.type === 'out').reduce((acc, m) => acc + m.total, 0);
    let costsToday = todayMovs.filter(m => m.type === 'in').reduce((acc, m) => acc + m.total, 0);
    setElText('today-income', formatCurrency(salesToday));
    setElText('today-income-bs', `Bs ${formatCurrency(salesToday * bcvRate, false)}`);
    setElText('today-expenses', formatCurrency(costsToday));
    setElText('today-expenses-bs', `Bs ${formatCurrency(costsToday * bcvRate, false)}`);
    setElText('net-profit', formatCurrency(salesToday - costsToday));
    const lowStockAlert = document.getElementById('low-stock-alert');
    if (lowStockAlert) {
        const items = products.filter(p => p.stock <= 2);
        if (items.length > 0) {
            lowStockAlert.classList.remove('hidden');
            const span = lowStockAlert.querySelector('span');
            if (span) span.textContent = `${items.length} frutas con poco peso (Kg)`;
        } else { lowStockAlert.classList.add('hidden'); }
    }
}

function renderInventory(filterText = '') {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '';
    const filtered = products.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));
    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><ion-icon name="search-outline"></ion-icon><p>Sin resultados</p></div>`;
        return;
    }
    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.innerHTML = `
            <div class="item-info"><h4>${p.name}</h4><div class="item-meta">Costo: $${p.cost} | Venta: $${p.price}</div></div>
            <div class="actions-row">
                <div class="item-stock"><span class="stock-val">${p.stock.toFixed(1)}</span><span class="stock-label">Stock</span></div>
                <button class="btn-delete" onclick="window.deleteProduct(${p.id})"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
        `;
        list.appendChild(div);
    });
}

function renderMovements(filter = 'all') {
    const list = document.getElementById('movements-list');
    if (!list) return;
    list.innerHTML = '';
    let sorted = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (filter !== 'all') sorted = sorted.filter(m => m.type === filter);
    if (sorted.length === 0) {
        list.innerHTML = `<div class="empty-state"><p>Sin movimientos</p></div>`;
        return;
    }
    sorted.forEach(m => {
        const product = products.find(p => p.id === m.productId);
        const name = product ? product.name : 'Eliminado';
        const isIn = m.type === 'in';
        const isWaste = m.type === 'waste';
        const color = isWaste ? 'text-secondary' : (isIn ? 'mov-in' : 'mov-out');
        const icon = isWaste ? 'trash-outline' : (isIn ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline');
        const div = document.createElement('div');
        div.className = 'movement-card';
        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <ion-icon name="${icon}" class="mov-icon ${color}"></ion-icon>
                <div><h4>${name} ${isWaste ? '(MERMA)' : ''}</h4><span style="font-size:0.8rem; color:gray">${new Date(m.date).toLocaleDateString()}</span></div>
            </div>
            <div class="actions-row">
                <div style="text-align:right">
                    <div style="font-weight:bold">${isIn ? '+' : '-'}${m.quantity.toFixed(1)} Kg</div>
                    <div style="font-size:0.8rem; color:${isWaste ? 'var(--danger-color)' : ''}">${formatCurrency(m.total)}</div>
                </div>
                <button class="btn-delete" onclick="window.deleteMovement(${m.id})"><ion-icon name="close-circle-outline"></ion-icon></button>
            </div>
        `;
        list.appendChild(div);
    });
}

function renderFinances() {
    const sales = movements.filter(m => m.type === 'out').reduce((acc, m) => acc + m.total, 0);
    const costs = movements.filter(m => m.type === 'in').reduce((acc, m) => acc + m.total, 0);
    const waste = movements.filter(m => m.type === 'waste').reduce((acc, m) => acc + m.total, 0);
    const balance = sales - costs - waste;
    setElText('finance-total-sales', formatCurrency(sales));
    setElText('finance-total-sales-bs', `Bs ${formatCurrency(sales * bcvRate, false)}`);
    setElText('finance-total-costs', formatCurrency(costs));
    setElText('finance-total-costs-bs', `Bs ${formatCurrency(costs * bcvRate, false)}`);
    setElText('finance-balance', formatCurrency(balance));
    setElText('finance-balance-bs', `Bs ${formatCurrency(balance * bcvRate, false)}`);
    const pill = document.getElementById('finance-status-pill');
    if (pill) { pill.textContent = balance >= 0 ? "Excelente" : "Atención"; pill.className = `status-pill ${balance >= 0 ? 'text-green' : 'text-red'}`; }
    const bar = document.getElementById('finance-progress-bar');
    if (bar && sales > 0) { const profit = ((sales - costs) / sales) * 100; bar.style.width = `${Math.max(0, Math.min(100, profit))}%`; }
}

function renderDebts() {
    const list = document.getElementById('debts-list');
    if (!list) return;
    list.innerHTML = '';
    const active = debts.filter(d => !d.paid);
    if (active.length === 0) { list.innerHTML = '<div class="empty-state"><p>Sin deudas</p></div>'; return; }
    active.forEach(d => {
        const div = document.createElement('div');
        div.className = 'debt-card';
        div.innerHTML = `
            <div class="debt-header"><span class="debt-client">${d.clientName}</span><span class="item-meta">${new Date(d.date).toLocaleDateString()}</span></div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><div style="font-size:1.2rem; font-weight:700;">${formatCurrency(d.amount)}</div><small>Bs ${formatCurrency(d.amount * bcvRate, false)}</small></div>
                <div class="actions-row">
                    <button class="btn-pay" onclick="window.payDebt(${d.id})">Cobrar</button>
                    <button class="btn-delete" onclick="window.deleteDebt(${d.id})"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

function renderSuppliers() {
    const list = document.getElementById('suppliers-list');
    if (!list) return;
    list.innerHTML = '';
    if (suppliers.length === 0) { list.innerHTML = '<div class="empty-state"><p>Sin proveedores</p></div>'; return; }
    suppliers.forEach(s => {
        const div = document.createElement('div');
        div.className = 'supplier-card';
        div.innerHTML = `
            <div class="supplier-header">
                <strong>${s.name}</strong>
                <button class="btn-delete" onclick="window.deleteSupplier(${s.id})"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
            <small>${s.phone || ''} | ${s.products_info || ''}</small>
        `;
        list.appendChild(div);
    });
}

function renderReports() {
    const list = document.getElementById('top-products-list');
    if (list) {
        list.innerHTML = '';
        const salesMap = {};
        movements.forEach(m => { if (m.type === 'out') salesMap[m.productId] = (salesMap[m.productId] || 0) + m.quantity; });
        Object.keys(salesMap).sort((a, b) => salesMap[b] - salesMap[a]).slice(0, 5).forEach(id => {
            const p = products.find(prod => prod.id == id);
            if (p) list.innerHTML += `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color)"><span>${p.name}</span><strong>${salesMap[id].toFixed(1)} Kg</strong></li>`;
        });
    }
    renderTrendChart();
}

function renderTrendChart() {
    const container = document.getElementById('trend-chart-container');
    if (!container) return;
    container.innerHTML = '';
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const trendData = [0, 0, 0, 0, 0, 0, 0];
    movements.forEach(m => { if (m.type === 'out') trendData[new Date(m.date).getDay()] += m.total; });
    const maxVal = Math.max(...trendData) || 1;
    trendData.forEach((val, i) => {
        container.innerHTML += `<div class="trend-day"><div class="trend-bar" style="height: ${(val / maxVal) * 100}%"></div><span class="day-label">${days[i]}</span></div>`;
    });
}

// 5. ACTION HANDLERS
function handleAddProduct(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const np = { id: Date.now(), name: fd.get('name'), cost: parseFloat(fd.get('cost')), price: parseFloat(fd.get('price')), stock: parseFloat(fd.get('stock')) };
    if (np.stock > 0) movements.push({ id: Date.now() + 1, productId: np.id, type: 'in', quantity: np.stock, total: np.stock * np.cost, snapshotCost: np.cost, date: new Date().toISOString() });
    products.push(np); saveData(); closeModal('add-product-modal'); e.target.reset(); renderAll();
}

function handleAddMovement(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = fd.get('type');
    const pid = parseInt(fd.get('product_id'));
    const qty = parseFloat(fd.get('quantity'));
    const p = products.find(x => x.id === pid);
    if (!p) return;
    if (type !== 'in' && p.stock < qty) return alert("Stock insuficiente");
    p.stock += (type === 'in' ? qty : -qty);
    const total = type === 'out' ? qty * p.price : qty * p.cost;
    movements.push({ id: Date.now(), productId: pid, type: type, quantity: qty, total: total, snapshotCost: p.cost, date: new Date().toISOString(), paymentMethod: fd.get('payment_method') });
    if (type === 'out' && fd.get('payment_method') === 'debt') { debts.push({ id: Date.now(), clientName: fd.get('client_name') || 'Anónimo', amount: total, date: new Date().toISOString(), paid: false }); }
    saveData(); closeModal('add-movement-modal'); e.target.reset(); renderAll();
}

function handleAddSupplier(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    suppliers.push({ id: Date.now(), name: fd.get('name'), phone: fd.get('phone'), products_info: fd.get('products_info') });
    saveData(); closeModal('add-supplier-modal'); e.target.reset(); renderSuppliers();
}

// 6. DELETION LOGIC (NEW)
window.deleteProduct = (id) => {
    if (confirm("¿Eliminar este producto? Los movimientos asociados permanecerán pero el producto ya no aparecerá en el inventario.")) {
        products = products.filter(p => p.id !== id); saveData(); renderAll();
    }
};

window.deleteMovement = (id) => {
    const m = movements.find(x => x.id === id);
    if (!m) return;
    if (confirm("¿Eliminar este movimiento? Se revertirá el efecto en el stock.")) {
        const p = products.find(x => x.id === m.productId);
        if (p) {
            // Revert stock: if it was IN (+), now subtract (-). If it was OUT (-), now add (+).
            if (m.type === 'in') p.stock -= m.quantity;
            else p.stock += m.quantity;
        }
        movements = movements.filter(x => x.id !== id); saveData(); renderAll();
    }
};

window.deleteDebt = (id) => {
    if (confirm("¿Eliminar esta deuda?")) {
        debts = debts.filter(d => d.id !== id); saveData(); renderAll();
    }
};

window.deleteSupplier = (id) => {
    if (confirm("¿Eliminar este proveedor?")) {
        suppliers = suppliers.filter(s => s.id !== id); saveData(); renderAll();
    }
};

// 7. WINDOW FUNCTIONS (GLOBAL)
window.openModal = (id) => { if (id === 'add-movement-modal') populateProductSelect(); const m = document.getElementById(id); if (m) m.classList.add('open'); };
window.closeModal = (id) => { const m = document.getElementById(id); if (m) m.classList.remove('open'); };
window.filterMovements = (type) => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); renderMovements(type); };
window.payDebt = (id) => { const d = debts.find(x => x.id === id); if (d) { d.paid = true; saveData(); renderAll(); } };

window.toggleMovementFields = () => {
    const type = document.getElementById('movement-type')?.value;
    const client = document.getElementById('client-name-field');
    const pay = document.getElementById('payment-method-field');
    const supp = document.getElementById('supplier-select-field');
    if (type === 'out') { if (pay) pay.classList.remove('hidden'); if (supp) supp.classList.add('hidden'); window.togglePaymentMethod(); }
    else if (type === 'in') { if (pay) pay.classList.add('hidden'); if (client) client.classList.add('hidden'); if (supp) supp.classList.remove('hidden'); populateSupplierSelect(); }
    else { [pay, client, supp].forEach(el => el?.classList.add('hidden')); }
    updateMovementInfo();
};

window.togglePaymentMethod = () => {
    const method = document.getElementById('movement-payment-method')?.value;
    const client = document.getElementById('client-name-field');
    if (client) { if (method === 'debt') client.classList.remove('hidden'); else client.classList.add('hidden'); }
};

window.processDayClosure = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayMovs = movements.filter(m => m.date.startsWith(today));
    const sales = todayMovs.filter(m => m.type === 'out').reduce((acc, m) => acc + m.total, 0);
    const costs = todayMovs.filter(m => m.type === 'in').reduce((acc, m) => acc + m.total, 0);
    const waste = todayMovs.filter(m => m.type === 'waste').reduce((acc, m) => acc + m.total, 0);
    const qty = todayMovs.filter(m => m.type === 'out').reduce((acc, m) => acc + m.quantity, 0);
    const res = document.getElementById('closure-results');
    if (res) { res.innerHTML = `<div class="summary-item"><span>Ventas</span> <strong>$${sales.toFixed(2)}</strong></div><div class="summary-item"><span>Inversión</span> <strong>$${costs.toFixed(2)}</strong></div><div class="summary-item"><span>Merma</span> <strong class="text-red">$${waste.toFixed(2)}</strong></div><div class="summary-item"><span>Kg Vendidos</span> <strong>${qty.toFixed(1)}</strong></div><hr><div class="summary-item"><span>Balance</span> <strong>$${(sales - costs - waste).toFixed(2)}</strong></div>`; }
    window.openModal('closure-modal');
};

window.exportToPDF = () => {
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text("Reporte Frutix", 20, 20); doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 30); doc.save("Reporte_Frutix.pdf");
};

// 8. INTERNAL UTILS
function setElText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function formatCurrency(n, isUSD = true) { return (isUSD ? '$' : '') + n.toLocaleString(isUSD ? 'en-US' : 'es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function updateMovementInfo() {
    const type = document.getElementById('movement-type')?.value;
    const pid = document.getElementById('movement-product-select')?.value;
    const qty = parseFloat(document.querySelector('#add-movement-form input[name="quantity"]')?.value) || 0;
    const p = products.find(x => x.id == pid);
    if (p) { const up = type === 'out' ? p.price : p.cost; setElText('info-price', up.toFixed(2)); setElText('info-total', (up * qty).toFixed(2)); }
}
function populateProductSelect() {
    const s = document.getElementById('movement-product-select');
    if (s) { s.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (Kg: ${p.stock.toFixed(1)})</option>`).join(''); updateMovementInfo(); }
}
function populateSupplierSelect() {
    const s = document.getElementById('movement-supplier-select');
    if (s) s.innerHTML = '<option value="">Sin proveedor</option>' + suppliers.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
}
