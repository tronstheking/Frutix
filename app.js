// --- FRUTIX CLOUD FINAL (STABLE) ---

const firebaseConfig = {
    apiKey: "AIzaSyA9xvkUT0L4IBvEH7tpqiZ4CwNYbVvxLq8",
    authDomain: "frutix-app.firebaseapp.com",
    projectId: "frutix-app",
    storageBucket: "frutix-app.firebasestorage.app",
    messagingSenderId: "99285208188",
    appId: "1:99285208188:web:11b032927d426f9c0d8df9",
    measurementId: "G-JLL6PTNH92"
};

// Initialize
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let products = [], movements = [], debts = [], suppliers = [], bcvRate = 45.0, currentUser = null;

window.onload = () => {
    // Apply Theme
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');

    // Auth Listener
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

    // Toggle Mode
    document.getElementById('switch-auth').onclick = (e) => {
        e.preventDefault();
        isReg = !isReg;
        document.getElementById('auth-title').innerText = isReg ? "Crear Cuenta" : "Entrar a Frutix";
        document.getElementById('auth-submit').innerText = isReg ? "REGISTRARME" : "ENTRAR";
        document.getElementById('switch-text').innerText = isReg ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
        document.getElementById('switch-auth').innerText = isReg ? "Entra aquí" : "Regístrate";
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const pass = document.getElementById('auth-password').value;
        const btn = document.getElementById('auth-submit');

        btn.disabled = true;
        btn.innerText = "PROCESANDO...";

        try {
            if (isReg) {
                await auth.createUserWithEmailAndPassword(email, pass);
            } else {
                await auth.signInWithEmailAndPassword(email, pass);
            }
        } catch (err) {
            alert("Error: " + err.message);
            btn.disabled = false;
            btn.innerText = isReg ? "REGISTRARME" : "ENTRAR";
        }
    };
};

function initApp() {
    const userRef = db.collection('users').doc(currentUser.uid);

    // Sync Data
    userRef.collection('products').onSnapshot(s => { products = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    userRef.collection('movements').orderBy('date', 'desc').limit(50).onSnapshot(s => { movements = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    userRef.collection('debts').onSnapshot(s => { debts = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    userRef.collection('suppliers').onSnapshot(s => { suppliers = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); });

    // UI Navigation
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
        document.querySelectorAll('.nav-item, .page').forEach(el => el.classList.remove('active'));
        document.getElementById(b.dataset.target).classList.add('active');
        b.classList.add('active');
    });

    // Theme & Logout
    document.getElementById('logout-btn').onclick = () => auth.signOut().then(() => window.location.reload());
    document.getElementById('theme-toggle').onclick = () => {
        const L = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', L ? 'light' : 'dark');
        document.getElementById('theme-icon').name = L ? 'sunny-outline' : 'moon-outline';
    };

    // BCV Rate
    const bcvInput = document.getElementById('bcv-rate');
    bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 45.00;
    bcvInput.value = bcvRate;
    bcvInput.onchange = (e) => {
        bcvRate = parseFloat(e.target.value) || 0;
        localStorage.setItem('bcvRate', bcvRate);
        render();
    };

    // Form Handlers
    document.getElementById('add-product-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = { name: fd.get('name'), cost: parseFloat(fd.get('cost')), price: parseFloat(fd.get('price')), stock: parseFloat(fd.get('stock')) };
        const d = await userRef.collection('products').add(data);
        if (data.stock > 0) {
            await userRef.collection('movements').add({
                productId: d.id, type: 'in', quantity: data.stock, total: data.stock * data.cost, date: new Date().toISOString()
            });
        }
        window.closeModal('add-product-modal'); e.target.reset();
    };
}

function render() {
    // Total Inventory Value
    const totalUSD = products.reduce((a, b) => a + (b.cost * b.stock), 0);
    setTxt('total-inventory-usd', `$${totalUSD.toFixed(2)}`);
    setTxt('total-inventory-bs', `Bs ${(totalUSD * bcvRate).toFixed(2)}`);

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayMovs = movements.filter(m => m.date.startsWith(today));
    const salesToday = todayMovs.filter(m => m.type === 'out').reduce((a, b) => a + b.total, 0);
    const costsToday = todayMovs.filter(m => m.type === 'in').reduce((a, b) => a + b.total, 0);
    setTxt('today-income', `$${salesToday.toFixed(2)}`);
    setTxt('today-income-bs', `Bs ${(salesToday * bcvRate).toFixed(2)}`);
    setTxt('today-expenses', `$${costsToday.toFixed(2)}`);
    setTxt('today-expenses-bs', `Bs ${(costsToday * bcvRate).toFixed(2)}`);
    setTxt('net-profit', `$${(salesToday - costsToday).toFixed(2)}`);

    // Inventory List
    const invList = document.getElementById('inventory-list');
    if (invList) {
        invList.innerHTML = products.map(p => `
            <div class="inventory-item">
                <div class="item-info"><h4>${p.name}</h4><small>V: $${p.price}</small></div>
                <div class="actions-row">
                    <div style="text-align:right"><strong>${p.stock.toFixed(1)}</strong><br><small>Kg</small></div>
                    <button class="btn-delete" onclick="deleteItem('products', '${p.id}')">
                        <ion-icon name="trash-outline"></ion-icon>
                    </button>
                </div>
            </div>
        `).join("") || '<div class="empty-state"><p>No hay productos</p></div>';
    }
}

window.deleteItem = (col, id) => confirm("¿Eliminar?") && db.collection('users').doc(currentUser.uid).collection(col).doc(id).delete();
window.openModal = (id) => document.getElementById(id)?.classList.add('open');
window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');
function setTxt(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }
