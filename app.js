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

let products = [], movements = [], debts = [], suppliers = [], clients = [], orders = [], bcvRate = 45.0, currentUser = null;
let salesChart = null, productsChart = null, currentMovFilter = 'all';

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
            } else {
                alert("Error: " + err.message);
            }
            btn.disabled = false;
            btn.innerText = isReg ? "REGISTRARME" : "ENTRAR";
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
    userRef.collection('movements').orderBy('date', 'desc').limit(1000).onSnapshot(s => { movements = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
    userRef.collection('debts').onSnapshot(s => { debts = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
    userRef.collection('suppliers').onSnapshot(s => { suppliers = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
    userRef.collection('clients').onSnapshot(s => { clients = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
    userRef.collection('orders').orderBy('date', 'desc').onSnapshot(s => { orders = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
}

function initApp() {
    const userRef = db.collection('users').doc(currentUser.uid);
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
        document.querySelectorAll('.nav-item, .page').forEach(el => el.classList.remove('active'));
        document.getElementById(b.dataset.target).classList.add('active');
        b.classList.add('active');
    });

    document.getElementById('logout-btn').onclick = () => auth.signOut().then(() => window.location.reload());

    // Theme toggle removed per user request
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.style.display = 'none';

    const bcvInput = document.getElementById('bcv-rate');
    if (bcvInput) bcvInput.onchange = (e) => userRef.collection('settings').doc('global').set({ bcvRate: parseFloat(e.target.value) || 0 }, { merge: true });

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
            imageUrl: imageUrl
        };
        const d = await userRef.collection('products').add(data);
        if (data.stock > 0) await userRef.collection('movements').add({ productId: d.id, type: 'in', quantity: data.stock, total: data.stock * data.cost, date: new Date().toISOString() });
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
        window.closeModal('add-order-modal'); e.target.reset();
    };

    document.getElementById('add-movement-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const type = fd.get('type'), pid = fd.get('product_id'), qty = parseFloat(fd.get('quantity'));

        let total = 0;
        let dataToSave = {
            type,
            quantity: qty,
            date: new Date().toISOString(),
            payMethod: fd.get('payment_method') || 'cash',
            payType: fd.get('payment_type') || '',
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
            if (type !== 'in' && p.stock < qty) return alert("Stock insuficiente");

            const discount = parseFloat(fd.get('discount')) || 0;
            total = type === 'out' ? (qty * p.price) - discount : qty * p.cost;
            dataToSave.productId = pid;
            dataToSave.total = total;
            dataToSave.discount = discount;

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
                const receiptText = `🧾 *RECIBO DE VENTA - FRUTIX*\n----------------------------\n🍎 Producto: ${p.name}\n⚖️ Cantidad: ${qty} Kg\n💵 Subtotal: $${(qty * p.price).toFixed(2)}${discountText}\n💰 TOTAL: $${total.toFixed(2)}\n📅 Fecha: ${new Date().toLocaleString()}\n----------------------------\n¡Gracias por su compra! 🍉`;
                document.getElementById('receipt-content').innerText = receiptText;
                document.getElementById('receipt-phone').value = fd.get('client_phone') || '';
                window.openModal('receipt-modal');
            }
        }

        await userRef.collection('movements').add(dataToSave);
        window.closeModal('add-movement-modal'); e.target.reset();
        window.toggleMovementFields(); // Reset fields visibility
    };
}

function renderAll() {
    renderDashboard();
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
    const costs = todayMovs.filter(m => m.type === 'in' || m.type === 'expense').reduce((a, b) => a + b.total, 0);
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
                        ${lowStockProds.map(p => `• <strong>${p.name}</strong>: solo quedan ${p.stock.toFixed(1)} Kg`).join('<br>')}
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
            <div class="inventory-item">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${imgHtml}
                    <div class="item-info">
                        <h4>${p.name}</h4>
                        <small style="color:var(--text-secondary)">${p.code ? 'Cod: ' + p.code + ' | ' : ''} C: $${p.cost} | V: $${p.price}</small>
                    </div>
                </div>
                <div class="actions-row">
                    <div style="text-align:right">
                        <strong style="color:var(--primary-color);">${p.stock.toFixed(1)} Kg</strong>
                    </div>
                    <button class="btn-delete" onclick="deleteItem('products', '${p.id}')"><ion-icon name="trash-outline"></ion-icon></button>
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
        if (dateFilter) {
            matchDate = m.date.startsWith(dateFilter);
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
                        <strong class="${m.type === 'in' ? 'text-green' : 'text-red'}">${m.type === 'in' ? '+' : '-'}${m.type === 'expense' ? '$' + m.total.toFixed(2) : m.quantity + ' Kg'}</strong><br>
                        ${m.type !== 'expense' ? `<small style="color:var(--text-secondary)">$${m.total.toFixed(2)}</small>` : ''}
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
    setTxt('finance-total-sales', `$${s.toFixed(2)}`);
    setTxt('finance-total-costs', `$${c.toFixed(2)}`);
    setTxt('finance-balance', `$${(s - c).toFixed(2)}`);
    setTxt('finance-balance-bs', `Bs ${((s - c) * bcvRate).toFixed(2)}`);
    setTxt('finance-total-sales-bs', `Bs ${(s * bcvRate).toFixed(2)}`);
    setTxt('finance-total-costs-bs', `Bs ${(c * bcvRate).toFixed(2)}`);

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
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--card-bg); border-radius:16px; border: 0.5px solid var(--border-color); margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="icon-box" style="background:${types[key].color}15; color:${types[key].color}; margin:0; width:40px; height:40px; border-radius:12px;">
                            <ion-icon name="${types[key].icon}"></ion-icon>
                        </div>
                        <div>
                            <span style="font-size:0.9rem; font-weight:700; display:block;">${types[key].label}</span>
                            <small style="color:var(--text-secondary); font-size:0.75rem;">${pct}% del ingreso</small>
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

    list.innerHTML = products.map(p => {
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
    const c = m.filter(x => x.type === 'in' || x.type === 'expense').reduce((a, b) => a + b.total, 0);
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
};
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
window.exportToPNG = async () => {
    const element = document.getElementById('closure-modal').querySelector('.modal-content');
    const footer = element.querySelector('.modal-footer-btns');

    // Temporarily hide buttons for capture
    if (footer) footer.style.display = 'none';

    // Add branding for the image
    const branding = document.createElement('div');
    branding.innerHTML = `<h2 style="color:#10B981; margin-bottom:10px;">Frutix Inventory</h2><p style="color:#A0A0A0; font-size:12px; margin-bottom:20px;">Reporte de Cierre - ${new Date().toLocaleDateString()}</p>`;
    element.prepend(branding);

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: '#121212',
            scale: 2, // Higher quality
            borderRadius: 16
        });

        const link = document.createElement('a');
        link.download = `cierre_frutix_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error("Error al exportar imagen:", err);
        alert("No se pudo generar la imagen");
    } finally {
        if (footer) footer.style.display = 'flex';
        branding.remove();
    }
};

window.exportToPDF = () => { alert("Exportando a PDF..."); };

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

    // Default hidden
    prodField.classList.remove('hidden');
    reasonField.classList.add('hidden');
    payMethodField.classList.add('hidden');
    clientNameField.classList.add('hidden');
    clientPhoneField.classList.add('hidden');
    paymentTypeField.classList.add('hidden');
    supplierField.classList.add('hidden');

    if (type === 'out') {
        payMethodField.classList.remove('hidden');
        document.getElementById('discount-field').classList.remove('hidden');
        if (payMethod === 'debt') {
            clientNameField.classList.remove('hidden');
            clientPhoneField.classList.remove('hidden');
        } else {
            paymentTypeField.classList.remove('hidden');
        }
    } else if (type === 'in') {
        supplierField.classList.remove('hidden');
        document.getElementById('discount-field').classList.add('hidden');
    } else if (type === 'expense') {
        prodField.classList.add('hidden');
        document.getElementById('expense-category-field').classList.remove('hidden');
        reasonField.classList.remove('hidden');
        paymentTypeField.classList.remove('hidden');
        document.getElementById('discount-field').classList.add('hidden');
    }
    window.updateMovInfo();
};

window.updateMovInfo = () => {
    const type = document.getElementById('movement-type').value;
    const pid = document.getElementById('movement-product-select').value;
    const qty = parseFloat(document.getElementById('mov-qty').value) || 0;
    const discount = parseFloat(document.getElementById('mov-discount').value) || 0;

    const p = products.find(x => x.id === pid);
    const infoBox = document.getElementById('sale-info');

    if (type === 'out' && p) {
        infoBox.style.display = 'block';
        const subtotal = qty * p.price;
        const total = subtotal - discount;
        document.getElementById('info-price').textContent = p.price.toFixed(2);
        document.getElementById('info-total').textContent = total.toFixed(2);
    } else if (type === 'in' && p) {
        infoBox.style.display = 'block';
        const total = qty * p.cost;
        document.getElementById('info-price').textContent = p.cost.toFixed(2);
        document.getElementById('info-total').textContent = total.toFixed(2);
    } else {
        infoBox.style.display = 'none';
    }
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
    if (!phone) return alert("Por favor ingresa un número de teléfono");
    const link = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(link, '_blank');
    window.closeModal('receipt-modal');
};
