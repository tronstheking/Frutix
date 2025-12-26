// --- FRUTIX CLOUD DIAGNÓSTICO ---

// Monitoreo de errores globales
window.onerror = function(msg, url, line) {
    alert("JS ERROR: " + msg + "\nLugar: " + line);
};

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
            alert("¡CONEXIÓN EXITOSA! Bienvenido.");
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
        document.getElementById('auth-title').innerText = isReg ? "Crear Cuenta" : "Entrar a Frutix";
        document.getElementById('auth-submit').innerText = isReg ? "REGISTRARME" : "ENTRAR";
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const pass = document.getElementById('auth-password').value;
        const btn = document.getElementById('auth-submit');

        btn.disabled = true;
        btn.innerText = "PROBANDO CONEXIÓN...";

        try {
            if (isReg) {
                await auth.createUserWithEmailAndPassword(email, pass);
            } else {
                await auth.signInWithEmailAndPassword(email, pass);
            }
        } catch (err) {
            alert("ATENCIÓN: " + err.message + "\nCódigo: " + err.code);
            btn.disabled = false;
            btn.innerText = isReg ? "REGISTRARME" : "ENTRAR";
        }
    };
};

function initApp() {
    // Cargar datos
    const userRef = db.collection('users').doc(currentUser.uid);
    userRef.collection('products').onSnapshot(s => { products = s.docs.map(d=>({id:d.id, ...d.data()})); render(); });
    
    // Al salir
    document.getElementById('logout-btn').onclick = () => {
        auth.signOut().then(() => window.location.reload());
    };
}

function render() {
    const totalV = products.reduce((a, b) => a + (b.cost * b.stock), 0);
    document.getElementById('total-inventory-usd').innerText = `$${totalV.toFixed(2)}`;
    
    const inv = document.getElementById('inventory-list');
    if(inv) inv.innerHTML = products.map(p => `
        <div class="inventory-item">
            <div><h4>${p.name}</h4><small>$${p.price}</small></div>
            <div class="actions-row">
                <strong>${p.stock.toFixed(1)} Kg</strong>
                <button class="btn-delete" onclick="deleteItem('products','${p.id}')">
                    <ion-icon name="trash"></ion-icon>
                </button>
            </div>
        </div>
    `).join("") || '<p class="empty-state">No hay productos</p>';
}

window.deleteItem = (c, id) => confirm("¿Eliminar?") && db.collection('users').doc(currentUser.uid).collection(c).doc(id).delete();
window.openModal = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
