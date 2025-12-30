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

// ENABLE OFFLINE PERSISTENCE
db.enablePersistence().catch(err => {
    if (err.code === 'failed-precondition') console.warn("Persistence failed: Multiple tabs open");
    else if (err.code === 'unimplemented') console.warn("Persistence not supported by browser");
});

let products = [], movements = [], debts = [], suppliers = [], clients = [], orders = [], bcvRate = 45.0, currentUser = null;
let salesChart = null, productsChart = null, currentMovFilter = 'all';

window.showToast = (message, type = 'info') => {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container); // Appends to body
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'information-circle-outline';
    if (type === 'success') icon = 'checkmark-circle-outline';
    if (type === 'error') icon = 'alert-circle-outline';

    toast.innerHTML = `<ion-icon name="${icon}" style="color:${type === 'error' ? '#FF3B30' : (type === 'success' ? '#34C759' : '#007AFF')}"></ion-icon> ${message}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.onload = () => {
    // Light mode is now the only mode
    document.body.classList.remove('light-theme');

    // Splash dismissal
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('splash-hidden');
    }, 2500);

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
        const errDiv = document.getElementById('auth-error');

        btn.disabled = true;
        btn.innerText = "PROCESANDO...";
        if (errDiv) { errDiv.innerText = ""; errDiv.classList.add('hidden'); }

        try {
            if (isReg) await auth.createUserWithEmailAndPassword(em, pw);
            else await auth.signInWithEmailAndPassword(em, pw);
        } catch (err) {
            console.error("Auth Error:", err);
            if (errDiv) {
                errDiv.innerText = "Error: " + err.message;
                errDiv.classList.remove('hidden');
                if (errDiv) {
                    errDiv.innerText = "Error: " + err.message;
                    errDiv.classList.remove('hidden');
                } else {
                    window.showToast("Error: " + err.message, 'error');
                }
                btn.disabled = false;
                btn.innerText = isReg ? "REGISTRARME" : "ENTRAR";
            }
        };
    };

    let closures = []; // Closure History State

    function startSync() {
        const userRef = db.collection('users').doc(currentUser.uid);
        userRef.collection('settings').doc('global').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                bcvRate = data.bcvRate || 45.0;
                window.publicCatalogUrl = data.publicCatalogUrl || '';
                const bcvInput = document.getElementById('bcv-rate');
                if (bcvInput) {
                    bcvInput.value = Number(bcvRate).toFixed(2);
                }
                renderAll();
            }
        });
        userRef.collection('products').onSnapshot(s => { products = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
        userRef.collection('movements').orderBy('date', 'desc').limit(1000).onSnapshot(s => { movements = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
        userRef.collection('debts').onSnapshot(s => { debts = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
        userRef.collection('suppliers').onSnapshot(s => { suppliers = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
        userRef.collection('clients').onSnapshot(s => { clients = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
        userRef.collection('orders').orderBy('date', 'desc').onSnapshot(s => { orders = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
        // History Listener
        userRef.collection('closures').orderBy('date', 'desc').limit(20).onSnapshot(s => {
            closures = s.docs.map(d => ({ id: d.id, ...d.data() }));
            renderHistory();
        });

        // Sync Status Indicator
        const syncIndicator = document.getElementById('sync-status');
        db.collection('.info').doc('connected').onSnapshot(() => {
            if (navigator.onLine) {
                syncIndicator.className = 'sync-indicator online';
                syncIndicator.title = 'Conectado';
            } else {
                syncIndicator.className = 'sync-indicator offline';
                syncIndicator.title = 'Trabajando sin conexión';
            }
        });
    }

    function initApp() {
        const userRef = db.collection('users').doc(currentUser.uid);
        document.querySelectorAll('.nav-item, .nav-item-top').forEach(b => b.onclick = () => {
            document.querySelectorAll('.nav-item, .nav-item-top, .page').forEach(el => el.classList.remove('active'));
            document.getElementById(b.dataset.target).classList.add('active');
            document.querySelectorAll(`[data-target="${b.dataset.target}"]`).forEach(el => el.classList.add('active'));
        });

        document.getElementById('logout-btn').onclick = () => auth.signOut().then(() => window.location.reload());

        // Theme toggle removed per user request
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.style.display = 'none';

        const bcvInput = document.getElementById('bcv-rate');
        if (bcvInput) {
            bcvInput.oninput = (e) => { e.target.value = e.target.value.replace(',', '.'); };
            bcvInput.onblur = (e) => {
                const val = parseFloat(e.target.value) || 0;
                e.target.value = val.toFixed(2);
                userRef.collection('settings').doc('global').set({ bcvRate: val }, { merge: true });
            };
            bcvInput.onchange = (e) => {
                const val = parseFloat(e.target.value) || 0;
                userRef.collection('settings').doc('global').set({ bcvRate: val }, { merge: true });
            };
        }

        document.getElementById('add-product-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const file = document.getElementById('product-image-input').files[0];
            let imageUrl = '';

            if (file) {
                imageUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
            }

            const data = {
                name: fd.get('name'),
                code: fd.get('code') || '',
                cost: parseFloat(fd.get('cost')),
                price: parseFloat(fd.get('price')),
                stock: parseFloat(fd.get('stock')),
                unitType: fd.get('unit_type') || 'Kg',
                imageUrl: imageUrl,
                inCatalog: document.getElementById('in-catalog-check').checked
            };
            const d = await userRef.collection('products').add(data);
            if (data.stock > 0) await userRef.collection('movements').add({ productId: d.id, type: 'in', quantity: data.stock, total: data.stock * data.cost, date: new Date().toISOString() });
            window.showToast('Producto agregado correctamente', 'success');
            window.closeModal('add-product-modal'); e.target.reset();
        };

        document.getElementById('add-client-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await userRef.collection('clients').add({
                name: fd.get('name'),
                phone: fd.get('phone') || '',
                note: fd.get('note') || '',
                dateAdded: new Date().toISOString()
            });
            window.closeModal('add-client-modal'); e.target.reset();
        };

        document.getElementById('add-order-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await userRef.collection('orders').add({
                productName: fd.get('product_name'),
                customerInfo: fd.get('customer_info') || 'Anonimo',
                estimatedQty: fd.get('estimated_qty') || '',
                date: new Date().toISOString(),
                status: 'pending'
            });
            window.showToast('Pedido registrado', 'success');
            window.closeModal('add-order-modal'); e.target.reset();
        };

        document.getElementById('add-movement-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const type = fd.get('type'), pid = fd.get('product_id');
            let qty = parseFloat(fd.get('quantity'));
            const saleMode = document.getElementById('movement-sale-mode').value;

            const p = products.find(x => x.id === pid);
            if (p && type === 'out' && saleMode === 'amount') {
                // Calculate quantity from dollar amount: qty = $ / price
                const amountInDollars = qty;
                qty = amountInDollars / p.price;
            }

            let total = 0;
            let dataToSave = {
                type,
                quantity: qty,
                date: new Date().toISOString(),
                payMethod: fd.get('payment_method') || 'cash',
                payType: fd.get('payment_type') || '',
                reference: fd.get('reference') || '',
                notes: fd.get('notes') || '',
                bcvRate: bcvRate
            };

            if (type === 'expense') {
                total = qty; // For expenses, quantity field is the $ amount
                dataToSave.productId = null;
                dataToSave.category = fd.get('expense_category');
                dataToSave.reason = fd.get('reason') || '';
                dataToSave.total = total;
            } else {
                const p = products.find(x => x.id === pid);
                if (!p) return;
                if (type !== 'in' && p.stock < qty) return window.showToast("Stock insuficiente para realizar esta salida", 'error');

                const discount = parseFloat(fd.get('discount')) || 0;
                const delivery = parseFloat(fd.get('delivery')) || 0;

                total = type === 'out' ? (qty * p.price) - discount + delivery : qty * p.cost;

                dataToSave.productId = pid;
                dataToSave.total = total;
                dataToSave.discount = discount;
                dataToSave.delivery = delivery;

                // Update stock only for physical movements
                await userRef.collection('products').doc(pid).update({ stock: p.stock + (type === 'in' ? qty : -qty) });

                if (type === 'out' && fd.get('payment_method') === 'debt') {
                    await userRef.collection('debts').add({
                        clientName: fd.get('client_name') || 'Anónimo',
                        clientPhone: fd.get('client_phone') || '',
                        amount: total,
                        date: new Date().toISOString(),
                        paid: false
                    });
                }

                if (type === 'out') {
                    const discountText = discount > 0 ? `\n➖ Descuento: $${discount.toFixed(2)}` : '';
                    const totalBs = total * bcvRate;
                    const receiptText = `🧾 *RECIBO DE VENTA - FRUTIX*\n----------------------------\n🍎 Producto: ${p.name}\n⚖️ Cantidad: ${qty.toFixed(2)} Kg\n💵 Subtotal: $${(qty * p.price).toFixed(2)}${discountText}\n💰 TOTAL USD: $${total.toFixed(2)}\n🇻🇪 TOTAL BS: Bs ${totalBs.toFixed(2)}\n📈 Tasa: ${bcvRate.toFixed(2)}\n📅 Fecha: ${new Date().toLocaleString()}\n----------------------------\n¡Gracias por su compra! 🍉`;
                    document.getElementById('receipt-content').innerText = receiptText;
                    document.getElementById('receipt-phone').value = fd.get('client_phone') || '';
                    window.openModal('receipt-modal');
                }
            }

            await userRef.collection('movements').add(dataToSave);
            window.showToast('Movimiento registrado', 'success');
            window.closeModal('add-movement-modal'); e.target.reset();
            window.toggleMovementFields(); // Reset fields visibility
        };

        // Fix for keyboard covering inputs
        document.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('focus', () => {
                // Delay to allow Android keyboard to finish its animation
                setTimeout(() => {
                    // Scroll the element into the middle of the viewport
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // If it's still covered or too low, we can adjust
                    if (window.innerWidth < 900) {
                        window.scrollBy(0, -50); // Small adjustment to see the label
                    }
                }, 500); // Slightly more delay for Samsung's animation
            });
        });
    }

    function renderAll() {
        renderDashboard();
        window.renderCatalog();
        renderInventory();
        renderMovements();
        renderFinances();
        renderCatalog();
        renderClients();
        renderOrders();
        renderDebts();
        renderSuppliers();
        // Only render reports if we are on that page to save performance
        if (document.getElementById('reports').classList.contains('active')) {
            renderReports();
        }
    }

    function renderDashboard() {
        const totalUSD = products.reduce((a, b) => a + (b.cost * b.stock), 0);
        setTxt('total-inventory-usd', `$${totalUSD.toFixed(2)}`);
        setTxt('total-inventory-bs', `Bs ${(totalUSD * bcvRate).toFixed(2)}`);

        const today = new Date().toISOString().split('T')[0];
        const todayMovs = movements.filter(m => m.date.startsWith(today));
        const sales = todayMovs.filter(m => m.type === 'out').reduce((a, b) => a + b.total, 0);
        const costs = todayMovs.filter(m => m.type === 'in' || m.type === 'expense' || m.type === 'waste').reduce((a, b) => a + b.total, 0);
        setTxt('today-income', `$${sales.toFixed(2)}`);
        setTxt('today-income-bs', `Bs ${(sales * bcvRate).toFixed(2)}`);
        setTxt('today-expenses', `$${costs.toFixed(2)}`);
        setTxt('today-expenses-bs', `Bs ${(costs * bcvRate).toFixed(2)}`);
        setTxt('net-profit', `$${(sales - costs).toFixed(2)}`);

        // Low Stock Alerts
        const lowStockProds = products.filter(p => p.stock < 5);
        const alertBox = document.getElementById('low-stock-alert');
        if (alertBox) {
            if (lowStockProds.length > 0) {
                alertBox.classList.remove('hidden');
                alertBox.innerHTML = `
                <div class="stat-card" style="border: 1px solid var(--danger-color); background: rgba(255,59,48,0.05);">
                    <div style="display:flex; align-items:center; gap:10px; color:var(--danger-color); font-weight:700;">
                        <ion-icon name="warning-outline" style="font-size:1.5rem;"></ion-icon>
                        ¡ALERTA DE STOCK BAJO!
                    </div>
                    <div style="margin-top:10px; font-size:0.85rem;">
                        ${lowStockProds.map(p => `• <strong>${p.name}</strong>: solo quedan ${p.stock.toFixed(1)} ${p.unitType || 'Kg'}`).join('<br>')}
                    </div>
                </div>
            `;
            } else {
                alertBox.classList.add('hidden');
            }
        }
    }

    function renderInventory() {
        const list = document.getElementById('inventory-list');
        if (!list) return;
        list.innerHTML = products.map(p => {
            const imgHtml = p.imageUrl ? `<img src="${p.imageUrl}" class="product-thumb">` : `<div class="product-thumb-placeholder"><ion-icon name="image-outline"></ion-icon></div>`;
            return `
            <div class="inventory-item" onclick="window.openProductDetail('${p.id}')">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${imgHtml}
                    <div class="item-info">
                        <h4>${p.name}</h4>
                        <small style="color:var(--text-secondary)">${p.code ? 'Cod: ' + p.code + ' | ' : ''} C: $${p.cost} | V: $${p.price}</small>
                    </div>
                </div>
                <div class="actions-row">
                    <div style="text-align:right">
                        <strong style="color:var(--primary-color);">${p.stock.toFixed(1)} ${p.unitType || 'Kg'}</strong><br>
                    <button class="icon-btn" onclick="event.stopPropagation(); window.generateMarketingCard('${p.id}')" style="color:var(--primary-color); padding:0; margin-top:5px;" title="Crear Estado">
                        <ion-icon name="share-social-outline"></ion-icon>
                    </button>
                    </div>
                <button class="btn-delete" onclick="event.stopPropagation(); deleteItem('products', '${p.id}')"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
            </div>
        `;
        }).join("") || '<p class="empty-state">No hay productos</p>';
    }

    function renderMovements() {
        const list = document.getElementById('movements-list');
        if (!list) return;

        const dateFilter = document.getElementById('movement-date-filter').value;

        // Update active tab buttons visual state
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const filterAttr = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            if (filterAttr === currentMovFilter) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const filtered = movements.filter(m => {
            let matchType = (currentMovFilter === 'all' || m.type === currentMovFilter);
            let matchDate = true;
            if (dateFilter && m.date) {
                // Convert m.date (ISO) to local YYYY-MM-DD to match the input[type=date] value
                const d = new Date(m.date);
                if (!isNaN(d.getTime())) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const localMovDate = `${year}-${month}-${day}`;
                    matchDate = (localMovDate === dateFilter);
                }
            }
            return matchType && matchDate;
        });

        list.innerHTML = filtered.map(m => {
            const p = products.find(x => x.id === m.productId);
            const color = m.type === 'in' ? 'text-green' : 'text-red';
            const icon = m.type === 'in' ? 'arrow-up-circle' : (m.type === 'out' ? 'arrow-down-circle' : 'trash-outline');

            // Format date and time
            const dateObj = new Date(m.date);
            const formattedDate = dateObj.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            const rateHtml = m.bcvRate ? `<span style="margin-left:8px; color:#007AFF;">Tasa: ${m.bcvRate.toFixed(2)}</span>` : '';

            let payTypeLabel = '';
            if (m.payType === 'cash_usd') payTypeLabel = '($)';
            else if (m.payType === 'cash_bs') payTypeLabel = '(Bs)';
            else if (m.payType === 'mobile_pay') payTypeLabel = '(PM)';
            else if (m.payType === 'transfer') payTypeLabel = '(TR)';
            else if (m.payType === 'zelle') payTypeLabel = '(Z)';

            const typeLabel = m.type === 'in' ? 'Entrada' : (m.type === 'out' ? 'Venta' : (m.type === 'waste' ? 'Merma' : 'Gasto'));
            const payHtml = m.type === 'out' ? `<span class="status-pill" style="margin:0; padding:2px 8px; font-size:0.65rem; background:${m.payMethod === 'debt' ? 'rgba(255,149,0,0.1)' : 'rgba(0,122,255,0.1)'}; color:${m.payMethod === 'debt' ? '#FF9500' : '#007AFF'};">${m.payMethod === 'debt' ? 'FIADO' : 'CASH ' + payTypeLabel}</span>` : '';
            const movementMainLabel = m.type === 'expense' ? (m.category || 'Gasto') : (p?.name || '---');
            const movementSubLabel = m.type === 'expense' ? (m.reason ? m.reason : 'Gasto Operativo') : typeLabel;

            return `
            <div class="movement-card" style="flex-direction: column; align-items: stretch; gap: 8px;">
                <div style="display:flex; justify-content: space-between; align-items: start;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="icon-box ${m.type === 'in' ? 'green' : 'red'}" style="margin:0; ${m.type === 'expense' ? 'background:rgba(255,59,48,0.15); color:#FF3B30;' : ''}">
                            <ion-icon name="${icon}"></ion-icon>
                        </div>
                        <div>
                            <strong>${movementMainLabel}</strong> ${payHtml}<br>
                            <small style="color:var(--text-secondary)">${movementSubLabel}</small>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <strong class="${m.type === 'in' ? 'text-green' : 'text-red'}">${m.type === 'in' ? '+' : '-'}${m.type === 'expense' ? '$' + m.total.toFixed(2) : m.quantity + ' ' + (p?.unitType || 'Kg')}</strong><br>
                        ${m.type !== 'expense' ? `<small style="color:var(--text-secondary)">$${m.total.toFixed(2)} / <span style="color:var(--primary-color)">Bs ${(m.total * (m.bcvRate || bcvRate)).toFixed(2)}</span></small>` : `<small style="color:var(--text-secondary)">Bs ${(m.total * (m.bcvRate || bcvRate)).toFixed(2)}</small>`}
                    </div>
                </div>
                <div style="display:flex; justify-content: space-between; align-items: center; border-top: 0.5px solid var(--border-color); pt: 8px; margin-top: 4px; padding-top: 8px;">
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">
                        <ion-icon name="calendar-outline" style="vertical-align: middle;"></ion-icon> ${formattedDate} 
                        <ion-icon name="time-outline" style="vertical-align: middle; margin-left: 8px;"></ion-icon> ${formattedTime}
                        ${rateHtml}
                    </span>
                    <button class="btn-delete" onclick="deleteMovement('${m.id}')" style="background:transparent; padding: 0; width: auto; height: auto;">
                        <ion-icon name="close-outline" style="font-size: 1.2rem;"></ion-icon>
                    </button>
                </div>
            </div>
        `;
        }).join("") || '<p class="empty-state">No hay movimientos</p>';
    }

    function renderFinances() {
        const s = movements.filter(m => m.type === 'out').reduce((a, b) => a + b.total, 0);
        const c = movements.filter(m => m.type === 'in').reduce((a, b) => a + b.total, 0);
        const e = movements.filter(m => m.type === 'expense').reduce((a, b) => a + b.total, 0);
        const d = debts.filter(x => !x.paid).reduce((a, b) => a + b.amount, 0);
        const w = movements.filter(m => m.type === 'waste').reduce((a, b) => a + b.total, 0);

        const balance = s - c - e - w;

        setTxt('finance-total-sales', `$${s.toFixed(2)}`);
        setTxt('finance-total-sales-bs', `Bs ${(s * bcvRate).toFixed(2)}`);

        setTxt('finance-total-debts', `$${d.toFixed(2)}`);
        setTxt('finance-total-debts-bs', `Bs ${(d * bcvRate).toFixed(2)}`);

        setTxt('finance-total-expenses', `$${e.toFixed(2)}`);
        setTxt('finance-total-expenses-bs', `Bs ${(e * bcvRate).toFixed(2)}`);

        setTxt('finance-total-costs', `$${c.toFixed(2)}`);
        setTxt('finance-total-costs-bs', `Bs ${(c * bcvRate).toFixed(2)}`);

        setTxt('finance-balance', `$${balance.toFixed(2)}`);
        setTxt('finance-balance-bs', `Bs ${(balance * bcvRate).toFixed(2)}`);

        const statusPill = document.getElementById('finance-status-pill');
        if (statusPill) {
            if (balance > 0) {
                statusPill.innerText = 'Ganancia';
                statusPill.style.background = 'rgba(52, 199, 89, 0.1)';
                statusPill.style.color = '#34C759';
            } else {
                statusPill.innerText = 'Pérdida / Inv.';
                statusPill.style.background = 'rgba(255, 59, 48, 0.1)';
                statusPill.style.color = '#FF3B30';
            }
        }

        const breakdownContainer = document.getElementById('finance-cash-breakdown');
        if (breakdownContainer) {
            const types = {
                'cash_usd': { label: 'Efectivo ($)', icon: 'cash-outline', color: '#34C759' },
                'cash_bs': { label: 'Efectivo (Bs)', icon: 'wallet-outline', color: '#FF9500' },
                'mobile_pay': { label: 'Pago Móvil', icon: 'phone-portrait-outline', color: '#007AFF' },
                'transfer': { label: 'Transferencia', icon: 'swap-horizontal-outline', color: '#5856D6' },
                'zelle': { label: 'Zelle', icon: 'logo-usd', color: '#AF52DE' },
                'debt': { label: 'Fiado (Crédito)', icon: 'people-outline', color: '#FF3B30' }
            };

            const totals = movements.reduce((acc, m) => {
                if (m.type === 'out') {
                    const key = m.payMethod === 'debt' ? 'debt' : (m.payType || 'cash_usd');
                    acc[key] = (acc[key] || 0) + m.total;
                } else if (m.type === 'expense') {
                    const key = m.payType || 'cash_usd';
                    acc[key] = (acc[key] || 0) - m.total; // Subtract expenses from cash types
                }
                return acc;
            }, {});

            breakdownContainer.innerHTML = Object.keys(types).map(key => {
                const amount = totals[key] || 0;
                const amountBs = amount * bcvRate;
                const pct = s > 0 ? (amount / s * 100).toFixed(0) : 0;
                return `
                <div onclick="window.showRecentPayments('${key}')" style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--card-bg); border-radius:16px; border: 0.5px solid var(--border-color); margin-bottom:8px; cursor:pointer; active:opacity:0.7;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="icon-box" style="background:${types[key].color}15; color:${types[key].color}; margin:0; width:40px; height:40px; border-radius:12px;">
                            <ion-icon name="${types[key].icon}"></ion-icon>
                        </div>
                        <div>
                            <span style="font-size:0.9rem; font-weight:700; display:block;">${types[key].label}</span>
                            <small style="color:var(--text-secondary); font-size:0.75rem;">${pct}% del ingreso <ion-icon name="chevron-forward-outline" style="vertical-align:middle;"></ion-icon></small>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-weight:800; color:var(--text-primary); font-size:1rem;">$${amount.toFixed(2)}</div>
                        <div style="color:var(--primary-color); font-size:0.8rem; font-weight:600;">Bs ${amountBs.toFixed(2)}</div>
                    </div>
                </div>
            `;
            }).join('');
        }
    }

    window.showRecentPayments = (key) => {
        const types = {
            'cash_usd': { label: 'Efectivo ($)' },
            'cash_bs': { label: 'Efectivo (Bs)' },
            'mobile_pay': { label: 'Pago Móvil' },
            'transfer': { label: 'Transferencia' },
            'zelle': { label: 'Zelle' },
            'debt': { label: 'Fiado (Crédito)' }
        };

        document.getElementById('recent-payments-title').innerText = `Pagos: ${types[key].label}`;
        const list = document.getElementById('recent-payments-list');

        const filtered = movements.filter(m => {
            if (m.type !== 'out') return false;
            if (key === 'debt') return m.payMethod === 'debt';
            return m.payType === key && m.payMethod !== 'debt';
        }).slice(0, 10);

        list.innerHTML = filtered.map(m => {
            const p = products.find(x => x.id === m.productId);
            const d = new Date(m.date);
            const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div style="padding:10px; border-radius:12px; background:#f9f9f9; border-left:4px solid var(--primary-color); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:700; font-size:0.9rem;">${p ? p.name : 'Venta'} (${m.quantity} ${p?.unitType || 'Kg'})</div>
                        <small style="color:var(--text-secondary);">${dateStr}</small>
                        ${m.reference ? `<div style="font-size:0.7rem; color:var(--primary-color);">Ref: ${m.reference}</div>` : ''}
                    </div>
                    <div style="text-align:right">
                        <div style="font-weight:700;">$${m.total.toFixed(2)}</div>
                        <div style="font-size:0.8rem; color:var(--primary-color)">Bs ${(m.total * (m.bcvRate || bcvRate)).toFixed(2)}</div>
                    </div>
                </div>
            `;
        }).join('') || '<p style="text-align:center; padding:20px; color:#999;">No hay pagos recientes</p>';

        window.openModal('recent-payments-modal');
    };

    function renderDebts() {
        const list = document.getElementById('debts-list');
        if (!list) return;
        list.innerHTML = debts.filter(d => !d.paid).map(d => {
            const phoneHtml = d.clientPhone ? `<br><small><a href="https://wa.me/${d.clientPhone.replace(/\D/g, '')}" target="_blank" style="color:var(--primary-color); text-decoration:none;"><ion-icon name="logo-whatsapp"></ion-icon> ${d.clientPhone}</a></small>` : '';
            return `
            <div class="debt-card">
                <div>
                    <strong>${d.clientName}</strong>: $${d.amount.toFixed(2)}
                    ${phoneHtml}
                </div>
                <button onclick="payDebt('${d.id}')">Pagado</button>
            </div>
        `;
        }).join("") || '<p class="empty-state">Sin deudas</p>';
    }

    function renderSuppliers() {
        const list = document.getElementById('suppliers-list');
        if (list) list.innerHTML = suppliers.map(s => `<div class="supplier-card"><strong>${s.name}</strong></div>`).join("") || '<p class="empty-state">Sin proveedores</p>';
    }

    function renderCatalog() {
        const list = document.getElementById('catalog-list');
        if (!list) return;

        // Filter only products marked to be in catalog
        const catalogProducts = products.filter(p => p.inCatalog !== false); // Default to true if field doesn't exist

        list.innerHTML = catalogProducts.map(p => {
            const imgHtml = p.imageUrl ? `<img src="${p.imageUrl}" class="catalog-img">` : `<div class="catalog-img-placeholder"><ion-icon name="image-outline"></ion-icon></div>`;
            const priceBs = (p.price * bcvRate).toFixed(2);
            const waText = encodeURIComponent(`Hola! Me interesa el producto: ${p.name}. ¿Sigue disponible?`);

            return `
            <div class="catalog-card">
                ${imgHtml}
                <div class="catalog-info">
                    <div class="catalog-name">${p.name}</div>
                    <div class="catalog-price">$${p.price.toFixed(2)}</div>
                    <span class="catalog-price-bs">Bs ${priceBs}</span>
                    <a href="https://wa.me/?text=${waText}" target="_blank" class="btn-catalog-order">
                        <ion-icon name="logo-whatsapp"></ion-icon> Pedir
                    </a>
                </div>
            </div>
        `;
        }).join("") || '<p class="empty-state">No hay productos en el catálogo</p>';
    }

    function renderReports() {
        renderPieCharts();
        const container = document.getElementById('trend-chart-container');
        if (!container) return;
        const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
        const data = [0, 0, 0, 0, 0, 0, 0];
        movements.filter(m => m.type === 'out').forEach(m => data[new Date(m.date).getDay()] += m.total);
        const max = Math.max(...data) || 1;
        container.innerHTML = data.map((v, i) => `<div class="trend-day"><div class="trend-bar" style="height: ${(v / max) * 100}%"></div><span>${days[i]}</span></div>`).join("");
    }

    function renderHistory() {
        const list = document.getElementById('history-list');
        if (!list) return;

        list.innerHTML = closures.map(c => {
            const dateObj = new Date(c.date);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isZ = c.type === 'Z';

            return `
             <div class="history-card" onclick="alert('Detalle: ${c.details.replace(/\n/g, ' - ')}')">
                <div class="history-icon ${isZ ? 'z-type' : 'x-type'}">
                    <ion-icon name="${isZ ? 'lock-closed' : 'print'}"></ion-icon>
                </div>
                <div class="history-info">
                    <div class="history-title date">${isZ ? 'Cierre Diario (Z)' : 'Reporte X'}</div>
                    <div class="history-date">${dateStr}</div>
                </div>
                <div class="history-total">
                    <div>$${c.total_usd.toFixed(2)}</div>
                    <small>Bs ${c.total_bs.toFixed(2)}</small>
                </div>
             </div>
             `;
        }).join("") || `
            <div class="empty-state">
                <ion-icon name="time-outline"></ion-icon>
                <p>No hay registro de cierres</p>
            </div>
        `;
    }

    function renderPieCharts() {
        const ctxSales = document.getElementById('salesPieChart')?.getContext('2d');
        const ctxProds = document.getElementById('productsPieChart')?.getContext('2d');
        if (!ctxSales || !ctxProds) return;

        // Data for Sales ($)
        const salesData = {};
        movements.filter(m => m.type === 'out').forEach(m => {
            const p = products.find(prod => prod.id === m.productId);
            const name = p ? p.name : 'Desconocido';
            salesData[name] = (salesData[name] || 0) + m.total;
        });

        // Data for Products (Kg)
        const prodKgData = {};
        movements.filter(m => m.type === 'out').forEach(m => {
            const p = products.find(prod => prod.id === m.productId);
            const name = p ? p.name : 'Desconocido';
            prodKgData[name] = (prodKgData[name] || 0) + m.quantity;
        });

        const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

        // Sales Pie Chart
        if (salesChart) salesChart.destroy();
        salesChart = new Chart(ctxSales, {
            type: 'doughnut',
            data: {
                labels: Object.keys(salesData),
                datasets: [{
                    data: Object.values(salesData),
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#A0A0A0', font: { size: 10 } } }
                },
                cutout: '70%'
            }
        });

        // Products Pie Chart
        if (productsChart) productsChart.destroy();
        productsChart = new Chart(ctxProds, {
            type: 'pie',
            data: {
                labels: Object.keys(prodKgData),
                datasets: [{
                    data: Object.values(prodKgData),
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#A0A0A0', font: { size: 10 } } }
                }
            }
        });
    }

    // Window functions
    window.processDayClosure = () => {
        const t = new Date().toISOString().split('T')[0], m = movements.filter(x => x.date.startsWith(t));
        const s = m.filter(x => x.type === 'out').reduce((a, b) => a + b.total, 0);
        const c = m.filter(x => x.type === 'in' || x.type === 'expense' || x.type === 'waste').reduce((a, b) => a + b.total, 0);
        const profit = s - c;

        // Breakdown for today
        const typesMap = {
            'cash_usd': 'Dólares ($)',
            'cash_bs': 'Efectivo (Bs)',
            'mobile_pay': 'Pago Móvil',
            'transfer': 'Transferencia',
            'zelle': 'Zelle',
            'debt': 'Fiado (Crédito)'
        };
        const expenseTotals = {};
        const totals = m.reduce((acc, mov) => {
            if (mov.type === 'out') {
                const key = mov.payMethod === 'debt' ? 'debt' : (mov.payType || 'cash_usd');
                acc[key] = (acc[key] || 0) + mov.total;
            } else if (mov.type === 'expense') {
                const key = mov.payType || 'cash_usd';
                acc[key] = (acc[key] || 0) - mov.total; // Subtract from cash totals in closure

                const cat = mov.category || 'Otros';
                expenseTotals[cat] = (expenseTotals[cat] || 0) + mov.total;
            }
            return acc;
        }, {});

        const expensesBreakdownHtml = Object.keys(expenseTotals).map(cat => `
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-top:3px; color:var(--text-secondary);">
            <span>• ${cat}</span>
            <span>$${expenseTotals[cat].toFixed(2)}</span>
        </div>
    `).join('');

        const breakdownHtml = Object.keys(typesMap).map(k => {
            const val = totals[k] || 0;
            if (val === 0) return '';
            return `
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-top:5px; color:var(--text-primary);">
                <span>${typesMap[k]}</span>
                <span style="font-weight:600;">$${val.toFixed(2)} <span style="color:var(--primary-color); font-weight:400;">(Bs ${(val * bcvRate).toFixed(2)})</span></span>
            </div>
        `;
        }).join('');

        document.getElementById('closure-results').innerHTML = `
        <div class="summary-item">
            <span>Ventas Totales:</span>
            <div style="text-align:right">
                <strong>$${s.toFixed(2)}</strong><br>
                <small class="sub-val" style="color:var(--primary-color)">Bs ${(s * bcvRate).toFixed(2)}</small>
            </div>
        </div>

        <div style="margin: 10px 0 20px 0; padding: 12px; background: rgba(0,122,255,0.05); border-radius: 12px; border: 0.5px solid rgba(0,122,255,0.1);">
            <div style="font-size:0.65rem; color:var(--primary-color); text-transform:uppercase; font-weight:800; letter-spacing:0.5px; margin-bottom:8px;">Detalle de Ingresos</div>
            ${breakdownHtml || '<small style="color:var(--text-secondary)">No hubo ventas hoy</small>'}
        </div>

        <div class="summary-item" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; width:100%;">
                <span>Gastos/Costos:</span>
                <div style="text-align:right">
                    <strong>$${c.toFixed(2)}</strong><br>
                    <small class="sub-val">Bs ${(c * bcvRate).toFixed(2)}</small>
                </div>
            </div>
            ${expensesBreakdownHtml ? `<div style="margin-top:5px; padding-left:10px; border-left:2px solid var(--danger-color);">${expensesBreakdownHtml}</div>` : ''}
        </div>
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 15px 0;">
        <div class="summary-item">
            <span>Ganancia Neta:</span>
            <div style="text-align:right">
                <strong style="color: var(--primary-color); font-size: 1.3rem; letter-spacing:-0.5px;">$${profit.toFixed(2)}</strong><br>
                <small class="sub-val" style="font-weight:bold; font-size:0.9rem;">Bs ${(profit * bcvRate).toFixed(2)}</small>
            </div>
        </div>
    `;
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
        document.body.classList.add('modal-open');
        // For mobile: scroll to top of modal immediately
        document.getElementById(id).scrollTop = 0;
    };
    window.closeModal = (id) => {
        document.getElementById(id).classList.remove('open');
        document.body.classList.remove('modal-open');
    };
    async function shareFile(base64Data, fileName, mimeType) {
        try {
            // Safely check for native Capacitor
            if (typeof window.Capacitor === 'undefined') {
                throw new Error("Capacitor nativo no disponible (Modo Web)");
            }
            const { Filesystem, Share } = window.Capacitor.Plugins;

            // Save to Cache using String Literal 'CACHE' because Directory enum might not be available
            const result = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: 'CACHE'
            });

            console.log("File saved to:", result.uri);

            // Share
            await Share.share({
                title: 'Reporte Frutix',
                text: 'Aquí tienes el reporte solicitado.',
                url: result.uri,
                dialogTitle: 'Compartir con...'
            });

        } catch (e) {
            console.error("Native share error:", e);
            window.showToast("Error al compartir: " + e.message, 'error');
            // Browser fallback
            const link = document.createElement('a');
            link.download = fileName;
            link.href = `data:${mimeType};base64,${base64Data}`;
            link.click();
        }
    }

    window.exportToPNG = async () => {
        const element = document.getElementById('closure-modal').querySelector('.modal-content');
        const footer = element.querySelector('.modal-footer-btns');
        // Hide footer for capture
        if (footer) footer.style.display = 'none';

        // Add Branding
        const branding = document.createElement('div');
        branding.innerHTML = `<h2 style="color:#10B981; margin-bottom:10px;">Frutix Report</h2><p style="color:#666; font-size:12px;">${new Date().toLocaleString()}</p>`;
        branding.style.marginBottom = '20px';
        branding.style.textAlign = 'center';
        element.prepend(branding);

        try {
            window.showToast("Generando imagen...", 'info');
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });

            const base64Data = canvas.toDataURL('image/png').split(',')[1];
            await shareFile(base64Data, `reporte_frutix_${new Date().getTime()}.png`, 'image/png');

        } catch (err) {
            console.error(err);
            window.showToast("Error generar imagen: " + err.message, 'error');
        } finally {
            if (footer) footer.style.display = 'flex';
            branding.remove();
        }
    };

    window.exportToPDF = async (type = 'X') => {
        try {
            const reportName = type === 'Z' ? "REPORTE Z (Cierre)" : "REPORTE X (Parcial)";
            window.showToast(`Generando ${reportName}...`, 'info');

            // Safe access to jsPDF for Android Webview
            const { jsPDF } = window.jspdf || window.jsPDF;
            if (!jsPDF) throw new Error("Librería PDF no cargada");

            const doc = new jsPDF();

            // --- 1. SAVE HISTORY TO FIREBASE (ONLY IF Z REPORT) ---
            if (type === 'Z') {
                try {
                    const closureData = {
                        date: new Date().toISOString(),
                        total_usd: parseFloat(document.querySelector('#closure-results strong').innerText.replace('$', '')),
                        total_bs: parseFloat(document.querySelector('#closure-results .sub-val').innerText.replace('Bs ', '')),
                        details: document.getElementById('closure-results').innerText,
                        type: 'Z'
                    };

                    // Save to 'closures' collection
                    await db.collection('users').doc(currentUser.uid).collection('closures').add(closureData);
                    console.log("Cierre Z guardado en historial");
                    window.showToast("Cierre Z guardado en Historial", 'success');
                } catch (e) {
                    console.error("Error guardando historial", e);
                }
            }

            // --- 2. GENERATE PROFESSIONAL PDF ---
            // Colors
            const primaryColor = type === 'Z' ? [16, 185, 129] : [245, 158, 11]; // Green for Z, Orange for X
            const darkColor = [33, 33, 33];

            // Branding Header
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, 210, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(26);
            doc.setFont(undefined, 'bold');
            doc.text(`Frutix - ${type === 'Z' ? 'Cierre Z' : 'Reporte X'}`, 14, 25);

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Generado: ${new Date().toLocaleString()} | Tipo: ${type}`, 14, 35);

            // Fetch Data from DOM (or re-calculate for precision if available)
            // Using DOM scraping for consistency with viewed modal
            let yPos = 60;

            doc.setTextColor(...darkColor);
            doc.setFontSize(14);
            doc.text("Resumen de Transacciones", 14, 50);
            doc.setDrawColor(200);
            doc.line(14, 52, 196, 52);

            // Helper for row
            const addRow = (label, valUsd, valBs, isBold = false) => {
                if (yPos > 270) { doc.addPage(); yPos = 20; }

                doc.setFont(undefined, isBold ? 'bold' : 'normal');
                doc.setFontSize(12);
                doc.text(label, 14, yPos);

                if (valUsd) doc.text(valUsd, 140, yPos, { align: 'right' });
                if (valBs) {
                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(valBs, 196, yPos, { align: 'right' });
                    doc.setTextColor(...darkColor);
                }

                yPos += 10;
                doc.setDrawColor(240);
                doc.line(14, yPos - 6, 196, yPos - 6); // separator
            };

            // Parse items manually for cleaner layout
            const totalUSD = document.querySelector('#closure-results strong').innerText;
            const totalBS = document.querySelector('#closure-results .sub-val').innerText;

            addRow("Ventas Totales", totalUSD, totalBS, true);

            // Spacer
            yPos += 5;
            doc.setFontSize(10);
            doc.setTextColor(...primaryColor);
            doc.text("DETALLE DE MOVIMIENTOS", 14, yPos);
            yPos += 8;

            const content = document.getElementById('closure-results').innerText;
            const lines = content.split('\n');

            lines.forEach(line => {
                const l = line.trim();
                // Filter out main totals to avoid duplication
                if (!l || l.includes('Ventas Totales') || l === totalUSD || l === totalBS || l.includes('Bs ' + totalBS.replace('Bs ', ''))) return;

                if (l.length > 2) {
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(60);
                    doc.text(l, 14, yPos);
                    yPos += 6;
                }
            });

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150);
            const footerText = type === 'Z' ? "CIERRE PROCESADO - Frutix Inventory" : "CORTE PARCIAL (NO FISCAL) - Frutix Inventory";
            doc.text(footerText, 105, 290, { align: 'center' });

            const pdfBase64 = doc.output('datauristring').split(',')[1];
            await shareFile(pdfBase64, `reporte_${type}_${new Date().getTime()}.pdf`, 'application/pdf');

        } catch (err) {
            console.error(err);
            window.showToast("Error generar PDF: " + err.message, 'error');
        }
    };

    function setTxt(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }

    window.toggleMovementFields = () => {
        const type = document.getElementById('movement-type').value;
        const payMethod = document.getElementById('movement-payment-method').value;

        const prodField = document.getElementById('product-select-field');
        const reasonField = document.getElementById('expense-reason-field');
        const payMethodField = document.getElementById('payment-method-field');
        const clientNameField = document.getElementById('client-name-field');
        const clientPhoneField = document.getElementById('client-phone-field');
        const paymentTypeField = document.getElementById('payment-type-field');
        const supplierField = document.getElementById('supplier-select-field');
        const refField = document.getElementById('reference-field');
        const deliveryField = document.getElementById('delivery-field');
        const notesField = document.getElementById('notes-field');
        const expenseCategoryField = document.getElementById('expense-category-field');

        // Default hidden
        prodField.classList.remove('hidden');
        reasonField.classList.add('hidden');
        payMethodField.classList.add('hidden');
        clientNameField.classList.add('hidden');
        clientPhoneField.classList.add('hidden');
        paymentTypeField.classList.add('hidden');
        supplierField.classList.add('hidden');
        refField.classList.add('hidden');
        deliveryField.classList.add('hidden');
        notesField.classList.add('hidden');
        expenseCategoryField.classList.add('hidden');

        const paymentType = document.getElementById('movement-payment-type').value;

        if (type === 'out') {
            payMethodField.classList.remove('hidden');
            document.getElementById('discount-field').classList.remove('hidden');
            document.getElementById('sale-mode-field').classList.remove('hidden');
            deliveryField.classList.remove('hidden');
            notesField.classList.remove('hidden'); // Notes always for sales

            if (payMethod === 'debt') {
                clientNameField.classList.remove('hidden');
                clientPhoneField.classList.remove('hidden');
            } else {
                paymentTypeField.classList.remove('hidden');
                // Show Reference for digital payments
                if (['mobile_pay', 'transfer', 'zelle'].includes(paymentType)) {
                    refField.classList.remove('hidden');
                }
            }
        } else if (type === 'in') {
            supplierField.classList.remove('hidden');
            document.getElementById('discount-field').classList.add('hidden');
            document.getElementById('sale-mode-field').classList.add('hidden');
        } else if (type === 'expense') {
            prodField.classList.add('hidden');
            expenseCategoryField.classList.remove('hidden');
            reasonField.classList.remove('hidden');
            paymentTypeField.classList.remove('hidden');
            // Show Reference for digital expenses
            if (['mobile_pay', 'transfer', 'zelle'].includes(paymentType)) {
                refField.classList.remove('hidden');
            }
            document.getElementById('discount-field').classList.add('hidden');
            document.getElementById('sale-mode-field').classList.add('hidden');
        }
        window.updateMovInfo();
    };

    window.updateMovInfo = () => {
        const type = document.getElementById('movement-type').value;
        const pid = document.getElementById('movement-product-select').value;
        const saleModeEl = document.getElementById('movement-sale-mode');
        const saleMode = saleModeEl.value;
        const qtyVal = parseFloat(document.getElementById('mov-qty').value) || 0;
        const discount = parseFloat(document.getElementById('mov-discount').value) || 0;
        const receivedVal = parseFloat(document.getElementById('mov-received').value) || 0;

        const p = products.find(x => x.id === pid);
        const currentUnit = p?.unitType || 'Kg';

        // Dynamic Labels
        const qtyLabel = document.getElementById('quantity-label');
        qtyLabel.textContent = (type === 'out' && saleMode === 'amount') ? 'Monto a Vender ($)' : `Cantidad (${currentUnit})`;

        // Dynamic Dropdown Text
        if (p) {
            saleModeEl.options[0].text = currentUnit === 'Und' ? 'Por Unidad' : 'Por Peso (Kg)';
        }

        const infoBox = document.getElementById('sale-info');
        const priceEl = document.getElementById('info-price');
        const totalEl = document.getElementById('info-total');
        const totalBsEl = document.getElementById('info-total-bs');
        const changeInfo = document.getElementById('change-info');
        const changeUsdEl = document.getElementById('info-change-usd');
        const changeBsEl = document.getElementById('info-change-bs');

        if (type === 'out' && p) {
            infoBox.style.display = 'block';
            let subtotal, calculatedKg;

            priceEl.textContent = p.price.toFixed(2);

            let totalUSD = 0;
            const delivery = parseFloat(document.getElementById('mov-delivery').value) || 0;

            if (saleMode === 'amount') {
                calculatedKg = qtyVal / p.price;
                subtotal = qtyVal;
                totalUSD = Math.max(0, subtotal - discount) + delivery;
            } else {
                calculatedKg = qtyVal; // Direct weight/unit
                subtotal = qtyVal * p.price;
                totalUSD = Math.max(0, subtotal - discount) + delivery;
            }

            // Stock Validation
            const qtyInput = document.getElementById('mov-qty');
            if (calculatedKg > p.stock) {
                qtyInput.style.borderColor = 'red';
                qtyInput.style.color = 'red';
                // Optional: trigger shake or tooltip? Simple red is fast.
            } else {
                qtyInput.style.borderColor = ''; // reset
                qtyInput.style.color = '';
            }

            totalEl.textContent = totalUSD.toFixed(2);
            if (totalBsEl) totalBsEl.textContent = `Bs ${(totalUSD * bcvRate).toFixed(2)}`;

            // Change Logic
            if (receivedVal > totalUSD) {
                const change = receivedVal - totalUSD;
                changeInfo.style.display = 'block';
                changeUsdEl.textContent = `$${change.toFixed(2)}`;
                changeBsEl.textContent = `Bs ${(change * bcvRate).toFixed(2)}`;
            } else {
                changeInfo.style.display = 'none';
            }

        } else if (type === 'in' && p) {
            infoBox.style.display = 'block';
            const total = qtyVal * p.cost;
            infoBox.innerHTML = `Costo Unitario: $${p.cost.toFixed(2)}<br>Total a Pagar: $${total.toFixed(2)}`;
        } else {
            infoBox.style.display = 'none';
        }
    };

    // --- NEW: Safe Modal Opener ---
    window.openAddMovementModal = () => {
        document.getElementById('add-movement-form').reset();

        // Ensure defaults
        document.getElementById('movement-type').value = 'out';
        document.getElementById('movement-payment-method').value = 'cash';

        // Force UI update
        window.toggleMovementFields();
        window.updateMovInfo();

        window.openModal('add-movement-modal');
    };

    window.generateMarketingCard = (id) => {
        const p = products.find(x => x.id === id);
        if (!p) return;

        document.getElementById('marketing-img').src = p.imageUrl || 'logo.png';
        document.getElementById('marketing-name').textContent = p.name;
        document.getElementById('marketing-price-usd').textContent = `$${p.price.toFixed(2)}`;
        document.getElementById('marketing-price-bs').textContent = `Bs ${(p.price * bcvRate).toFixed(2)}`;

        window.openModal('status-modal');
    };

    window.downloadMarketingCard = async () => {
        const card = document.getElementById('marketing-card');
        const canvas = await html2canvas(card, { scale: 2, useCORS: true });
        const link = document.createElement('a');
        link.download = `oferta_frutix_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    window.renderClients = () => {
        const list = document.getElementById('clients-list');
        const search = document.getElementById('clients-search').value.toLowerCase();
        if (!list) return;

        const filtered = clients.filter(c => c.name.toLowerCase().includes(search) || c.phone.includes(search));

        list.innerHTML = filtered.map(c => `
        <div class="inventory-item">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="icon-box" style="background:rgba(0,122,255,0.1); color:var(--primary-color);">
                    <ion-icon name="person-outline"></ion-icon>
                </div>
                <div class="item-info">
                    <h4>${c.name}</h4>
                    <small style="color:var(--text-secondary)">${c.phone || 'Sin teléfono'}</small>
                </div>
            </div>
            <div class="actions-row">
                <a href="https://wa.me/${(c.phone || '').replace(/\D/g, '')}" target="_blank" class="icon-btn" style="color:#25D366; font-size:1.5rem;">
                    <ion-icon name="logo-whatsapp"></ion-icon>
                </a>
                <button class="btn-delete" onclick="deleteItem('clients', '${c.id}')"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
        </div>
    `).join("") || '<p class="empty-state">No hay clientes registrados</p>';
    };

    // --- PRODUCT DETAIL & QUICK STOCK LOGIC ---
    window.openProductDetail = (id) => {
        const p = products.find(x => x.id === id);
        if (!p) return;

        // Populate modal
        document.getElementById('detail-image-container').innerHTML = p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<ion-icon name="image-outline" style="font-size:3rem; color:#ccc;"></ion-icon>`;
        document.getElementById('detail-name').innerText = p.name;
        document.getElementById('detail-code').innerText = p.code || 'Sin código';
        document.getElementById('detail-price').innerText = `$${p.price.toFixed(2)}`;
        document.getElementById('detail-price-bs').innerText = `Bs ${(p.price * bcvRate).toFixed(2)}`;
        document.getElementById('detail-stock').innerText = p.stock.toFixed(1);
        document.getElementById('detail-unit').innerText = p.unitType || 'Kg';
        document.getElementById('detail-product-id').value = p.id;
        document.getElementById('quick-add-qty').value = '';

        // Populate Price Update Fields
        document.getElementById('detail-edit-cost').value = p.cost;
        document.getElementById('detail-edit-price').value = p.price;

        // Init Monitor
        window.updatePriceMonitor();

        window.openModal('product-detail-modal');
    };

    window.submitQuickStock = async () => {
        const id = document.getElementById('detail-product-id').value;
        const qty = parseFloat(document.getElementById('quick-add-qty').value);
        if (!qty || qty <= 0) return window.showToast("Ingresa una cantidad válida", "error");

        const p = products.find(x => x.id === id);
        if (!p) return;

        try {
            // 1. Update Stock
            const userRef = db.collection('users').doc(currentUser.uid);
            await userRef.collection('products').doc(id).update({
                stock: p.stock + qty
            });

            // 2. Register Movement (Entry)
            await userRef.collection('movements').add({
                productId: id,
                type: 'in', // entry
                quantity: qty,
                total: p.cost * qty, // Cost value
                date: new Date().toISOString(),
                unitType: p.unitType || 'Kg' // store unit
            });

            window.showToast(`Stock actualizado (+${qty})`, 'success');
            window.closeModal('product-detail-modal');
        } catch (e) {
            console.error(e);
            window.showToast("Error al actualizar stock", "error");
        }
    };

    window.submitPriceUpdate = async () => {
        const id = document.getElementById('detail-product-id').value;
        const newCost = parseFloat(document.getElementById('detail-edit-cost').value);
        const newPrice = parseFloat(document.getElementById('detail-edit-price').value);

        if (isNaN(newCost) || isNaN(newPrice) || newCost < 0 || newPrice < 0) {
            return window.showToast("Precios inválidos", "error");
        }

        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            await userRef.collection('products').doc(id).update({
                cost: newCost,
                price: newPrice
            });

            window.showToast("Precios Actualizados", "success");
            window.closeModal('product-detail-modal');
        } catch (e) {
            console.error(e);
            window.showToast("Error al guardar precios", "error");
        }
    };

    window.updatePriceMonitor = () => {
        const cost = parseFloat(document.getElementById('detail-edit-cost').value) || 0;
        const price = parseFloat(document.getElementById('detail-edit-price').value) || 0;
        const monitor = document.getElementById('price-monitor');

        if (cost <= 0 && price <= 0) {
            monitor.style.display = 'none';
            return;
        }
        monitor.style.display = 'block';

        // Calculate Margin
        let margin = 0;
        if (price > 0 && cost > 0) {
            margin = ((price - cost) / price) * 100;
        }

        // Calculate Bs
        const bsPrice = price * bcvRate;

        // Update DOM
        const marginEl = document.getElementById('monitor-margin');
        const bsEl = document.getElementById('monitor-bs');
        const bsLabel = document.getElementById('monitor-bs-label');

        marginEl.innerText = `${margin.toFixed(1)}% ($${(price - cost).toFixed(2)})`;
        if (bsLabel) bsLabel.innerText = `Oficial BCV (Tasa ${bcvRate.toFixed(2)}):`;
        bsEl.innerText = `Bs ${bsPrice.toFixed(2)}`;

        // Color Logic
        if (margin < 15) marginEl.style.color = '#FF3B30'; // Red - Low Margin
        else if (margin < 30) marginEl.style.color = '#FF9500'; // Orange - Medium Margin
        else marginEl.style.color = '#34C759'; // Green - Good Margin
    };

    window.renderCatalog = () => {
        const list = document.getElementById('catalog-list');
        const search = document.getElementById('catalog-search') ? document.getElementById('catalog-search').value.toLowerCase() : '';
        if (!list) return;

        const filtered = products.filter(p => (p.inCatalog !== false) && (p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search))));

        list.innerHTML = filtered.map(p => `
        <div class="marketing-card" style="width:100%; height:auto; min-height:200px; box-shadow:0 4px 15px rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.05);">
            <div style="height:120px; overflow:hidden; border-radius:15px; background:#f5f5f7; position:relative;">
                <img src="${p.imageUrl || 'logo.png'}" style="width:100%; height:100%; object-fit:cover;">
                <div style="position:absolute; top:8px; right:8px; background:rgba(255,255,255,0.9); padding:4px 8px; border-radius:10px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                    $${p.price.toFixed(2)}
                </div>
            </div>
            <div style="padding:10px 5px;">
                <h4 style="margin:0; font-size:0.9rem; font-weight:700;">${p.name}</h4>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                    <span style="font-size:0.8rem; color:var(--text-secondary);">Bs ${(p.price * bcvRate).toFixed(2)}</span>
                    <button onclick="window.generateMarketingCard('${p.id}')" style="background:transparent; border:none; color:var(--primary-color);">
                        <ion-icon name="share-outline"></ion-icon>
                    </button>
                </div>
            </div>
        </div>
        `).join("") || '<div class="empty-state" style="grid-column: 1/-1;">No hay productos en el catálogo</div>';
    };

    window.renderOrders = () => {
        const list = document.getElementById('orders-list');
        if (!list) return;

        list.innerHTML = orders.map(o => {
            const isDone = o.status === 'done';
            return `
            <div class="movement-card" style="opacity: ${isDone ? 0.6 : 1}; ${isDone ? 'border-left: 4px solid #34C759;' : 'border-left: 4px solid #FF9500;'}">
                <div style="display:flex; justify-content: space-between; align-items: start; width: 100%;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="icon-box ${isDone ? 'green' : 'orange'}" style="background: ${isDone ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)'}; color: ${isDone ? '#34C759' : '#FF9500'};">
                            <ion-icon name="${isDone ? 'checkmark-done-outline' : 'hourglass-outline'}"></ion-icon>
                        </div>
                        <div>
                            <strong style="${isDone ? 'text-decoration: line-through;' : ''}">${o.productName}</strong><br>
                            <small style="color:var(--text-secondary)">Cliente: ${o.customerInfo} ${o.estimatedQty ? ' | ' + o.estimatedQty : ''}</small>
                        </div>
                    </div>
                    <div style="display:flex; gap: 8px;">
                        ${!isDone ? `
                            <button onclick="window.fulfillOrder('${o.id}')" class="icon-btn" style="color:#34C759; font-size: 1.4rem;" title="Marcar como Recibido">
                                <ion-icon name="checkmark-circle-outline"></ion-icon>
                            </button>
                        ` : ''}
                        <button onclick="window.deleteItem('orders', '${o.id}')" class="icon-btn" style="color:var(--danger-color); font-size: 1.4rem;">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                    </div>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 8px;">
                    Solicitado el ${new Date(o.date).toLocaleDateString()}
                </div>
            </div>
        `;
        }).join("") || '<p class="empty-state">No hay pedidos especiales pendientes</p>';
    };

    window.fulfillOrder = (id) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        db.collection('users').doc(currentUser.uid).collection('orders').doc(id).update({ status: 'done' });

        if (confirm(`¿Deseas agregar "${order.productName}" al inventario ahora?`)) {
            window.openModal('add-product-modal');
            const form = document.getElementById('add-product-form');
            if (form) {
                form.elements['name'].value = order.productName;
                // Focus on cost field to continue filling
                setTimeout(() => form.elements['cost'].focus(), 500);
            }
        }
    };

    window.filterMovements = (f) => {
        currentMovFilter = f;
        renderMovements();
    };

    window.exportToExcel = () => {
        const dataProducts = products.map(p => ({
            Nombre: p.name,
            Codigo: p.code,
            Costo: p.cost,
            Precio: p.price,
            Stock: p.stock
        }));

        const dataMovements = movements.map(m => {
            const p = products.find(x => x.id === m.productId);
            return {
                Fecha: new Date(m.date).toLocaleString(),
                Producto: p ? p.name : '---',
                Tipo: m.type === 'in' ? 'Entrada' : (m.type === 'out' ? 'Venta' : 'Merma'),
                Cantidad: m.quantity,
                Total: m.total,
                Metodo: m.payMethod || 'Efectivo'
            };
        });

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(dataProducts);
        const ws2 = XLSX.utils.json_to_sheet(dataMovements);

        XLSX.utils.book_append_sheet(wb, ws1, "Inventario");
        XLSX.utils.book_append_sheet(wb, ws2, "Movimientos");

        XLSX.writeFile(wb, `Respaldo_Frutix_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    window.sendWhatsAppReceipt = () => {
        const text = document.getElementById('receipt-content').innerText;
        const phone = document.getElementById('receipt-phone').value.replace(/\D/g, '');
        if (!phone) return window.showToast("Por favor ingresa un número de teléfono", 'error');
        const link = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(link, '_blank');
        window.closeModal('receipt-modal');
    };

    window.shareCatalog = async () => {
        // If we are in the Android app (localhost), we need a real public URL to share
        let url = window.publicCatalogUrl;

        if (!url || url.includes('localhost')) {
            const inputUrl = prompt("Ingresa el enlace público de tu catálogo de GitHub (ej: https://tronstheking.github.io/Frutix/):", url);
            if (inputUrl) {
                url = inputUrl;
                // Save for future use
                const userRef = db.collection('users').doc(currentUser.uid);
                await userRef.collection('settings').doc('global').set({ publicCatalogUrl: url }, { merge: true });
            } else {
                return;
            }
        }

        const shareText = `🍎 *CATÁLOGO FRUTIX*\n\nHola! Te comparto nuestro catálogo de productos actualizado con los precios del día.\n\n🔗 Ver catálogo aquí: ${url}\n\n¡Esperamos tu pedido! 🍉`;

        // Use Web Share API if available (native Android sharing)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Catálogo Frutix',
                    text: shareText,
                    url: url
                });
            } catch (err) {
                console.log("Error sharing:", err);
                // Fallback to WhatsApp
                window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
            }
        } else {
            // Desktop / Browser Fallback
            window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
        }
    };
};
