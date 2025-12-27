// productos.js - Gestión de productos
console.log('✅ productos.js cargado');

const API = window.API_BASE;

if (!API) {
    console.error('API_BASE no definida en productos.js');
}

let editingId = null;
let categoriesCache = [];
let currentVariants = [];


// IDs específicos
const PRODUCT_MODAL_ID = "product-modal";
const PRODUCTS_CONTAINER_ID = "products-container";

// ----------------- VERIFICACIÓN SIMPLIFICADA -----------------
function isAuthenticated() {
    const token = localStorage.getItem('auth_token');
    const hasToken = !!token;
    
    console.log('🔐 isAuthenticated:', {
        hasToken,
        path: window.location.pathname,
        time: new Date().toLocaleTimeString()
    });
    
    return hasToken;
}

function requireAuth() {
    if (!isAuthenticated()) {
        console.warn('Se requiere autenticación');
        // Solo redirigir si estamos en una página que requiere auth
        if (!window.location.pathname.includes('login.html')) {
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 100);
        }
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

// ----------------- CARGAR CATEGORÍAS -----------------
async function loadCategories() {
    try {
        if (!requireAuth()) return;
        
        console.log('📦 Cargando categorías...');
        
        const res = await fetch(`${API}/categories`, {
            headers: getAuthHeaders()
        });
        
        console.log('Respuesta categorías:', res.status);
        
        if (res.status === 401) {
            console.warn('Token inválido o expirado');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.href = 'login.html';
            return;
        }
        
        if (!res.ok) {
            throw new Error(`Error ${res.status} cargando categorías`);
        }

        categoriesCache = await res.json();
        console.log(`✅ ${categoriesCache.length} categorías cargadas`);
        updateCategorySelect();

    } catch (e) {
        console.error("❌ Error cargando categorías:", e);
        showNotification("Error cargando categorías", "error");
    }
}

// ----------------- CARGAR PRODUCTOS -----------------
async function loadProducts() {
    try {
        console.log('🔄 Intentando cargar productos...');
        
        if (!isAuthenticated()) {
            console.warn('No autenticado, no se cargarán productos');
            showNotification('Debe iniciar sesión para ver productos', 'warning');
            return;
        }
        
        showLoading(true);
        
        const res = await fetch(`${API}/products/all`, {
            headers: getAuthHeaders()
        });
        
        console.log('Respuesta productos:', {
            status: res.status,
            statusText: res.statusText,
            ok: res.ok
        });
        
        if (res.status === 401) {
            console.warn('Token inválido en productos');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            showNotification('Sesión expirada, por favor inicie sesión nuevamente', 'warning');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }
        
        if (!res.ok) {
            throw new Error(`Error ${res.status} cargando productos`);
        }

        const products = await res.json();
        console.log(`✅ ${products.length} productos cargados`);
        renderProductsByCategory(products);

    } catch (e) {
        console.error("❌ Error en loadProducts:", e);
        showNotification("Error cargando productos: " + e.message, "error");
    } finally {
        showLoading(false);
    }
}

// ----------------- ACTUALIZAR SELECT DE CATEGORÍAS -----------------
function updateCategorySelect() {
    const select = document.getElementById("prod-cat");
    if (!select) {
        console.warn('Select #prod-cat no encontrado');
        return;
    }
    
    select.innerHTML = '';
    
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Seleccionar categoría";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    categoriesCache.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
}

// ----------------- RENDER POR CATEGORÍAS -----------------
function renderProductsByCategory(products) {
    const container = document.getElementById(PRODUCTS_CONTAINER_ID);
    if (!container) {
        console.error(`Contenedor #${PRODUCTS_CONTAINER_ID} no encontrado`);
        return;
    }
    
    container.innerHTML = "";

    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No hay productos</h3>
                <p>Agrega tu primer producto haciendo clic en "Nuevo Producto"</p>
            </div>
        `;
        return;
    }

    const grouped = {};

    products.forEach(p => {
        const catName = p.category?.name || "Sin categoría";
        if (!grouped[catName]) grouped[catName] = [];
        grouped[catName].push(p);
    });

    Object.keys(grouped).forEach(cat => {
        const section = document.createElement("div");
        section.className = "category-section";

        section.innerHTML = `
            <h2 class="cat-title">
                <i class="fas fa-folder"></i> ${cat}
                <span class="cat-count">(${grouped[cat].length})</span>
            </h2>
            <div class="product-list"></div>
        `;

        const list = section.querySelector(".product-list");

        grouped[cat].forEach(p => {
            const item = document.createElement("div");
            item.className = "product-item";
            item.dataset.id = p.id;

            item.innerHTML = `
                <div class="prod-info">
                    <div class="prod-header">
                        <h3>${escapeHTML(p.name)}</h3>
                        <span class="prod-price">$${formatPrice(p.price)}</span>
                    </div>
                    ${p.description ? `<p class="prod-desc">${escapeHTML(p.description)}</p>` : ''}
                    <div class="product-meta">
                        <span class="product-id">ID: ${p.id}</span>
                        <span class="${p.visible ? "visible-tag" : "hidden-tag"}">
                            <i class="fas fa-${p.visible ? 'eye' : 'eye-slash'}"></i>
                            ${p.visible ? "Visible" : "Oculto"}
                        </span>
                        ${p.category ? `<span class="category-tag">${p.category.name}</span>` : ''}
                    </div>
                </div>

                <div class="prod-actions">
                    <button class="edit-btn" onclick="openEditModal(${p.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="del-btn" onclick="deleteProduct(${p.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            list.appendChild(item);
        });

        container.appendChild(section);
    });
}
const hasVariantsCheckbox = document.getElementById('hasVariants');
const variantsContainer = document.getElementById('variantsContainer');

hasVariantsCheckbox.addEventListener('change', () => {
    variantsContainer.style.display = hasVariantsCheckbox.checked ? 'block' : 'none';
});
const variantNameInput = document.getElementById('variantNameInput');
const variantDescInput = document.getElementById('variantDescInput');
const addVariantBtn = document.getElementById('addVariantBtn');
const variantsList = document.getElementById('variantsList');

addVariantBtn.addEventListener('click', () => {
    const name = variantNameInput.value.trim();
    const desc = variantDescInput ? variantDescInput.value.trim() : '';
    if (!name) return;

    currentVariants.push({ id: null, name, description: desc });
    variantNameInput.value = '';
    if (variantDescInput) variantDescInput.value = '';

    renderVariants();
});
// Renderizar la lista de variantes
function renderVariants() {
    variantsList.innerHTML = '';

    currentVariants.forEach((variant, index) => {
        const li = document.createElement('li');
        li.className = 'variant-row';
        li.innerHTML = `
            <input type="text" value="${escapeHTML(variant.name)}" data-index="${index}" class="variant-input" placeholder="Nombre" />
            <input type="text" value="${escapeHTML(variant.description || '')}" data-index-desc="${index}" class="variant-desc" placeholder="Descripción (opcional)" />
            <button type="button" data-index="${index}" class="delete-variant">✕</button>
        `;
        variantsList.appendChild(li);
    });

    // Actualizar nombre en tiempo real
    document.querySelectorAll('.variant-input').forEach(input => {
        input.addEventListener('input', e => {
            const index = e.target.dataset.index;
            currentVariants[index].name = e.target.value;
        });
    });

    // Actualizar descripcion en tiempo real
    document.querySelectorAll('.variant-desc').forEach(input => {
        input.addEventListener('input', e => {
            const index = e.target.dataset.indexDesc;
            currentVariants[index].description = e.target.value;
        });
    });

    // Eliminar variante
    document.querySelectorAll('.delete-variant').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = btn.dataset.index;
            currentVariants.splice(index, 1);
            renderVariants();
        });
    });
}


// ----------------- MODALES -----------------
function openAddModal() {
    if (!isAuthenticated()) {
        showNotification('Debe iniciar sesión para agregar productos', 'warning');
        return;
    }
    
    editingId = null;
    
    const modalTitle = document.getElementById("modal-title");
    if (modalTitle) {
        modalTitle.textContent = "Nuevo Producto";
    }
    
    resetProductForm();
    
    if (categoriesCache.length === 0) {
        loadCategories();
    } else {
        updateCategorySelect();
    }
    
    const modal = document.getElementById(PRODUCT_MODAL_ID);
    if (modal) {
        modal.classList.remove("hidden");
    } else {
        console.error(`Modal #${PRODUCT_MODAL_ID} no encontrado`);
        showNotification('Error: modal no encontrado', 'error');
    }
}

async function openEditModal(id) {
    if (!isAuthenticated()) {
        showNotification('Debe iniciar sesión para editar productos', 'warning');
        return;
    }
    
    editingId = id;
    
    try {
        showLoading(true);
        
        const res = await fetch(`${API}/products/${id}`, {
            headers: getAuthHeaders()
        });
        
        if (res.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            showNotification('Sesión expirada', 'error');
            setTimeout(() => window.location.href = 'login.html', 1500);
            return;
        }
        
        if (!res.ok) throw new Error("Error al obtener producto");
        
        const product = await res.json();

        const modalTitle = document.getElementById("modal-title");
        if (modalTitle) {
            modalTitle.textContent = "Editar Producto";
        }
        
        document.getElementById("prod-name").value = product.name || "";
        document.getElementById("prod-price").value = product.price || "";
        document.getElementById("prod-desc").value = product.description || "";
        document.getElementById("prod-cat").value = product.category_id || "";
        document.getElementById("prod-visible").checked = Boolean(product.visible);
        const hasVariantsCheckbox = document.getElementById('hasVariants');
        const variantsContainer = document.getElementById('variantsContainer');

        currentVariants = [];

        if (product.variants && product.variants.length > 0) {
            hasVariantsCheckbox.checked = true;
            variantsContainer.style.display = 'block';
        
            product.variants.forEach(v => {
                currentVariants.push({
                    id: v.id,
                    name: v.name,
                    description: v.description || ''
                });
            });
        } else {
            hasVariantsCheckbox.checked = false;
            variantsContainer.style.display = 'none';
        }

renderVariants();


        const modal = document.getElementById(PRODUCT_MODAL_ID);
        if (modal) {
            modal.classList.remove("hidden");
        }
        
    } catch (e) {
        console.error("Error en openEditModal:", e);
        showNotification("No se pudo cargar el producto", "error");
    } finally {
        showLoading(false);
    }
}

function closeModal() {
    const modal = document.getElementById(PRODUCT_MODAL_ID);
    if (modal) {
        modal.classList.add("hidden");
    }
    editingId = null;
}

function resetProductForm() {
    const nameInput = document.getElementById("prod-name");
    const priceInput = document.getElementById("prod-price");
    const descInput = document.getElementById("prod-desc");
    const catSelect = document.getElementById("prod-cat");
    const visibleCheck = document.getElementById("prod-visible");
    
    if (nameInput) nameInput.value = "";
    if (priceInput) priceInput.value = "";
    if (descInput) descInput.value = "";
    if (catSelect) catSelect.value = "";
    if (visibleCheck) visibleCheck.checked = true;

    currentVariants = [];
    renderVariants();

    const hasVariantsCheckbox = document.getElementById('hasVariants');
    const variantsContainer = document.getElementById('variantsContainer');

    if (hasVariantsCheckbox) hasVariantsCheckbox.checked = false;
    if (variantsContainer) variantsContainer.style.display = 'none';
}

// ----------------- GUARDAR PRODUCTO -----------------
async function saveProduct() {
    if (!isAuthenticated()) {
        showNotification('Debe iniciar sesión para guardar productos', 'warning');
        return;
    }
    
    const name = document.getElementById("prod-name")?.value.trim();
    const price = document.getElementById("prod-price")?.value.trim();
    const category_id = document.getElementById("prod-cat")?.value;
    const description = document.getElementById("prod-desc")?.value.trim() || "";
    const visible = document.getElementById("prod-visible")?.checked || false;

    if (!name) {
        showNotification("Ingrese nombre del producto", "warning");
        return;
    }
    
    if (!price || isNaN(price) || parseFloat(price) <= 0) {
        showNotification("Ingrese un precio válido", "warning");
        return;
    }
    
    if (!category_id) {
        showNotification("Seleccione una categoría", "warning");
        return;
    }

    
    const hasVariants = document.getElementById('hasVariants')?.checked || false;

        const productData = { 
            name,
            description,
            price: parseFloat(price),
            category_id: parseInt(category_id),
            visible: visible ? 1 : 0,
            has_variants: hasVariants,
            variants: hasVariants ? currentVariants.map(v => ({
                id: v.id ?? null,
                name: v.name,
                description: v.description || ''
            })) : []
        };

    console.log('Payload producto:', productData);

    const url = editingId ? `${API}/products/${editingId}` : `${API}/products`;
    const method = editingId ? "PUT" : "POST";

    try {
        showLoading(true);
        
        const res = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(productData)
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

        await loadProducts();
        closeModal();
        
        showNotification(
            editingId ? "✅ Producto actualizado" : "✅ Producto creado", 
            "success"
        );

    } catch (error) {
        console.error("Error en saveProduct:", error);
        showNotification("❌ Error: " + error.message, "error");
    } finally {
        showLoading(false);
    }
}

// ----------------- ELIMINAR PRODUCTO -----------------
async function deleteProduct(id) {
    // Open confirmation modal instead of immediate confirm
    openDeleteProductModal(id);
}

// Actual deletion logic moved to performDeleteProduct
async function performDeleteProduct(id) {
    if (!isAuthenticated()) {
        showNotification('Debe iniciar sesión para eliminar productos', 'warning');
        return;
    }

    try {
        showLoading(true);

        const res = await fetch(`${API}/products/${id}`, {
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

        await loadProducts();
        showNotification("✅ Producto eliminado", "success");

    } catch (error) {
        console.error("Error en performDeleteProduct:", error);
        showNotification("❌ Error al eliminar", "error");
    } finally {
        showLoading(false);
    }
}

// Modal helpers
function openDeleteProductModal(id) {
    const modal = document.getElementById('delete-product-modal');
    const nameSpan = document.getElementById('product-to-delete-name');
    const prodElem = document.querySelector(`.product-item[data-id="${id}"]`);
    const name = prodElem ? prodElem.querySelector('.prod-header h3')?.textContent || prodElem.dataset.item : prodElem?.dataset.item || '';
    if (nameSpan) nameSpan.textContent = name || '';
    if (modal) {
        modal.dataset.deleteId = id;
        modal.classList.remove('hidden');
    }
}

function closeDeleteProductModal() {
    const modal = document.getElementById('delete-product-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmDeleteProduct() {
    const modal = document.getElementById('delete-product-modal');
    if (!modal) return;
    const id = modal.dataset.deleteId;
    if (!id) return closeDeleteProductModal();
    performDeleteProduct(id);
    closeDeleteProductModal();
}

// ----------------- UTILIDADES -----------------
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

// ----------------- FUNCIONES DE UI -----------------
function showLoading(show) {
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

// ----------------- INICIALIZACIÓN -----------------
function initProductsSection() {
    console.log('🚀 Inicializando productos.js');
    console.log('Token presente:', !!localStorage.getItem('auth_token'));
    console.log('User data:', localStorage.getItem('user_data'));
    
    const productsSection = document.getElementById('products-section');
    const isInDashboard = !!productsSection;
    
    if (isInDashboard && productsSection) {
        console.log('✅ En dashboard, sección productos disponible');
        
        document.addEventListener('click', function(event) {
            const modal = document.getElementById(PRODUCT_MODAL_ID);
            if (modal && !modal.classList.contains('hidden') && 
                event.target === modal) {
                closeModal();
            }
        });
        
        document.addEventListener('keydown', function(event) {
            const modal = document.getElementById(PRODUCT_MODAL_ID);
            if (modal && !modal.classList.contains('hidden') && 
                event.key === 'Escape') {
                closeModal();
            }
        });
        
        if (!productsSection.classList.contains('hidden')) {
            console.log('📥 Cargando productos (sección visible)');
            loadProducts();
            loadCategories();
        }
    }
}

// ----------------- FUNCIONES GLOBALES -----------------
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.closeModal = closeModal;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.loadProducts = loadProducts;
window.loadCategories = loadCategories;
window.showLoading = showLoading;
window.showNotification = showNotification;
window.openDeleteProductModal = openDeleteProductModal;
window.closeDeleteProductModal = closeDeleteProductModal;
window.confirmDeleteProduct = confirmDeleteProduct;

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductsSection);
} else {
    initProductsSection();
}