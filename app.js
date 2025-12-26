// --- FRUTIX APP LOGIC (FIREBASE SYNC) ---

// 1. FIREBASE CONFIGURATION (Placeholder - User must update this)
const firebaseConfig = {
    apiKey: "AIzaSyA9xvkUT0L4IBvEH7tpqiZ4CwNYbVvxLq8",
    authDomain: "frutix-app.firebaseapp.com",
    projectId: "frutix-app",
    storageBucket: "frutix-app.firebasestorage.app",
    messagingSenderId: "99285208188",
    appId: "1:99285208188:web:11b032927d426f9c0d8df9",
    measurementId: "G-JLL6PTNH92"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. STATE MANAGEMENT (Now synced with Firestore)
let products = [];
let movements = [];
let debts = [];
let suppliers = [];
let bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 45.00;
let theme = localStorage.getItem('theme') || 'dark';
let currentUser = null;

// 3. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupAuthListeners();
    setupThemeToggle();
    setupNavigation();

    const bcvInput = document.getElementById('bcv-rate');
    if (bcvInput) {
        bcvInput.value = bcvRate;
        bcvInput.addEventListener('change', (e) => {
            bcvRate = parseFloat(e.target.value) || 0;
            localStorage.setItem('bcvRate', bcvRate);
            renderAll();
        });
    }

    applyTheme(theme);
}

// 4. AUTHENTICATION LOGIC
function setupAuthListeners() {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            document.body.classList.remove('auth-mode');
            setupRealtimeSync();
            setupEventListeners();
        } else {
            currentUser = null;
            document.body.classList.add('auth-mode');
            setupAuthForm();
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        auth.signOut();
    });
}

function setupAuthForm() {
    const form = document.getElementById('auth-form');
    const switchBtn = document.getElementById('switch-auth');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit');
    const switchText = document.getElementById('switch-text');
    const errorDiv = document.getElementById('auth-error');

    let isRegister = false;

    switchBtn.onclick = (e) => {
        e.preventDefault();
        isRegister = !isRegister;
        title.textContent = isRegister ? "Crea tu cuenta" : "Bienvenido a Frutix";
        subtitle.textContent = isRegister ? "Únete a la mejor gestión de frutas" : "Sincroniza tu negocio en la nube";
        submitBtn.textContent = isRegister ? "Registrarse" : "Entrar";
        switchText.textContent = isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
        switchBtn.textContent = isRegister ? "Inicia Sesión" : "Regístrate";
        errorDiv.classList.add('hidden');
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        errorDiv.classList.add('hidden');

        try {
            if (isRegister) {
                await auth.createUserWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    };
}

// 5. REAL-TIME DATA SYNC
function setupRealtimeSync() {
    const userDb = db.collection('users').doc(currentUser.uid);

    // Sync Products
    userDb.collection('products').onSnapshot(snapshot => {
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll();
    });

    // Sync Movements
    userDb.collection('movements').orderBy('date', 'desc').limit(200).onSnapshot(snapshot => {
        movements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll();
    });

    // Sync Debts
    userDb.collection('debts').onSnapshot(snapshot => {
        debts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll();
    });

    // Sync Suppliers
    userDb.collection('suppliers').onSnapshot(snapshot => {
        suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll();
    });
}

// 6. EVENT LISTENERS & UI
function setupEventListeners() {
    const searchInput = document.getElementById('files-search');
    if (searchInput) searchInput.addEventListener('input', (e) => renderInventory(e.target.value));

    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) {
        addProductForm.onsubmit = handleAddProduct;
    }

    const addMovementForm = document.getElementById('add-movement-form');
    if (addMovementForm) {
        addMovementForm.onsubmit = handleAddMovement;
        const mQty = addMovementForm.querySelector('input[name="quantity"]');
        const mType = document.getElementById('movement-type');
        const mProd = document.getElementById('movement-product-select');
        if (mQty) mQty.addEventListener('input', updateMovementInfo);
        if (mType) mType.addEventListener('change', updateMovementInfo);
        if (mProd) mProd.addEventListener('change', updateMovementInfo);
    }

    const addSupplierForm = document.getElementById('add-supplier-form');
    if (addSupplierForm) addSupplierForm.onsubmit = handleAddSupplier;

    const mPayMethod = document.getElementById('movement-payment-method');
    if (mPayMethod) mPayMethod.addEventListener('change', window.togglePaymentMethod);
}

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
    if (themeBtn) themeBtn.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        applyTheme(theme);
        localStorage.setItem('theme', theme);
    });
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

// 7. RENDERING FUNCTIONS
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
            if (span) span.textContent = `${items.length} frutas en crítico (< 2Kg)`;
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
            <div class="item-info"><h4>${p.name}</h4><div class="item-meta">C:$${p.cost} | V:$${p.price}</div></div>
            <div class="actions-row">
                <div class="item-stock"><span class="stock-val">${p.stock.toFixed(1)}</span><span class="stock-label">Kg</span></div>
                <button class="btn-delete" onclick="window.deleteProduct('${p.id}')"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
        `;
        list.appendChild(div);
    });
}

function renderMovements(filter = 'all') {
    const list = document.getElementById('movements-list');
    if (!list) return;
    list.innerHTML = '';
    if (movements.length === 0) {
        list.innerHTML = `<div class="empty-state"><p>Sin movimientos</p></div>`;
        return;
    }
    let displayed = movements;
    if (filter !== 'all') displayed = movements.filter(m => m.type === filter);

    displayed.forEach(m => {
        const p = products.find(x => x.id == m.productId);
        const name = p ? p.name : 'Desc.';
        const isIn = m.type === 'in';
        const isWaste = m.type === 'waste';
        const color = isWaste ? 'text-secondary' : (isIn ? 'mov-in' : 'mov-out');
        const icon = isWaste ? 'trash-outline' : (isIn ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline');
        const div = document.createElement('div');
        div.className = 'movement-card';
        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <ion-icon name="${icon}" class="mov-icon ${color}"></ion-icon>
                <div><h4>${name} ${isWaste ? '(M)' : ''}</h4><span style="font-size:0.7rem; color:gray">${new Date(m.date).toLocaleDateString()}</span></div>
            </div>
            <div class="actions-row">
                <div style="text-align:right">
                    <div style="font-weight:bold">${isIn ? '+' : '-'}${m.quantity.toFixed(1)} Kg</div>
                    <div style="font-size:0.75rem;">$${m.total.toFixed(2)}</div>
                </div>
                <button class="btn-delete" onclick="window.deleteMovement('${m.id}')"><ion-icon name="close-circle-outline"></ion-icon></button>
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
    if (pill) { pill.textContent = balance >= 0 ? "En Verde" : "Déficit"; pill.className = `status-pill ${balance >= 0 ? 'text-green' : 'text-red'}`; }
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
                <div><div style="font-weight:700;">$${d.amount.toFixed(2)}</div><small>Bs ${(d.amount * bcvRate).toFixed(2)}</small></div>
                <div class="actions-row">
                    <button class="btn-pay" onclick="window.payDebt('${d.id}')">Pagado</button>
                    <button class="btn-delete" onclick="window.deleteDebt('${d.id}')"><ion-icon name="trash-outline"></ion-icon></button>
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
            <div class="supplier-header"><strong>${s.name}</strong><button class="btn-delete" onclick="window.deleteSupplier('${s.id}')"><ion-icon name="trash-outline"></ion-icon></button></div>
            <small>${s.phone || '-'} | ${s.products_info || '-'}</small>
        `;
        list.appendChild(div);
    });
}

function renderReports() {
    renderTrendChart();
    const list = document.getElementById('top-products-list');
    if (!list) return;
    list.innerHTML = '';
    const salesMap = {};
    movements.filter(m => m.type === 'out').forEach(m => { salesMap[m.productId] = (salesMap[m.productId] || 0) + m.quantity; });
    Object.keys(salesMap).sort((a, b) => salesMap[b] - salesMap[a]).slice(0, 5).forEach(id => {
        const p = products.find(prod => prod.id == id);
        if (p) list.innerHTML += `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color)"><span>${p.name}</span><strong>${salesMap[id].toFixed(1)} Kg</strong></li>`;
    });
}

function renderTrendChart() {
    const container = document.getElementById('trend-chart-container');
    if (!container) return;
    container.innerHTML = '';
    const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const trendData = [0, 0, 0, 0, 0, 0, 0];
    movements.filter(m => m.type === 'out').forEach(m => { trendData[new Date(m.date).getDay()] += m.total; });
    const maxVal = Math.max(...trendData) || 1;
    trendData.forEach((val, i) => {
        container.innerHTML += `<div class="trend-day"><div class="trend-bar" style="height: ${(val / maxVal) * 100}%"></div><span class="day-label">${days[i]}</span></div>`;
    });
}

// 8. FIRESTORE ACTIONS handlers
const getUserCollection = (name) => db.collection('users').doc(currentUser.uid).collection(name);

async function handleAddProduct(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const np = { name: fd.get('name'), cost: parseFloat(fd.get('cost')), price: parseFloat(fd.get('price')), stock: parseFloat(fd.get('stock')) };

    try {
        const doc = await getUserCollection('products').add(np);
        if (np.stock > 0) {
            await getUserCollection('movements').add({ productId: doc.id, type: 'in', quantity: np.stock, total: np.stock * np.cost, snapshotCost: np.cost, date: new Date().toISOString() });
        }
        closeModal('add-product-modal'); e.target.reset();
    } catch (err) { alert("Error: " + err.message); }
}

async function handleAddMovement(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = fd.get('type');
    const pid = fd.get('product_id');
    const qty = parseFloat(fd.get('quantity'));
    const p = products.find(x => x.id == pid);
    if (!p) return;
    if (type !== 'in' && p.stock < qty) return alert("Stock insuficiente");

    const newStock = p.stock + (type === 'in' ? qty : -qty);
    const total = type === 'out' ? qty * p.price : qty * p.cost;
    const move = { productId: pid, type: type, quantity: qty, total: total, snapshotCost: p.cost, date: new Date().toISOString(), paymentMethod: fd.get('payment_method') };

    try {
        await getUserCollection('movements').add(move);
        await getUserCollection('products').doc(pid).update({ stock: newStock });
        if (type === 'out' && fd.get('payment_method') === 'debt') {
            await getUserCollection('debts').add({ clientName: fd.get('client_name') || 'Anónimo', amount: total, date: new Date().toISOString(), paid: false });
        }
        closeModal('add-movement-modal'); e.target.reset();
    } catch (err) { alert(err.message); }
}

async function handleAddSupplier(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
        await getUserCollection('suppliers').add({ name: fd.get('name'), phone: fd.get('phone'), products_info: fd.get('products_info') });
        closeModal('add-supplier-modal'); e.target.reset();
    } catch (err) { alert(err.message); }
}

// 9. WINDOW FUNCTIONS (GLOBAL)
window.deleteProduct = async (id) => { if (confirm("¿Eliminar producto?")) await getUserCollection('products').doc(id).delete(); };
window.deleteMovement = async (id) => {
    const m = movements.find(x => x.id == id);
    if (!m) return;
    if (confirm("¿Eliminar movimiento y revertir stock?")) {
        const p = products.find(x => x.id == m.productId);
        if (p) {
            const revertStock = p.stock + (m.type === 'in' ? -m.quantity : m.quantity);
            await getUserCollection('products').doc(p.id).update({ stock: revertStock });
        }
        await getUserCollection('movements').doc(id).delete();
    }
};
window.deleteDebt = async (id) => { if (confirm("¿Eliminar deuda?")) await getUserCollection('debts').doc(id).delete(); };
window.deleteSupplier = async (id) => { if (confirm("¿Eliminar proveedor?")) await getUserCollection('suppliers').doc(id).delete(); };
window.payDebt = async (id) => { await getUserCollection('debts').doc(id).update({ paid: true }); };

window.openModal = (id) => { if (id === 'add-movement-modal') populateProductSelect(); const m = document.getElementById(id); if (m) m.classList.add('open'); };
window.closeModal = (id) => { const m = document.getElementById(id); if (m) m.classList.remove('open'); };
window.filterMovements = (type) => renderMovements(type);

window.toggleMovementFields = () => {
    const type = document.getElementById('movement-type')?.value;
    const client = document.getElementById('client-name-field');
    const pay = document.getElementById('payment-method-field');
    const supp = document.getElementById('supplier-select-field');
    if (type === 'out') { pay?.classList.remove('hidden'); supp?.classList.add('hidden'); window.togglePaymentMethod(); }
    else if (type === 'in') { pay?.classList.add('hidden'); client?.classList.add('hidden'); supp?.classList.remove('hidden'); populateSupplierSelect(); }
    else { [pay, client, supp].forEach(el => el?.classList.add('hidden')); }
};

window.togglePaymentMethod = () => {
    const method = document.getElementById('movement-payment-method')?.value;
    const client = document.getElementById('client-name-field');
    if (client) { if (method === 'debt') client.classList.remove('hidden'); else client.classList.add('hidden'); }
};

window.processDayClosure = () => {
    const today = new Date().toISOString().split('T')[0];
    const tMovs = movements.filter(m => m.date.startsWith(today));
    const sales = tMovs.filter(m => m.type === 'out').reduce((acc, m) => acc + m.total, 0);
    const costs = tMovs.filter(m => m.type === 'in').reduce((acc, m) => acc + m.total, 0);
    const waste = tMovs.filter(m => m.type === 'waste').reduce((acc, m) => acc + m.total, 0);
    const res = document.getElementById('closure-results');
    if (res) { res.innerHTML = `<div class="summary-item"><span>Ventas</span> <strong>$${sales.toFixed(2)}</strong></div><div class="summary-item"><span>Inversión</span> <strong>$${costs.toFixed(2)}</strong></div><div class="summary-item"><span>Merma</span> <strong class="text-red">$${waste.toFixed(2)}</strong></div><hr><div class="summary-item"><span>Balance</span> <strong>$${(sales - costs - waste).toFixed(2)}</strong></div>`; }
    window.openModal('closure-modal');
};

// UTILS
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
    if (s) { s.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (${p.stock.toFixed(1)} Kg)</option>`).join(''); updateMovementInfo(); }
}
function populateSupplierSelect() {
    const s = document.getElementById('movement-supplier-select');
    if (s) s.innerHTML = '<option value="">Sin proveedor</option>' + suppliers.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
}
