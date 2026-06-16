
// club.js - Gestión de clientes Club One More

let allCustomers = [];
let editingCustomerId = null;

async function loadCustomers() {
    try {
        console.log('🔄 Cargando clientes Club One More...');
        showLoading(true);

        const res = await fetch(`${window.API_BASE}/admin/clientes`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            throw new Error(`Error ${res.status} al cargar clientes`);
        }

        allCustomers = await res.json();

        // Ordenar por nombre
        allCustomers.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        renderCustomersTable(allCustomers);

    } catch (e) {
        console.error("❌ Error en loadCustomers:", e);
        showNotification("Error cargando clientes: " + e.message, "error");
    } finally {
        showLoading(false);
    }
}

function renderCustomersTable(customers) {
    const tableBody = document.getElementById('club-table-body');
    if (!tableBody) return;

    if (!customers || customers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No se encontraron clientes</h3>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    customers.forEach(customer => {
        html += `
            <tr>
                <td>${escapeHTML(customer.nombre)}</td>
                <td>${escapeHTML(customer.telefono)}</td>
                <td>
                    <div class="stamp-container">
                        <div class="stamp-visual">${getStampIndicator(customer.sellos_actuales)}</div>
                        <div class="stamp-count">${customer.sellos_actuales} de 10 sellos</div>
                    </div>
                </td>
                <td class="actions">
                    <button class="edit-btn" onclick="editStamps(${customer.id})" title="Editar sellos">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

function getStampIndicator(count) {
    const max = 10;
    let stamps = '';
    for (let i = 0; i < max; i++) {
        stamps += i < count ? '🍔' : '⚪';
    }
    return stamps;
}

function filterCustomers() {
    const searchTerm = document.getElementById('club-search').value.toLowerCase();

    const filtered = allCustomers.filter(c =>
        (c.nombre && c.nombre.toLowerCase().includes(searchTerm)) ||
        (c.telefono && c.telefono.includes(searchTerm))
    );

    renderCustomersTable(filtered);
}

async function editStamps(id) {
    editingCustomerId = id;

    try {
        showLoading(true);
        const res = await fetch(`${window.API_BASE}/admin/clientes/${id}`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error("No se pudo obtener la información del cliente");

        const customer = await res.json();

        document.getElementById('edit-customer-name').textContent = customer.nombre;
        document.getElementById('edit-customer-phone').textContent = customer.telefono;
        document.getElementById('edit-customer-stamps').value = customer.sellos_actuales;

        document.getElementById('edit-stamps-modal').classList.remove('hidden');

    } catch (e) {
        console.error("Error en editStamps:", e);
        showNotification("Error: " + e.message, "error");
    } finally {
        showLoading(false);
    }
}

function closeStampsModal() {
    document.getElementById('edit-stamps-modal').classList.add('hidden');
    editingCustomerId = null;
}

async function saveStamps() {
    const stampsInput = document.getElementById('edit-customer-stamps');
    const stamps = parseInt(stampsInput.value);

    if (isNaN(stamps) || stamps < 0 || stamps > 10) {
        showNotification("La cantidad de sellos debe estar entre 0 y 10", "warning");
        return;
    }

    try {
        showLoading(true);
        const res = await fetch(`${window.API_BASE}/admin/clientes/${editingCustomerId}/sellos`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ sellos_actuales: stamps })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Error al actualizar sellos");
        }

        showNotification("Sellos actualizados correctamente", "success");
        closeStampsModal();
        loadCustomers();

    } catch (e) {
        console.error("Error en saveStamps:", e);
        showNotification("Error: " + e.message, "error");
    } finally {
        showLoading(false);
    }
}

// Auxiliar para escapar HTML
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Exponer funciones globalmente
window.loadCustomers = loadCustomers;
window.filterCustomers = filterCustomers;
window.editStamps = editStamps;
window.saveStamps = saveStamps;
window.closeStampsModal = closeStampsModal;
