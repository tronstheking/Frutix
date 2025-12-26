// --- FRUTIX CLOUD FINAL ---

const firebaseConfig = {
    apiKey: "AIzaSyA9xvkUT0L4IBvEH7tpqiZ4CwNYbVvxLq8",
    authDomain: "frutix-app.firebaseapp.com",
    projectId: "frutix-app",
    storageBucket: "frutix-app.firebasestorage.app",
    messagingSenderId: "99285208188",
    appId: "1:99285208188:web:11b032927d426f9c0d8df9",
    measurementId: "G-JLL6PTNH92"
};

// Inicializar
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let products = [], movements = [], debts = [], suppliers = [], bcvRate = 45.0, currentUser = null;

window.onload = () => {
    // Aplicar tema
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');

    // Escuchar Auth
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

    const form = document.getElementById('auth-form');
    let isReg = false;

    // Cambio de modo
    document.getElementById('switch-auth').onclick = (e) => {
        e.preventDefault();
        isReg = !isReg;
        document.getElementById('auth-title').innerText = isReg ? "Nueva Cuenta" : "Entrar a Frutix";
        document.getElementById('auth-submit').innerText = isReg ? "Crear Cuenta Ahora" : "Entrar";
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        const btn = document.getElementById('auth-submit');

        btn.disabled = true;
        btn.innerText = "VERIFICANDO..."; // SI VES ESTO, EL ARCHIVO ESTÁ ACTUALIZADO

        try {
            if (isReg) {
                await auth.createUserWithEmailAndPassword(email, pass);
            } else {
                await auth.signInWithEmailAndPassword(email, pass);
            }
        } catch (err) {
            alert("ERROR: " + err.message);
            btn.disabled = false;
            btn.innerText = isReg ? "Crear Cuenta Ahora" : "Entrar";
        }
    };
};

function initApp() {
    const userRef = db.collection('users').doc(currentUser.uid);

    // Sync
    userRef.collection('products').onSnapshot(s => { products = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    userRef.collection('movements').orderBy('date', 'desc').limit(50).onSnapshot(s => { movements = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });

    // UI Events
    document.getElementById('logout-btn').onclick = () => auth.signOut();
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
        document.querySelectorAll('.nav-item, .page').forEach(el => el.classList.remove('active'));
        document.getElementById(b.dataset.target).classList.add('active');
        b.classList.add('active');
    });

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
    const bcvInput = document.getElementById('bcv-rate');
    bcvInput.value = localStorage.getItem('bcvRate') || 45.0;
    bcvInput.onchange = (e) => {
        bcvRate = parseFloat(e.target.value);
        localStorage.setItem('bcvRate', bcvRate);
        render();
    };
}

function render() {
    // DASHBOARD
    const totalV = products.reduce((a, b) => a + (b.cost * b.stock), 0);
    document.getElementById('total-inventory-usd').innerText = `$${totalV.toFixed(2)}`;

    // INVENTARIO
    const inv = document.getElementById('inventory-list');
    if (inv) inv.innerHTML = products.map(p => `
        <div class="inventory-item">
            <div><h4>${p.name}</h4><small>$${p.price}</small></div>
            <div class="actions-row">
                <strong>${p.stock.toFixed(1)} Kg</strong>
                <button class="btn-delete" onclick="deleteItem('products','${p.id}')">
                    <ion-icon name="trash"></ion-icon>
                </button>
            </div>
        </div>
    `).join("");
}

window.deleteItem = (c, id) => confirm("¿Eliminar?") && db.collection('users').doc(currentUser.uid).collection(c).doc(id).delete();
window.openModal = (id) => {
    if (id === 'add-movement-modal') document.getElementById('movement-product-select').innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    document.getElementById(id).classList.add('open');
};
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
