
function getAPI() {
    if (!window.API_BASE) {
        throw new Error('API_BASE no está definida');
    }
    return window.API_BASE;
}

// IDs específicos
const PROMO_MODAL_ID = "promo-modal";
const PROMO_DELETE_MODAL_ID = "delete-promo-modal";
const PROMOS_TABLE_BODY_ID = "promos-table-body";

// ----------------- VERIFICACIÓN DE AUTENTICACIÓN -----------------
function isAuthenticated() {
    const token = localStorage.getItem('auth_token');
    return !!token;
}

function requireAuth() {
    if (!isAuthenticated()) {
        showNotification('Debe iniciar sesión para gestionar promociones', 'warning');
        return false;
    }
    return true;
}

// ----------------- HEADERS DE AUTENTICACIÓN -----------------
function getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        console.warn('⚠️ No hay token al intentar obtener headers');
    }
    
    return headers;
}

// ----------------- CARGAR PROMOCIONES -----------------
async function loadPromos() {
    try {
        console.log('🔄 Intentando cargar promociones...');
        
        if (!isAuthenticated()) {
            console.warn('No autenticado, no se cargarán promociones');
            showNotification('Debe iniciar sesión para ver promociones', 'warning');
            return;
        }
        
        showLoading(true);
        
        const res = await fetch(`${getAPI()}/promos`, {
            headers: getAuthHeaders()
        });
        
        console.log('Respuesta promociones:', {
            status: res.status,
            statusText: res.statusText,
            ok: res.ok
        });
        
        if (res.status === 401) {
            console.warn('Token inválido en promociones');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            showNotification('Sesión expirada, por favor inicie sesión nuevamente', 'warning');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }
        
        if (!res.ok) {
            throw new Error(`Error ${res.status} cargando promos`);
        }

        const promos = await res.json();
        console.log(`✅ ${promos.length} promos cargadas`);
        renderPromos(promos);
        updatePromoStats(promos);

    } catch (e) {
        console.error("❌ Error en loadPromos:", e);
        showNotification("Error cargando promos: " + e.message, "error");
        renderEmptyState();
    } finally {
        showLoading(false);
    }
}

// ----------------- RENDER PROMOCIONES -----------------
function renderPromos(promos) {
    const tableBody = document.getElementById(PROMOS_TABLE_BODY_ID);
    if (!tableBody) {
        console.error(`Contenedor #${PROMOS_TABLE_BODY_ID} no encontrado`);
        return;
    }
    
    if (!promos || promos.length === 0) {
        renderEmptyState();
        return;
    }

    let html = '';
    
    promos.forEach(promo => {

    const isActive = promo.active == 1;

    const statusClass = isActive ? 'status-active' : 'status-inactive';
    const statusText  = isActive ? 'Activa' : 'Inactiva';
    const statusIcon  = isActive ? 'bolt' : 'pause';

    const dayText = promo.day_of_week !== null && promo.day_of_week !== undefined
        ? getDayName(promo.day_of_week)
        : 'Sin día';

    html += `
        <tr>
            <td>
                <div class="promo-info">
                    <div class="promo-title">${escapeHTML(promo.title)}</div>
                    ${promo.description ? `<div class="promo-desc">${escapeHTML(promo.description)}</div>` : ''}
                </div>
            </td>

            <td>${dayText}</td>

            <td>
                <div class="price-info">
                    <span class="price">$${formatPrice(promo.price)}</span>
                </div>
            </td>

            <td>
                <span class="status-badge ${statusClass}">
                    <i class="fas fa-${statusIcon}"></i> ${statusText}
                </span>
            </td>

            <td class="actions">
                <button class="edit-btn" onclick="editPromo(${promo.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="del-btn" onclick="showDeletePromoModal(${promo.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
});

tableBody.innerHTML = html;

}
//función auxiliar  
function getDayName(day) {
    const days = [
        'Domingo',
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado'
    ];
    return days[Number(day)] ?? '—';
}


// ----------------- ACTUALIZAR ESTADÍSTICAS -----------------
function updatePromoStats(promos) {
    const totalEl = document.getElementById('total-promos');
    const activeEl = document.getElementById('active-promos');
    const inactiveEl = document.getElementById('inactive-promos');

    if (!promos || promos.length === 0) {
        if (totalEl) totalEl.textContent = '0';
        if (activeEl) activeEl.textContent = '0';
        if (inactiveEl) inactiveEl.textContent = '0';
        return;
    }

    const total = promos.length;
    const active = promos.filter(p => p.active == 1).length;
    const inactive = promos.filter(p => p.active != 1).length;

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (inactiveEl) inactiveEl.textContent = inactive;
}


// ----------------- ESTADO VACÍO -----------------
function renderEmptyState() {
    const tableBody = document.getElementById(PROMOS_TABLE_BODY_ID);
    if (!tableBody) return;
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                <i class="fas fa-tags"></i>
                <h3>No hay promociones</h3>
                <p>Crea tu primera promo haciendo clic en "Nueva Promo"</p>
                <button onclick="openAddPromoModal()" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Crear Promo
                </button>
            </td>
        </tr>
    `;
    
    updatePromoStats([]);
}

// ----------------- MODALES -----------------
function openAddPromoModal() {
    if (!requireAuth()) return;
    
    editingId = null;
    
    const modalTitle = document.getElementById("promo-modal-title");
    if (modalTitle) {
        modalTitle.textContent = "Nueva Promo";
    }
    
    resetPromoForm();
    
    const modal = document.getElementById(PROMO_MODAL_ID);
    if (modal) {
        modal.classList.remove("hidden");
    } else {
        console.error(`Modal #${PROMO_MODAL_ID} no encontrado`);
        showNotification('Error: modal no encontrado', 'error');
    }
}

async function editPromo(id) {
    if (!requireAuth()) return;
    
    editingId = id;
    
    try {
        showLoading(true);
        
        const res = await fetch(`${getAPI()}/promos/${id}`, {
            headers: getAuthHeaders()
        });
        
        if (res.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            showNotification('Sesión expirada', 'error');
            setTimeout(() => window.location.href = 'login.html', 1500);
            return;
        }
        
        if (!res.ok) throw new Error("Error al obtener promo");
        
        const promo = await res.json();

        const modalTitle = document.getElementById("promo-modal-title");
        if (modalTitle) {
            modalTitle.textContent = "Editar Promo";
        }
        
        document.getElementById("promo-name").value = promo.title || "";
        document.getElementById("promo-description").value = promo.description || "";
        document.getElementById("promo-price").value = promo.price || "";
        document.getElementById("promo-active").checked = Boolean(promo.active);
        document.getElementById("promo-day").value =
        promo.day_of_week !== null && promo.day_of_week !== undefined
            ? promo.day_of_week
        : "";

        const modal = document.getElementById(PROMO_MODAL_ID);
        if (modal) {
            modal.classList.remove("hidden");
        }
        
    } catch (e) {
        console.error("Error en editPromo:", e);
        showNotification("No se pudo cargar la promoción", "error");
    } finally {
        showLoading(false);
    }
}

function closePromoModal() {
    const modal = document.getElementById(PROMO_MODAL_ID);
    if (modal) {
        modal.classList.add("hidden");
    }
    editingId = null;
}
function resetPromoForm() {
    document.getElementById("promo-name").value = "";
    document.getElementById("promo-description").value = "";
    document.getElementById("promo-price").value = "";
    document.getElementById("promo-day").value = "";
    document.getElementById("promo-active").checked = true;
}
    
    


// ----------------- MODAL DE ELIMINACIÓN -----------------
function showDeletePromoModal(id) {
    if (!requireAuth()) return;
    
    const promo = getPromoById(id);
    if (!promo) {
        showNotification('Promo no encontrada', 'error');
        return;
    }
    
    editingId = id;
    
    const deleteName = document.getElementById('promo-to-delete-name');
    if (deleteName) {
        deleteName.textContent = promo.title;
    }
    
    const modal = document.getElementById(PROMO_DELETE_MODAL_ID);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeDeletePromoModal() {
    const modal = document.getElementById(PROMO_DELETE_MODAL_ID);
    if (modal) {
        modal.classList.add('hidden');
    }
    editingId = null;
}

async function confirmDeletePromo() {
    if (!editingId || !requireAuth()) return;
    
    try {
        showLoading(true);
        
        const res = await fetch(`${getAPI()}/promos/${editingId}`, { 
            method: "DELETE",
            headers: getAuthHeaders()
        });
        
        if (res.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            showNotification('Sesión expirada', 'error');
            setTimeout(() => window.location.href = 'login.html', 1500);
            return;
        }
        
        if (!res.ok) {
            throw new Error(`Error ${res.status}`);
        }

        await loadPromos();
        closeDeletePromoModal();
        showNotification("Promo eliminada", "success");

    } catch (error) {
        console.error("Error en confirmDeletePromo:", error);
        showNotification(" Error al eliminar", "error");
    } finally {
        showLoading(false);
    }
}

// ----------------- GUARDAR PROMOCIÓN -----------------
async function savePromo() {
    if (!requireAuth()) {
        showNotification('Debe iniciar sesión para guardar promos', 'warning');
        return;
    }
    
    const title = document.getElementById("promo-name")?.value.trim();
    const price = document.getElementById("promo-price")?.value.trim();
    const day_of_week = document.getElementById("promo-day")?.value;
    const description = document.getElementById("promo-description")?.value.trim() || "";
    const active = document.getElementById("promo-active")?.checked || false;

    if (!title) {
        showNotification("Ingresa título de la promoción", "warning");
        return;
    }
    
    if (!price || isNaN(price) || parseFloat(price) < 0) {
        showNotification("Ingresa un precio válido", "warning");
        return;
    }
    
    
    if (!day_of_week) {
        showNotification("Seleccioná día de la semana", "warning");
        return;
    }

    const promoData = { 
        title, 
        description, 
        price: parseFloat(price), 
        day_of_week,
        active: active ? 1 : 0
    };

    const url = editingId ? `${getAPI()}/promos/${editingId}` : `${getAPI()}/promos`;
    const method = editingId ? "PUT" : "POST";

    try {
        showLoading(true);
        
        const res = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(promoData)
        });

        if (res.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            showNotification('Sesión expirada', 'error');
            setTimeout(() => window.location.href = 'login.html', 1500);
            return;
        }
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error ${res.status}: ${errorText}`);
        }

        await loadPromos();
        closePromoModal();
        
        showNotification(
            editingId ? " Promo actualizada" : " Promo creada", 
            "success"
        );

    } catch (error) {
        console.error("Error en savePromo:", error);
        showNotification(" Error: " + error.message, "error");
    } finally {
        showLoading(false);
    }
}

// ----------------- FUNCIONES AUXILIARES -----------------
function getPromoById(id) {
    const rows = document.querySelectorAll(`#${PROMOS_TABLE_BODY_ID} tr`);
    for (let row of rows) {
        const editBtn = row.querySelector('.edit-btn');
        if (editBtn && editBtn.onclick && editBtn.onclick.toString().includes(id)) {
            const titleCell = row.querySelector('.promo-title');
            return {
                id: id,
                title: titleCell ? titleCell.textContent.trim() : 'Promoción'
            };
        }
    }
    return null;
}

function getPromoStatus(promo) {
    if (!promo.active) return 'inactive';
    
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    
    if (currentTime >= promo.start_time && currentTime <= promo.end_time) {
        return 'active';
    }
    
    if (currentTime < promo.start_time) {
        return 'upcoming';
    }
    
    return 'expired';
}

function getStatusClass(status) {
    const classes = {
        'active': 'success',
        'inactive': 'secondary',
        'upcoming': 'warning',
        'expired': 'error'
    };
    return classes[status] || 'secondary';
}

function getStatusText(status) {
    const texts = {
        'active': 'Activa',
        'inactive': 'Inactiva',
        'upcoming': 'Próxima',
        'expired': 'Expirada'
    };
    return texts[status] || status;
}

function getStatusIcon(status) {
    const icons = {
        'active': 'check-circle',
        'inactive': 'pause-circle',
        'upcoming': 'clock',
        'expired': 'times-circle'
    };
    return icons[status] || 'question-circle';
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatPrice(num) {
    const number = parseFloat(num);
    if (isNaN(number)) return '0.00';
    
    return number.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr;
}

// ----------------- FUNCIONES DE UI (COMPARTIDAS) -----------------
function showLoading(show) {
    // Usar la función global de productos.js si existe
    if (typeof window.showLoading === 'function' && window.showLoading !== showLoading) {
        window.showLoading(show);
        return;
    }
    
    let loader = document.getElementById('loading-overlay');
    
    if (!loader && show) {
        loader = document.createElement('div');
        loader.id = 'loading-overlay';
        loader.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-3x"></i>
                <p>Cargando...</p>
            </div>
        `;
        document.body.appendChild(loader);
        
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 99999;
            flex-direction: column;
        `;
        
        const spinner = loader.querySelector('.loading-spinner');
        spinner.style.cssText = `
            text-align: center;
            color: #ff6b35;
        `;
    }
    
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function showNotification(message, type = 'info') {
    // Usar la función global de productos.js si existe
    if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    const types = {
        success: { bg: '#00b894', icon: '✓' },
        error: { bg: '#d63031', icon: '✗' },
        warning: { bg: '#fdcb6e', icon: '⚠' },
        info: { bg: '#0984e3', icon: 'ℹ' }
    };
    
    const config = types[type] || types.info;
    
    let notification = document.getElementById('global-notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'global-notification';
        document.body.appendChild(notification);
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            opacity: 0;
            transform: translateX(100px);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
    }
    
    notification.style.background = config.bg;
    notification.innerHTML = `
        <span style="font-size: 18px;">${config.icon}</span>
        <span>${message}</span>
    `;
    
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
    }, 4000);
}

// ----------------- FILTROS Y BÚSQUEDA -----------------
function filterPromos() {
    console.log('Filtrando promociones...');
}

function searchPromos() {
    const searchInput = document.getElementById('promo-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    console.log('Buscando:', searchTerm);
}

// ----------------- INICIALIZACIÓN -----------------
function initPromosSection() {
    console.log('🚀 Inicializando promos.js');
    console.log('Token presente:', !!localStorage.getItem('auth_token'));
    
    const promosSection = document.getElementById('promos-section');
    const isInDashboard = !!promosSection;
    
    if (isInDashboard && promosSection) {
        console.log('✅ En dashboard, sección promociones disponible');
        
        document.addEventListener('click', function(event) {
            const modal = document.getElementById(PROMO_MODAL_ID);
            if (modal && !modal.classList.contains('hidden') && 
                event.target === modal) {
                closePromoModal();
            }
            
            const deleteModal = document.getElementById(PROMO_DELETE_MODAL_ID);
            if (deleteModal && !deleteModal.classList.contains('hidden') && 
                event.target === deleteModal) {
                closeDeletePromoModal();
            }
        });
        
        document.addEventListener('keydown', function(event) {
            const modal = document.getElementById(PROMO_MODAL_ID);
            if (modal && !modal.classList.contains('hidden') && 
                event.key === 'Escape') {
                closePromoModal();
            }
            
            const deleteModal = document.getElementById(PROMO_DELETE_MODAL_ID);
            if (deleteModal && !deleteModal.classList.contains('hidden') && 
                event.key === 'Escape') {
                closeDeletePromoModal();
            }
        });
        
        if (!promosSection.classList.contains('hidden')) {
            console.log('📥 Cargando promociones (sección visible)');
            loadPromos();
        }
    }
}

// ----------------- FUNCIONES GLOBALES -----------------
window.openAddPromoModal = openAddPromoModal;
window.savePromo = savePromo;
window.editPromo = editPromo;
window.showDeletePromoModal = showDeletePromoModal;
window.closePromoModal = closePromoModal;
window.closeDeletePromoModal = closeDeletePromoModal;
window.confirmDeletePromo = confirmDeletePromo;
window.loadPromos = loadPromos;
window.filterPromos = filterPromos;
window.searchPromos = searchPromos;

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPromosSection);
} else {
    initPromosSection();
}