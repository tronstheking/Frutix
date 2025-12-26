// --- FRUTIX PRO (CLOULD & SYNC) ---

const firebaseConfig = {
    apiKey: "AIzaSyA9xvkUT0L4IBvEH7tpqiZ4CwNYbVvxLq8",
    authDomain: "frutix-app.firebaseapp.com",
    projectId: "frutix-app",
    storageBucket: "frutix-app.firebasestorage.app",
    messagingSenderId: "99285208188",
    appId: "1:99285208188:web:11b032927d426f9c0d8df9",
    measurementId: "G-JLL6PTNH92"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let products = [], movements = [], debts = [], suppliers = [], bcvRate = 45.0, currentUser = null;

window.onload = () => {
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            document.body.classList.remove('auth-mode');
            startSync();
            initApp();
        } else {
            currentUser = null;
            document.body.classList.add('auth-mode');
        }
    });

    const form = document.getElementById('auth-form');
    let isReg = false;
    document.getElementById('switch-auth').onclick = (e) => {
        e.preventDefault();
        isReg = !isReg;
        document.getElementById('auth-title').innerText = isReg ? "Nueva Cuenta" : "Entrar a Frutix";
        document.getElementById('auth-submit').innerText = isReg ? "REGISTRARME" : "ENTRAR";
        document.getElementById('switch-text').innerText = isReg ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
        document.getElementById('switch-auth').innerText = isReg ? "Entra aquí" : "Regístrate";
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const em = document.getElementById('auth-email').value.trim();
        const pw = document.getElementById('auth-password').value;
        const btn = document.getElementById('auth-submit');
        btn.disabled = true; btn.innerText = "PROCESANDO...";
        try {
            if (isReg) await auth.createUserWithEmailAndPassword(em, pw);
            else await auth.signInWithEmailAndPassword(em, pw);
        } catch (err) {
            alert("Error: " + err.message);
            btn.disabled = false; btn.innerText = isReg ? "REGISTRARME" : "ENTRAR";
        }
    };
};

function startSync() {
    const userRef = db.collection('users').doc(currentUser.uid);
    userRef.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists) {
            bcvRate = doc.data().bcvRate || 45.0;
            const bcvInput = document.getElementById('bcv-rate');
            if (bcvInput) bcvInput.value = bcvRate;
            renderAll();
        }
    });
    userRef.collection('products').onSnapshot(s => { products = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
    userRef.collection('movements').orderBy('date', 'desc').limit(100).onSnapshot(s => { movements = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
    userRef.collection('debts').onSnapshot(s => { debts = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
    userRef.collection('suppliers').onSnapshot(s => { suppliers = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
}

function initApp() {
    const userRef = db.collection('users').doc(currentUser.uid);
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
        document.querySelectorAll('.nav-item, .page').forEach(el => el.classList.remove('active'));
        document.getElementById(b.dataset.target).classList.add('active');
        b.classList.add('active');
    });

    document.getElementById('logout-btn').onclick = () => auth.signOut().then(() => window.location.reload());
    document.getElementById('theme-toggle').onclick = () => {
        const L = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', L ? 'light' : 'dark');
        document.getElementById('theme-icon').name = L ? 'sunny-outline' : 'moon-outline';
    };

    const bcvInput = document.getElementById('bcv-rate');
    if (bcvInput) bcvInput.onchange = (e) => userRef.collection('settings').doc('global').set({ bcvRate: parseFloat(e.target.value) || 0 }, { merge: true });

    document.getElementById('add-product-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = { name: fd.get('name'), cost: parseFloat(fd.get('cost')), price: parseFloat(fd.get('price')), stock: parseFloat(fd.get('stock')) };
        const d = await userRef.collection('products').add(data);
        if (data.stock > 0) await userRef.collection('movements').add({ productId: d.id, type: 'in', quantity: data.stock, total: data.stock * data.cost, date: new Date().toISOString() });
        window.closeModal('add-product-modal'); e.target.reset();
    };

    document.getElementById('add-movement-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const type = fd.get('type'), pid = fd.get('product_id'), qty = parseFloat(fd.get('quantity'));
        const p = products.find(x => x.id === pid);
        if (!p) return;
        if (type !== 'in' && p.stock < qty) return alert("Stock insuficiente");

        const total = type === 'out' ? qty * p.price : qty * p.cost;
        await userRef.collection('movements').add({ productId: pid, type, quantity: qty, total, date: new Date().toISOString(), payMethod: fd.get('payment_method') });
        await userRef.collection('products').doc(pid).update({ stock: p.stock + (type === 'in' ? qty : -qty) });
        if (type === 'out' && fd.get('payment_method') === 'debt') await userRef.collection('debts').add({ clientName: fd.get('client_name') || 'Anónimo', amount: total, date: new Date().toISOString(), paid: false });
        window.closeModal('add-movement-modal'); e.target.reset();
    };
}

function renderAll() {
    renderDashboard();
    renderInventory();
    renderMovements();
    renderFinances();
    renderDebts();
    renderSuppliers();
    renderReports();
}

function renderDashboard() {
    const totalUSD = products.reduce((a, b) => a + (b.cost * b.stock), 0);
    setTxt('total-inventory-usd', `$${totalUSD.toFixed(2)}`);
    setTxt('total-inventory-bs', `Bs ${(totalUSD * bcvRate).toFixed(2)}`);

    const today = new Date().toISOString().split('T')[0];
    const todayMovs = movements.filter(m => m.date.startsWith(today));
    const sales = todayMovs.filter(m => m.type === 'out').reduce((a, b) => a + b.total, 0);
    const costs = todayMovs.filter(m => m.type === 'in').reduce((a, b) => a + b.total, 0);
    setTxt('today-income', `$${sales.toFixed(2)}`);
    setTxt('today-income-bs', `Bs ${(sales * bcvRate).toFixed(2)}`);
    setTxt('today-expenses', `$${costs.toFixed(2)}`);
    setTxt('today-expenses-bs', `Bs ${(costs * bcvRate).toFixed(2)}`);
    setTxt('net-profit', `$${(sales - costs).toFixed(2)}`);
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = products.map(p => `
        <div class="inventory-item">
            <div class="item-info"><h4>${p.name}</h4><small>C: $${p.cost} | V: $${p.price}</small></div>
            <div class="actions-row">
                <strong>${p.stock.toFixed(1)} Kg</strong>
                <button class="btn-delete" onclick="deleteItem('products', '${p.id}')"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
        </div>
    `).join("") || '<p class="empty-state">No hay productos</p>';
}

function renderMovements() {
    const list = document.getElementById('movements-list');
    if (!list) return;
    list.innerHTML = movements.map(m => {
        const p = products.find(x => x.id === m.productId);
        const color = m.type === 'in' ? 'text-green' : 'text-red';
        return `
            <div class="movement-card">
                <div><strong>${p?.name || '---'}</strong><br><small>${m.type === 'in' ? 'Entrada' : 'Salida'}</small></div>
                <div class="actions-row">
                    <div style="text-align:right"><strong class="${color}">${m.type === 'in' ? '+' : '-'}${m.quantity} Kg</strong><br><small>$${m.total.toFixed(2)}</small></div>
                    <button class="btn-delete" onclick="deleteMovement('${m.id}')"><ion-icon name="close-circle-outline"></ion-icon></button>
                </div>
            </div>
        `;
    }).join("") || '<p class="empty-state">No hay movimientos</p>';
}

function renderFinances() {
    const s = movements.filter(m => m.type === 'out').reduce((a, b) => a + b.total, 0);
    const c = movements.filter(m => m.type === 'in').reduce((a, b) => a + b.total, 0);
    setTxt('finance-total-sales', `$${s.toFixed(2)}`);
    setTxt('finance-total-costs', `$${c.toFixed(2)}`);
    setTxt('finance-balance', `$${(s - c).toFixed(2)}`);
}

function renderDebts() {
    const list = document.getElementById('debts-list');
    if (list) list.innerHTML = debts.filter(d => !d.paid).map(d => `<div class="debt-card"><strong>${d.clientName}</strong>: $${d.amount.toFixed(2)} <button onclick="payDebt('${d.id}')">Pagado</button></div>`).join("") || '<p class="empty-state">Sin deudas</p>';
}

function renderSuppliers() {
    const list = document.getElementById('suppliers-list');
    if (list) list.innerHTML = suppliers.map(s => `<div class="supplier-card"><strong>${s.name}</strong></div>`).join("") || '<p class="empty-state">Sin proveedores</p>';
}

function renderReports() {
    const container = document.getElementById('trend-chart-container');
    if (!container) return;
    const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const data = [0, 0, 0, 0, 0, 0, 0];
    movements.filter(m => m.type === 'out').forEach(m => data[new Date(m.date).getDay()] += m.total);
    const max = Math.max(...data) || 1;
    container.innerHTML = data.map((v, i) => `<div class="trend-day"><div class="trend-bar" style="height: ${(v / max) * 100}%"></div><span>${days[i]}</span></div>`).join("");
}

// Window functions
window.processDayClosure = () => {
    const t = new Date().toISOString().split('T')[0], m = movements.filter(x => x.date.startsWith(t));
    const s = m.filter(x => x.type === 'out').reduce((a, b) => a + b.total, 0), c = m.filter(x => x.type === 'in').reduce((a, b) => a + b.total, 0);
    document.getElementById('closure-results').innerHTML = `<div class="summary-item">Ventas: $${s.toFixed(2)}</div><div class="summary-item">Inversión: $${c.toFixed(2)}</div><hr><div class="summary-item">Ganancia: $${(s - c).toFixed(2)}</div>`;
    window.openModal('closure-modal');
};

window.deleteMovement = async (id) => {
    if (!confirm("¿Eliminar movimiento y revertir stock?")) return;
    const m = movements.find(x => x.id === id);
    if (m) {
        const p = products.find(x => x.id === m.productId);
        if (p) await db.collection('users').doc(currentUser.uid).collection('products').doc(p.id).update({ stock: p.stock + (m.type === 'in' ? -m.quantity : m.quantity) });
    }
    await db.collection('users').doc(currentUser.uid).collection('movements').doc(id).delete();
};

window.deleteItem = (col, id) => confirm("¿Eliminar?") && db.collection('users').doc(currentUser.uid).collection(col).doc(id).delete();
window.payDebt = (id) => db.collection('users').doc(currentUser.uid).collection('debts').doc(id).update({ paid: true });
window.openModal = (id) => {
    if (id === 'add-movement-modal') document.getElementById('movement-product-select').innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    document.getElementById(id).classList.add('open');
};
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
window.exportToPDF = () => { alert("Exportando a PDF..."); };
function setTxt(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }
