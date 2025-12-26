// --- FRUTIX APP LOGIC (STABLE & CLOUD) ---

// 1. CONFIGURACIÓN
const firebaseConfig = {
    apiKey: "AIzaSyA9xvkUT0L4IBvEH7tpqiZ4CwNYbVvxLq8",
    authDomain: "frutix-app.firebaseapp.com",
    projectId: "frutix-app",
    storageBucket: "frutix-app.firebasestorage.app",
    messagingSenderId: "99285208188",
    appId: "1:99285208188:web:11b032927d426f9c0d8df9",
    measurementId: "G-JLL6PTNH92"
};

// Inicializar Firebase inmediatamente
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let products = [], movements = [], debts = [], suppliers = [];
let bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 45.00;
let currentUser = null;

// 2. INICIO
document.addEventListener('DOMContentLoaded', () => {
    // Aplicar tema rápido
    const theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'light') document.body.classList.add('light-theme');

    setupAuth();
    setupThemeToggle();
    setupNavigation();
});

// 3. AUTENTICACIÓN (MEJORADO)
function setupAuth() {
    // Escuchar cambios de sesión
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            document.body.classList.remove('auth-mode');
            startSync();
            setupAppEvents();
        } else {
            currentUser = null;
            document.body.classList.add('auth-mode');
        }
    });

    // Cambiar entre Entrar y Registrarse
    const switchBtn = document.getElementById('switch-auth');
    let isRegisterMode = false;

    if (switchBtn) {
        switchBtn.onclick = (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;

            document.getElementById('auth-title').textContent = isRegisterMode ? "Crea tu cuenta" : "Bienvenido a Frutix";
            document.getElementById('auth-submit').textContent = isRegisterMode ? "Registrarse" : "Entrar";
            document.getElementById('switch-text').textContent = isRegisterMode ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
            switchBtn.textContent = isRegisterMode ? "Inicia Sesión" : "Regístrate";
        };
    }

    // Formulario de envío
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const pass = document.getElementById('auth-password').value;
            const errorDiv = document.getElementById('auth-error');
            const submitBtn = document.getElementById('auth-submit');

            errorDiv.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = "Cargando...";

            try {
                if (isRegisterMode) {
                    await auth.createUserWithEmailAndPassword(email, pass);
                } else {
                    await auth.signInWithEmailAndPassword(email, pass);
                }
            } catch (err) {
                console.error(err);
                errorDiv.textContent = traduceError(err.code);
                errorDiv.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = isRegisterMode ? "Registrarse" : "Entrar";
            }
        };
    }

    document.getElementById('logout-btn')?.addEventListener('click', () => auth.signOut());
}

function traduceError(code) {
    if (code === 'auth/user-not-found') return "El correo no está registrado.";
    if (code === 'auth/wrong-password') return "Contraseña incorrecta.";
    if (code === 'auth/email-already-in-use') return "Este correo ya tiene cuenta.";
    if (code === 'auth/weak-password') return "La contraseña es muy corta (mínimo 6).";
    return "Error de conexión o datos inválidos.";
}

// 4. SINCRONIZACIÓN NUBE
function startSync() {
    const userRef = db.collection('users').doc(currentUser.uid);

    userRef.collection('products').onSnapshot(snap => {
        products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAll();
    });

    userRef.collection('movements').orderBy('date', 'desc').limit(100).onSnapshot(snap => {
        movements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAll();
    });

    userRef.collection('debts').onSnapshot(snap => {
        debts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAll();
    });

    userRef.collection('suppliers').onSnapshot(snap => {
        suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAll();
    });
}

// 5. EVENTOS APP
function setupAppEvents() {
    // Buscador
    document.getElementById('files-search')?.addEventListener('input', (e) => renderInventory(e.target.value));

    // Formularios
    document.getElementById('add-product-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            name: fd.get('name'),
            cost: parseFloat(fd.get('cost')),
            price: parseFloat(fd.get('price')),
            stock: parseFloat(fd.get('stock'))
        };
        const doc = await db.collection('users').doc(currentUser.uid).collection('products').add(data);
        if (data.stock > 0) {
            await db.collection('users').doc(currentUser.uid).collection('movements').add({
                productId: doc.id, type: 'in', quantity: data.stock, total: data.stock * data.cost, date: new Date().toISOString()
            });
        }
        window.closeModal('add-product-modal'); e.target.reset();
    };

    document.getElementById('add-movement-form').onsubmit = handleMovement;
    document.getElementById('add-supplier-form').onsubmit = handleSupplier;

    // BCV
    const bcv = document.getElementById('bcv-rate');
    bcv.value = bcvRate;
    bcv.onchange = (e) => {
        bcvRate = parseFloat(e.target.value) || 0;
        localStorage.setItem('bcvRate', bcvRate);
        renderAll();
    };
}

async function handleMovement(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = fd.get('type'), pid = fd.get('product_id'), qty = parseFloat(fd.get('quantity'));
    const p = products.find(x => x.id === pid);
    if (!p) return;
    if (type !== 'in' && p.stock < qty) return alert("¡No hay suficiente stock!");

    const total = type === 'out' ? qty * p.price : qty * p.cost;
    const userRef = db.collection('users').doc(currentUser.uid);

    await userRef.collection('movements').add({
        productId: pid, type, quantity: qty, total, date: new Date().toISOString(), payMethod: fd.get('payment_method')
    });
    await userRef.collection('products').doc(pid).update({ stock: p.stock + (type === 'in' ? qty : -qty) });

    if (type === 'out' && fd.get('payment_method') === 'debt') {
        await userRef.collection('debts').add({ clientName: fd.get('client_name') || 'Anónimo', amount: total, date: new Date().toISOString(), paid: false });
    }
    window.closeModal('add-movement-modal'); e.target.reset();
}

async function handleSupplier(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    await db.collection('users').doc(currentUser.uid).collection('suppliers').add({
        name: fd.get('name'), phone: fd.get('phone'), products_info: fd.get('products_info')
    });
    window.closeModal('add-supplier-modal'); e.target.reset();
}

// 6. RENDERIZADO
function renderAll() {
    renderDashboard();
    renderInventory();
    renderMovements();
    renderFinances();
    renderDebts();
    renderSuppliers();
}

function renderDashboard() {
    const totalUSD = products.reduce((a, b) => a + (b.cost * b.stock), 0);
    setTxt('total-inventory-usd', `$${totalUSD.toFixed(2)}`);
    setTxt('total-inventory-bs', `Bs ${(totalUSD * bcvRate).toFixed(2)}`);
}

function renderInventory(filter = "") {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = "";
    products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())).forEach(p => {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.innerHTML = `
            <div><h4>${p.name}</h4><small>$${p.price} / Kg</small></div>
            <div class="actions-row">
                <div style="text-align:right"><strong>${p.stock.toFixed(1)}</strong><br><small>Kg</small></div>
                <button class="btn-delete" onclick="deleteItem('products','${p.id}')"><ion-icon name="trash"></ion-icon></button>
            </div>`;
        list.appendChild(div);
    });
}

function renderMovements() {
    const list = document.getElementById('movements-list');
    if (!list) return;
    list.innerHTML = movements.length ? "" : "<p class='empty-state'>Sin movimientos</p>";
    movements.forEach(m => {
        const p = products.find(x => x.id === m.productId);
        const div = document.createElement('div');
        div.className = 'movement-card';
        div.innerHTML = `<div><strong>${p?.name || '---'}</strong><br><small>${m.type === 'in' ? 'Compra' : 'Venta'}</small></div>
                         <div style="text-align:right"><strong>${m.type === 'in' ? '+' : '-'}${m.quantity} Kg</strong><br><small>$${m.total.toFixed(2)}</small></div>`;
        list.appendChild(div);
    });
}

function renderFinances() {
    const sales = movements.filter(m => m.type === 'out').reduce((a, b) => a + b.total, 0);
    const costs = movements.filter(m => m.type === 'in').reduce((a, b) => a + b.total, 0);
    setTxt('finance-total-sales', `$${sales.toFixed(2)}`);
    setTxt('finance-total-costs', `$${costs.toFixed(2)}`);
    setTxt('finance-balance', `$${(sales - costs).toFixed(2)}`);
}

function renderDebts() {
    const list = document.getElementById('debts-list');
    if (!list) return;
    list.innerHTML = debts.filter(d => !d.paid).length ? "" : "<p class='empty-state'>Sin deudas</p>";
    debts.filter(d => !d.paid).forEach(d => {
        const div = document.createElement('div');
        div.className = 'debt-card';
        div.innerHTML = `<div><strong>${d.clientName}</strong><br><small>$${d.amount.toFixed(2)}</small></div>
                         <button class="btn-pay" onclick="payDebt('${d.id}')">Pagado</button>`;
        list.appendChild(div);
    });
}

function renderSuppliers() {
    const list = document.getElementById('suppliers-list');
    if (!list) return;
    list.innerHTML = suppliers.length ? "" : "<p class='empty-state'>Sin proveedores</p>";
    suppliers.forEach(s => {
        const div = document.createElement('div');
        div.className = 'supplier-card';
        div.innerHTML = `<strong>${s.name}</strong><br><small>${s.phone}</small>`;
        list.appendChild(div);
    });
}

// Global Actions
window.deleteItem = (col, id) => confirm("¿Eliminar?") && db.collection('users').doc(currentUser.uid).collection(col).doc(id).delete();
window.payDebt = (id) => db.collection('users').doc(currentUser.uid).collection('debts').doc(id).update({ paid: true });
window.openModal = (id) => {
    if (id === 'add-movement-modal') {
        const sel = document.getElementById('movement-product-select');
        sel.innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
    document.getElementById(id).classList.add('open');
};
window.closeModal = (id) => document.getElementById(id).classList.remove('open');

// Utils
function setTxt(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-item, .page').forEach(el => el.classList.remove('active'));
            document.getElementById(btn.dataset.target).classList.add('active');
            btn.classList.add('active');
        };
    });
}
function setupThemeToggle() {
    document.getElementById('theme-toggle').onclick = () => {
        const isL = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', isL ? 'light' : 'dark');
        document.getElementById('theme-icon').name = isL ? 'sunny-outline' : 'moon-outline';
    };
}
