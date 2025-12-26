// --- FRUTIX CLOUD RECOVERY ---

const config = {
    apiKey: "AIzaSyA9xvkUT0L4IBvEH7tpqiZ4CwNYbVvxLq8",
    authDomain: "frutix-app.firebaseapp.com",
    projectId: "frutix-app",
    storageBucket: "frutix-app.firebasestorage.app",
    messagingSenderId: "99285208188",
    appId: "1:99285208188:web:11b032927d426f9c0d8df9",
    measurementId: "G-JLL6PTNH92"
};

// Inicialización Manual
firebase.initializeApp(config);
const auth = firebase.auth();
const db = firebase.firestore();

let products = [], movements = [], debts = [], suppliers = [];
let bcvRate = 45.00, currentUser = null;

// Lógica de Inicio de Sesión Directa
window.onload = () => {
    localStorage.getItem('theme') === 'light' && document.body.classList.add('light-theme');

    // Escuchar auth
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            document.body.classList.remove('auth-mode');
            initApp();
        } else {
            currentUser = null;
            document.body.classList.add('auth-mode');
        }
    });

    // Control de Botones
    const f = document.getElementById('auth-form');
    let isReg = false;

    document.getElementById('switch-auth').onclick = (e) => {
        e.preventDefault();
        isReg = !isReg;
        document.getElementById('auth-title').innerText = isReg ? "Crea tu cuenta" : "Bienvenido a Frutix";
        document.getElementById('auth-submit').innerText = isReg ? "Registrarse" : "Entrar";
        document.getElementById('switch-text').innerText = isReg ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
        document.getElementById('switch-auth').innerText = isReg ? "Entra aquí" : "Regístrate";
    };

    f.onsubmit = async (e) => {
        e.preventDefault();
        const em = document.getElementById('auth-email').value;
        const pw = document.getElementById('auth-password').value;
        const btn = document.getElementById('auth-submit');

        btn.innerText = "Conectando...";
        btn.disabled = true;

        // Timeout de seguridad: Si en 10 seg no pasa nada, avisar.
        const timer = setTimeout(() => {
            alert("⚠️ La conexión está tardando demasiado. \n1. Revisa que agregaste 'tronstheking.github.io' a Dominios Autorizados en Firebase.\n2. Revisa tu internet.");
            btn.disabled = false;
            btn.innerText = isReg ? "Registrarse" : "Entrar";
        }, 10000);

        try {
            if (isReg) {
                await auth.createUserWithEmailAndPassword(em, pw);
            } else {
                await auth.signInWithEmailAndPassword(em, pw);
            }
            clearTimeout(timer);
        } catch (err) {
            clearTimeout(timer);
            alert("Error: " + err.message);
            btn.disabled = false;
            btn.innerText = isReg ? "Registrarse" : "Entrar";
        }
    };
};

// FUNCIONES DE LA APP (DENTRO DE initApp)
function initApp() {
    const userRef = db.collection('users').doc(currentUser.uid);

    // Sync
    userRef.collection('products').onSnapshot(s => { products = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    userRef.collection('movements').orderBy('date', 'desc').limit(50).onSnapshot(s => { movements = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    userRef.collection('debts').onSnapshot(s => { debts = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    userRef.collection('suppliers').onSnapshot(s => { suppliers = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });

    // Nav
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
        document.querySelectorAll('.nav-item, .page').forEach(el => el.classList.remove('active'));
        document.getElementById(b.dataset.target).classList.add('active');
        b.classList.add('active');
    });

    // Theme & Logout
    document.getElementById('logout-btn').onclick = () => auth.signOut();
    document.getElementById('theme-toggle').onclick = () => {
        const L = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', L ? 'light' : 'dark');
    };

    // Forms
    document.getElementById('add-product-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const p = { name: fd.get('name'), cost: parseFloat(fd.get('cost')), price: parseFloat(fd.get('price')), stock: parseFloat(fd.get('stock')) };
        const d = await userRef.collection('products').add(p);
        if (p.stock > 0) await userRef.collection('movements').add({ productId: d.id, type: 'in', quantity: p.stock, total: p.stock * p.cost, date: new Date().toISOString() });
        window.closeModal('add-product-modal'); e.target.reset();
    };

    // BCV
    bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 45.00;
    const bcvInput = document.getElementById('bcv-rate');
    bcvInput.value = bcvRate;
    bcvInput.onchange = (e) => { bcvRate = parseFloat(e.target.value); localStorage.setItem('bcvRate', bcvRate); render(); };
}

function render() {
    // Dashboard
    const totalV = products.reduce((a, b) => a + (b.cost * b.stock), 0);
    document.getElementById('total-inventory-usd').innerText = `$${totalV.toFixed(2)}`;
    document.getElementById('total-inventory-bs').innerText = `Bs ${(totalV * bcvRate).toFixed(2)}`;

    // Inventario
    const inv = document.getElementById('inventory-list'); if (!inv) return;
    inv.innerHTML = products.map(p => `<div class="inventory-item"><div><h4>${p.name}</h4><small>$${p.price}</small></div><div class="actions-row"><strong>${p.stock.toFixed(1)} Kg</strong><button class="btn-delete" onclick="deleteItem('products','${p.id}')"><ion-icon name="trash"></ion-icon></button></div></div>`).join("");
}

window.deleteItem = (c, id) => confirm("¿Eliminar?") && db.collection('users').doc(currentUser.uid).collection(c).doc(id).delete();
window.openModal = (id) => {
    if (id === 'add-movement-modal') document.getElementById('movement-product-select').innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    document.getElementById(id).classList.add('open');
};
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
