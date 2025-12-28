// dashboard.js - Control principal del dashboard

let currentSection = 'dashboard';
let salesByHourChart = null;
let topProductsChart = null;
let weeklySalesChart = null;
// API base desde panel.html (usar window.API_BASE directamente)
let editingCategoryId = null;
// Asegurar Chart.js si no cargó (fallback dinámico)
function ensureChartLoaded() {
    return new Promise((resolve, reject) => {
        if (typeof Chart !== 'undefined') return resolve();

        const src = 'https://cdn.jsdelivr.net/npm/chart.js';
        const existing = Array.from(document.getElementsByTagName('script')).find(s => s.src && s.src.includes('cdn.jsdelivr.net/npm/chart.js'));
        if (existing) {
            if (existing.onload) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Chart.js failed to load')));
            } else {
                // If script already present but not loaded yet
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Chart.js failed to load')));
            }
            return;
        }

        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Chart.js failed to load'));
        document.head.appendChild(s);
    });
}
// Cache para detectar si el endpoint /categories/:id soporta PUT/PATCH
const _updateMethodCache = {}; // id -> 'PUT' | 'PATCH' | 'NONE' | 'UNKNOWN'

async function detectUpdateMethod(id) {
    if (!id) return 'UNKNOWN';
    if (_updateMethodCache[id]) return _updateMethodCache[id];

    try {
        // Evitar OPTIONS/HEAD que pueden producir 405/404 en consola.
        // Usar la lista remota (o mock) para comprobar existencia y asumir PUT si existe.
        const categories = await fetchCategoriesList();
        const exists = categories && categories.some(c => String(c.id) === String(id));
        if (!exists) {
            _updateMethodCache[id] = 'NONE';
            return 'NONE';
        }
        _updateMethodCache[id] = 'PUT';
        return 'PUT';
    } catch (e) {
        _updateMethodCache[id] = 'UNKNOWN';
        return 'UNKNOWN';
    }
}

// Cache y detección para DELETE
const _deleteMethodCache = {}; // id -> 'DELETE' | 'POST_FALLBACK' | 'NONE' | 'UNKNOWN'

async function detectDeleteMethod(id) {
    if (!id) return 'UNKNOWN';
    if (_deleteMethodCache[id]) return _deleteMethodCache[id];

    try {
        // Evitar HEAD/OPTIONS que pueden generar 404 en consola.
        // Usar la lista de categorías (remote o mock) para decidir si el recurso existe.
        const categories = await fetchCategoriesList();
        const exists = categories && categories.some(c => String(c.id) === String(id));
        if (!exists) {
            _deleteMethodCache[id] = 'NONE';
            return 'NONE';
        }

        // Si existe en la lista remota asumimos que DELETE es la opción válida.
        _deleteMethodCache[id] = 'DELETE';
        return 'DELETE';
    } catch (e) {
        console.warn('detectDeleteMethod fallback error', e);
    }

    _deleteMethodCache[id] = 'UNKNOWN';
    return 'UNKNOWN';
}

// ================= FECHA ACTUAL =================
function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('es-ES', options);
    }
}

// ================= CAMBIO DE SECCIÓN =================
function showSection(sectionId) {
    document.querySelectorAll('.section-content').forEach(section => {
        section.classList.add('hidden');
    });

    const section = document.getElementById(`${sectionId}-section`);
    if (section) {
        section.classList.remove('hidden');
    }

    const titles = {
        dashboard: 'Dashboard',
        products: 'Gestión de Productos',
        promos: 'Promociones',
        reports: 'Reportes',
        categories: 'Categorías'
    };

    const titleEl = document.getElementById('section-title');
    if (titleEl) {
        titleEl.textContent = titles[sectionId] || sectionId;
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const navItem = document.querySelector(`.nav-item[onclick*="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    currentSection = sectionId;

    switch (sectionId) {
        case 'products':
            if (typeof loadProducts === 'function') {
                loadProducts();
                loadCategories();
            } else {
                console.error('productos.js no está cargado');
            }
            break;

        case 'promos':
            if (typeof loadPromos === 'function') {
                loadPromos();
            } else {
                console.error('promos.js no está cargado');
            }
            break;

        case 'categories':
            // Cargar y renderizar lista de categorías
            renderCategoriesList();
            break;

        case 'dashboard':
            loadDashboardData();
            break;
        case 'config':
            // render and load configuration
            loadSiteConfig();
            break;
    }
}

// ================== SITE CONFIG (horarios/días cerrados) ==================
async function loadSiteConfig() {
    // Try backend first
    let config = null;
    try {
        const res = await fetch(`${window.API_BASE}/site-config`);
        if (res.ok) {
            config = await res.json();
        }
    } catch (e) {
        console.warn('No se pudo obtener site-config desde API, usando localStorage');
    }

    if (!config) {
        try {
            const raw = localStorage.getItem('site_config');
            config = raw ? JSON.parse(raw) : null;
        } catch (e) {
            config = null;
        }
    }

    // Render into form
    const openInput = document.getElementById('config-open-time');
    const closeInput = document.getElementById('config-close-time');
    const daysContainer = document.getElementById('config-days');
    const closedDates = document.getElementById('config-closed-dates');

    if (config) {
        if (openInput) openInput.value = config.open_time || '';
        if (closeInput) closeInput.value = config.close_time || '';
        if (closedDates) closedDates.value = (config.closed_dates || []).join(',');
        if (daysContainer && Array.isArray(config.open_days)) {
            daysContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = config.open_days.includes(parseInt(cb.value));
            });
        }
    } else {
        if (openInput) openInput.value = '';
        if (closeInput) closeInput.value = '';
        if (closedDates) closedDates.value = '';
        if (daysContainer) daysContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    }

    const saveBtn = document.getElementById('save-config-btn');
    if (saveBtn && !saveBtn._bound) {
        saveBtn.addEventListener('click', saveSiteConfig);
        saveBtn._bound = true;
    }
}

async function saveSiteConfig() {
    const openInput = document.getElementById('config-open-time');
    const closeInput = document.getElementById('config-close-time');
    const daysContainer = document.getElementById('config-days');
    const closedDates = document.getElementById('config-closed-dates');

    const payload = {
        open_time: openInput && openInput.value ? openInput.value : null,
        close_time: closeInput && closeInput.value ? closeInput.value : null,
        open_days: [],
        closed_dates: []
    };

    if (daysContainer) {
        daysContainer.querySelectorAll('input[type="checkbox"]:checked')
            .forEach(cb => payload.open_days.push(Number(cb.value)));
    }

    if (closedDates && closedDates.value.trim()) {
        payload.closed_dates = closedDates.value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }

    try {
        const res = await fetch(`${window.API_BASE}/site-config`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw err;
        }

        showNotification('Configuración guardada correctamente', 'success');

    } catch (e) {
        console.error('Error guardando site-config:', e);
        localStorage.setItem('site_config', JSON.stringify(payload));
        showNotification('Configuración guardada localmente (error de API)', 'warning');
    }

    if (typeof fetchAndRenderSiteConfig === 'function') {
        fetchAndRenderSiteConfig();
    }
}


// ================= DASHBOARD DATA =================
async function loadDashboardData() {
    try {
        updateCurrentDate();

        const response = await fetch(`${window.API_BASE}/dashboard/stats`);
        if (!response.ok) {
            throw new Error('Error al obtener estadísticas del dashboard');
        }

        const data = await response.json();

        // ===== KPIs =====
        setText('sales-today', formatCurrencyARS(data.salesToday));
        if (data.salesYesterday === 0 && data.salesToday > 0) {
            setText('sales-trend', 'Nuevo día');
        } else {
            const trend = data.salesTrend ?? 0;
            setText(
                'sales-trend',
                `${trend > 0 ? '+' : ''}${trend}% vs ayer`
        );
}

        setText('orders-today', data.ordersToday ?? 0);
        setText('orders-trend', `${data.ordersTrend ?? 0}% vs ayer`);

        if (data.peakHour) {
            setText(
                'peak-hour',
                `${String(data.peakHour.hour).padStart(2, '0')}:00`
            );
            setText(
                'peak-orders',
                `${data.peakHour.total} pedidos`
            );
                // ===== GRÁFICOS =====
                // Cargar pedidos recientes y conteos delivery/pickup
                if (typeof loadRecentOrders === 'function') loadRecentOrders();
            setText('peak-hour', '--:--');
            setText('peak-orders', '0 pedidos');
        }


        // ================= PEDIDOS RECIENTES + ESTADÍSTICAS DE ENTREGA =================
        async function loadRecentOrders() {
            const container = document.getElementById('recent-orders');
            const countDeliveryEl = document.getElementById('count-delivery');
            const countPickupEl = document.getElementById('count-pickup');
            if (!container) return;

            try {
                const res = await fetch(`${window.API_BASE}/orders?limit=15`);
                if (!res.ok) {
                    container.innerHTML = '<div class="empty">No hay datos de pedidos</div>';
                    return;
                }

                const orders = await res.json();

                // Calcular counts (fallback a distintos nombres de campo)
                let deliveryCount = 0, pickupCount = 0;
                orders.forEach(o => {
                    const t = (o.delivery_type || o.type || o.delivery || '').toString().toLowerCase();
                    if (t.includes('domicilio') || t.includes('delivery') || t.includes('envio')) deliveryCount++;
                    else pickupCount++;
                });

                if (countDeliveryEl) countDeliveryEl.textContent = deliveryCount;
                if (countPickupEl) countPickupEl.textContent = pickupCount;

                // Render list of recent orders
                container.innerHTML = '';
                if (!orders || orders.length === 0) {
                    container.innerHTML = '<div class="empty">No hay pedidos recientes</div>';
                    return;
                }

                orders.forEach(o => {
                    const div = document.createElement('div');
                    div.className = 'recent-order-item';
                    const id = o.id || o.order_id || o.uuid || '';
                    const total = o.total ?? o.amount ?? o.price ?? 0;
                    const customer = o.customer_name || o.name || o.customer || '';
                    const t = o.delivery_type || o.type || o.delivery || '';
                    const when = o.created_at || o.date || '';

                    div.innerHTML = `
                        <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
                            <div style="flex:1">
                                <div style="font-weight:700">Pedido ${escapeHTML(String(id))} ${customer ? '– '+escapeHTML(customer) : ''}</div>
                                <div style="font-size:12px; color:#666">${escapeHTML(String(when))} • ${escapeHTML(String(t))}</div>
                            </div>
                            <div style="text-align:right">
                                <div style="font-weight:800">$ ${formatCurrencyARS(total)}</div>
                                <button class="small-btn" style="margin-top:6px;" onclick="openOrderDetail(${id ? '\''+String(id)+'\'' : 'null'}, ${encodeURIComponent(JSON.stringify(o))})">Ver</button>
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                });

            } catch (e) {
                console.error('loadRecentOrders error', e);
                container.innerHTML = '<div class="empty">Error cargando pedidos</div>';
            }
        }

        function openOrderDetail(id, orderEncoded) {
            // orderEncoded may be a stringified object or null; handle both
            let order = null;
            if (typeof orderEncoded === 'string') {
                try {
                    order = JSON.parse(decodeURIComponent(orderEncoded));
                } catch (e) { order = null; }
            } else if (typeof orderEncoded === 'object' && orderEncoded !== null) {
                order = orderEncoded;
            }

            // If we don't have order details, try fetching by id
            const modal = document.getElementById('order-detail-modal');
            const title = document.getElementById('order-id-title');
            const content = document.getElementById('order-detail-content');

            if (title) title.textContent = id ? `#${id}` : '';
            if (!content) return;

            async function render(orderObj) {
                // Try various shapes: order.items, order.products, order.lines
                const items = orderObj.items || orderObj.products || orderObj.lines || [];
                const address = orderObj.address || orderObj.delivery_address || '';
                const customer = orderObj.customer_name || orderObj.name || orderObj.customer || '';
                const total = orderObj.total ?? orderObj.amount ?? 0;

                let html = `<div><strong>Cliente:</strong> ${escapeHTML(String(customer))}</div>`;
                if (address) html += `<div><strong>Dirección:</strong> ${escapeHTML(String(address))}</div>`;
                html += `<div style="margin-top:8px;"><strong>Items:</strong></div>`;
                if (!items || items.length === 0) {
                    html += '<div class="empty">No hay items en este pedido</div>';
                } else {
                    html += '<ul style="margin-top:6px; padding-left:18px;">';
                    items.forEach(it => {
                        const name = it.name || it.product_name || it.title || '';
                        const qty = it.quantity ?? it.qty ?? 1;
                        const price = it.price ?? it.unit_price ?? '';
                        html += `<li>${escapeHTML(String(name))} ${qty ? '×'+escapeHTML(String(qty)) : ''} ${price ? '- $'+formatCurrencyARS(price) : ''}</li>`;
                    });
                    html += '</ul>';
                }
                html += `<div style="margin-top:8px;"><strong>Total:</strong> $ ${formatCurrencyARS(total)}</div>`;
                content.innerHTML = html;
                if (modal) modal.classList.remove('hidden');
            }

            if (order) {
                render(order);
                return;
            }

            if (!id) {
                content.innerHTML = '<div class="empty">Detalles no disponibles</div>';
                if (modal) modal.classList.remove('hidden');
                return;
            }

            // Fetch by id
            fetch(`${window.API_BASE}/orders/${id}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data) render(data);
                    else {
                        content.innerHTML = '<div class="empty">No se pudo obtener detalles</div>';
                        if (modal) modal.classList.remove('hidden');
                    }
                }).catch(err => {
                    console.error('fetch order detail', err);
                    content.innerHTML = '<div class="empty">Error cargando detalles</div>';
                    if (modal) modal.classList.remove('hidden');
                });
        }

        function closeOrderDetailModal() {
            const modal = document.getElementById('order-detail-modal');
            if (modal) modal.classList.add('hidden');
        }

        // Expose order modal helpers globally
        window.openOrderDetail = openOrderDetail;
        window.closeOrderDetailModal = closeOrderDetailModal;
        if (data.topProduct) {
            setText('top-product', data.topProduct.name);
            setText('top-sales', `${data.topProduct.total} ventas`);
        } else {
            setText('top-product', '-');
            setText('top-sales', '0 ventas');
        }

        // ===== GRÁFICOS =====
        renderDashboardCharts(data);

    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

// ================= GRÁFICOS (PREPARADO) =================
function renderSalesByHourChart(data) {
    const ctx = document.getElementById('salesByHourChart');
    if (!ctx) return;

    const labels = data.map(d => `${String(d.hour).padStart(2, '0')}:00`);
    const values = data.map(d => d.total);

    if (salesByHourChart) salesByHourChart.destroy();

    salesByHourChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Ventas ($)',
                data: values
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
function renderTopProductsChart(data) {
    const ctx = document.getElementById('topProductsChart');
    if (!ctx) return;

    const labels = data.map(d => d.name);
    const values = data.map(d => d.total);

    if (topProductsChart) topProductsChart.destroy();

    topProductsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Unidades vendidas',
                data: values
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true
        }
    });
}
function renderWeeklySalesChart(data) {
    const ctx = document.getElementById('weeklySalesChart');
    if (!ctx) return;

    const labels = data.map(d => d.date);
    const values = data.map(d => d.total);

    if (weeklySalesChart) weeklySalesChart.destroy();

    weeklySalesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Ventas ($)',
                data: values,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}


async function renderDashboardCharts(data) {
    try {
        await ensureChartLoaded();
    } catch (e) {
        console.warn('No se pudo cargar Chart.js, se omiten gráficos', e);
        return;
    }

    renderSalesByHourChart(data.salesByHour || []);
    renderTopProductsChart(data.topProducts || []);
    renderWeeklySalesChart(data.weeklySales || []);
}

// ================= HELPERS =================
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
 
function formatCurrencyARS(value) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(value || 0);
}
// ================= REFRESH MANUAL =================
function refreshDashboard() {
    if (currentSection === 'dashboard') {
        loadDashboardData();
    } else if (currentSection === 'products') {
        loadProducts();
    }

    const refreshIcon = document.querySelector('.refresh-btn i');
    if (refreshIcon) {
        refreshIcon.classList.add('spinning');
        setTimeout(() => {
            refreshIcon.classList.remove('spinning');
        }, 1000);
    }
}

// ================= CATEGORÍAS - CRUD EN LA SECCIÓN =================
function openCategoryModal(editId = null, name = '') {
    editingCategoryId = editId;
    const modal = document.getElementById('categoryModal');
    const input = document.getElementById('new-category-name');
    if (input) input.value = name || '';
    if (modal) {
        // Cambiar título según crear/editar
        const titleEl = modal.querySelector('h3');
        if (titleEl) titleEl.textContent = editId ? 'Editar Categoría' : 'Nueva Categoría';
        modal.classList.remove('hidden');
    }
}

function closeCategoryModal() {
    editingCategoryId = null;
    const modal = document.getElementById('categoryModal');
    const input = document.getElementById('new-category-name');
    if (input) input.value = '';
    if (modal) {
        const titleEl = modal.querySelector('h3');
        if (titleEl) titleEl.textContent = 'Nueva Categoría';
        modal.classList.add('hidden');
    }
}

async function fetchCategoriesList() {
    try {
        const remote = await fetchCategoriesRemote();
        if (remote) {
            setMockCategories(remote);
            return remote;
        }
        // si remote es null, caer al mock
    } catch (e) {
        console.error('fetchCategoriesList error', e);
        // fallback a mock en localStorage
        const mock = getMockCategories();
        return mock;
    }
}

// Intenta obtener la lista remota; devuelve null si falla
async function fetchCategoriesRemote() {
    try {
        const res = await fetch(`${window.API_BASE}/categories`, { headers: getAuthHeaders() });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// --- mock helpers (localStorage) ---
function getMockCategories() {
    try {
        const raw = localStorage.getItem('mock_categories');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function setMockCategories(list) {
    try {
        localStorage.setItem('mock_categories', JSON.stringify(list || []));
    } catch (e) { /* ignore */ }
}

async function renderCategoriesList() {
    const listEl = document.getElementById('categoriesList');
    if (!listEl) return;
    const categories = await fetchCategoriesList();
    listEl.innerHTML = '';

    if (!categories || categories.length === 0) {
        listEl.innerHTML = '<li class="empty">No hay categorías</li>';
        return;
    }

    categories.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'category-item';
        li.dataset.id = cat.id;
        li.innerHTML = `
            <div class="cat-name">${escapeHTML(cat.name)}</div>
            <div class="cat-actions">
                <button class="icon-btn edit-btn" onclick="openCategoryModal(${cat.id}, '${(cat.name||'').replace(/'/g, "\\'")}')" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="icon-btn del-btn" onclick="deleteCategory(${cat.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div>
        `;
        listEl.appendChild(li);
    });
}

// Quick add: crear categoría sin abrir modal
function quickAddCategory() {
    const input = document.getElementById('categoryNameInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
        showNotification('Ingrese un nombre', 'warning');
        return;
    }
    // poner en modal input y llamar saveCategory directamente
    const newInput = document.getElementById('new-category-name');
    if (newInput) newInput.value = name;
    // limpiar campo rápido
    input.value = '';
    // asegurar que no estamos editando
    editingCategoryId = null;
    saveCategory();
}

async function saveCategory() {
    const name = document.getElementById('new-category-name')?.value.trim();
    if (!name) {
        alert('Ingrese un nombre');
        return;
    }

    try {
        let res;
        if (editingCategoryId) {
            const methodHint = await detectUpdateMethod(editingCategoryId);
            const putUrl = `${window.API_BASE}/categories/${editingCategoryId}`;
            if (methodHint === 'NONE') {
                // Recurso no encontrado en API: usar POST fallback or mock
                res = await fetch(`${window.API_BASE}/categories`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ id: editingCategoryId, name })
                });
            } else if (methodHint === 'PATCH') {
                res = await fetch(putUrl, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name })
                });
            } else if (methodHint === 'PUT') {
                res = await fetch(putUrl, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name })
                });
            } else {
                // UNKNOWN: intentar solo PUT (evita intentar PATCH si falla)
                res = await fetch(putUrl, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name })
                });
            }
        } else {
            res = await fetch(`${window.API_BASE}/categories`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
        }

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            // Si es 404 o no disponible, guardar en mock local y continuar (modo offline)
            if (res.status === 404) {
                const list = getMockCategories();
                if (editingCategoryId) {
                    // actualizar mock
                    const idx = list.findIndex(c => c.id == editingCategoryId);
                    if (idx >= 0) list[idx].name = name;
                    else list.push({ id: editingCategoryId, name });
                } else {
                    // crear con id temporal
                    const nextId = (list.reduce((s, c) => Math.max(s, c.id || 0), 0) || 0) + 1;
                    list.push({ id: nextId, name });
                }
                setMockCategories(list);
                closeCategoryModal();
                renderCategoriesList();
                if (typeof loadCategories === 'function') loadCategories();
                showNotification('Categoría guardada localmente (API no disponible)', 'warning');
                return;
            }
            throw new Error(`Error al guardar categoría: ${res.status} ${text}`);
        }

        closeCategoryModal();
        // Recargar lista en panel y selects en productos.js si existe
        renderCategoriesList();
        if (typeof loadCategories === 'function') loadCategories();
        showNotification('Categoría guardada', 'success');
    } catch (e) {
        console.error(e);
        alert('No se pudo guardar la categoría');
    }
}

async function deleteCategory(id) {
    // Open confirmation modal instead
    openDeleteCategoryModal(id);
}

// Move actual deletion logic to performDeleteCategory
async function performDeleteCategory(id) {
    try {
        // Detectar soporte de eliminación en el servidor para evitar 404s innecesarios
        const deleteMethod = await detectDeleteMethod(id);

        if (deleteMethod === 'NONE') {
            const list = getMockCategories();
            const idx = list.findIndex(c => c.id == id);
            if (idx >= 0) {
                list.splice(idx, 1);
                setMockCategories(list);
            }
            renderCategoriesList();
            if (typeof loadCategories === 'function') loadCategories();
            showNotification('Categoría eliminada localmente', 'warning');
            return;
        }

        let res;
        if (deleteMethod === 'DELETE' || deleteMethod === 'UNKNOWN') {
            res = await fetch(`${window.API_BASE}/categories/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
        } else {
            // No soporta DELETE según la detección, intentar fallbacks POST
            const fallback1 = await fetch(`${window.API_BASE}/categories/${id}/delete`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (fallback1.ok) { renderCategoriesList(); if (typeof loadCategories==='function') loadCategories(); showNotification('Categoría eliminada (fallback)', 'success'); return; }

            const fallback2 = await fetch(`${window.API_BASE}/categories/delete`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id })
            });
            if (fallback2.ok) { renderCategoriesList(); if (typeof loadCategories==='function') loadCategories(); showNotification('Categoría eliminada (fallback)', 'success'); return; }
            // Si no hubo éxito en fallbacks, marcar como no encontrada
            res = { ok: false, status: 404 };
        }

        // Manejar respuesta del DELETE/fallback
        if (res && res.ok) {
            renderCategoriesList();
            if (typeof loadCategories === 'function') loadCategories();
            showNotification('Categoría eliminada', 'success');
            return;
        }

        if (res && res.status === 404) {
            // Consideramos eliminado si no existe en servidor
            const list = getMockCategories();
            const idx = list.findIndex(c => c.id == id);
            if (idx >= 0) {
                list.splice(idx, 1);
                setMockCategories(list);
            }
            renderCategoriesList();
            if (typeof loadCategories === 'function') loadCategories();
            showNotification('Categoría eliminada (no encontrada en servidor)', 'warning');
            return;
        }

        // Si llegó aquí, hubo un error inesperado
        throw new Error('Error al eliminar categoría');
    } catch (e) {
        console.error('deleteCategory error', e);
        // fallback mock: eliminar localmente
        const list = getMockCategories();
        const idx = list.findIndex(c => c.id == id);
        if (idx >= 0) {
            list.splice(idx, 1);
            setMockCategories(list);
            renderCategoriesList();
            if (typeof loadCategories === 'function') loadCategories();
            showNotification('Categoría eliminada localmente (API no disponible)', 'warning');
            return;
        }
        alert('No se pudo eliminar la categoría');
    }
}

// Modal helpers for category delete
function openDeleteCategoryModal(id) {
    const modal = document.getElementById('delete-category-modal');
    const nameSpan = document.getElementById('category-to-delete-name');
    const catElem = document.querySelector(`.category-item[data-id="${id}"]`);
    const name = catElem ? catElem.querySelector('.cat-name')?.textContent || catElem.dataset.name : '';
    if (nameSpan) nameSpan.textContent = name || '';
    if (modal) {
        modal.dataset.deleteId = id;
        modal.classList.remove('hidden');
    }
}

function closeDeleteCategoryModal() {
    const modal = document.getElementById('delete-category-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmDeleteCategory() {
    const modal = document.getElementById('delete-category-modal');
    if (!modal) return;
    const id = modal.dataset.deleteId;
    if (!id) return closeDeleteCategoryModal();
    performDeleteCategory(id);
    closeDeleteCategoryModal();
}


// ================= INIT =================
function initDashboard() {
    updateCurrentDate();

    if (typeof checkAuth === 'function') {
        checkAuth();
    }

    showSection('dashboard');

    // Auto refresh cada 30 segundos (tiempo real simple)
    setInterval(() => {
        if (currentSection === 'dashboard') {
            loadDashboardData();
        }
    }, 30000);

    // Animación refresh
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .spinning {
            animation: spin 1s linear;
        }
    `;
    document.head.appendChild(style);
}

// ================= REDIRECCIONES =================
function goProductos() {
    showSection('products');
}

function goPromos() {
    showSection('promos');
}

function goPedidos() {
    showSection('orders');
}

// ================= LOAD =================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

// Expose modal helpers globally
window.openDeleteCategoryModal = openDeleteCategoryModal;
window.closeDeleteCategoryModal = closeDeleteCategoryModal;
window.confirmDeleteCategory = confirmDeleteCategory;
