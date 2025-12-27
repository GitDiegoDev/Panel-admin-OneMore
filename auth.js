
// Usar la variable global `window.API_BASE` si existe, si no crear una por defecto
if (!window.API_BASE) window.API_BASE = "https://backend-menu-production.up.railway.app/api";

// Verificar autenticación al cargar
async function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    console.log('🔐 Verificando autenticación...');
    console.log('Token en localStorage:', token ? 'Presente' : 'Ausente');
    console.log('User data:', userData);
    
    // Si no hay token, redirigir al login
    if (!token) {
        console.log('❌ No hay token, redirigiendo a login');
        window.location.href = "login.html";
        return false;
    }
    
    // Verificar si estamos en dashboard
    const isDashboard = window.location.pathname.includes('dashboard') || 
                        window.location.pathname.includes('panel.html');
    
    // Si no estamos en dashboard pero tenemos token, ir al dashboard
    if (token && !isDashboard && !window.location.pathname.includes('login.html')) {
        console.log('✅ Token encontrado, redirigiendo a dashboard');
        window.location.href = "panel.html";
        return true;
    }
    
    // Si estamos en dashboard, verificar token (pero no redirigir inmediatamente si falla)
    if (isDashboard) {
        try {
            console.log('🔄 Verificando token con servidor...');
            const response = await fetch(`${window.API_BASE}/check-auth`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            
            console.log('Respuesta check-auth:', response.status);
            
            if (response.ok) {
                console.log('✅ Token válido');
                // Mostrar nombre de usuario
                if (document.getElementById('username') && userData) {
                    try {
                        const user = JSON.parse(userData);
                        document.getElementById('username').textContent = user.name || 'Administrador';
                    } catch (e) {
                        console.warn('Error parseando user_data:', e);
                    }
                }
                return true;
            } else {
                console.warn('⚠️ Token inválido o expirado');
                // No redirigir inmediatamente, solo marcar como no autenticado
                // Esto permite que el usuario siga usando la app temporalmente
                return false;
            }
        } catch (error) {
            console.warn('⚠️ Error verificando auth (posible problema de conexión):', error);
            // No redirigir si hay error de conexión
            return true; // Permitir continuar
        }
    }
    
    return true;
}

// Función de login (con loader)
async function login(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loader = document.getElementById('loginLoader');

    try {
        if (loader) loader.classList.remove('hidden');

        const response = await fetch(`${window.API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Login exitoso');
            // Guardar token y datos de usuario
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            localStorage.setItem('user_role', data.user.role || 'owner');

            // pequeña pausa visual antes de redirigir
            setTimeout(() => {
                if (loader) loader.classList.add('hidden');
                window.location.href = "panel.html";
            }, 500);
        } else {
            console.error('❌ Error en login:', data.message);
            if (loader) loader.classList.add('hidden');
            alert(data.message || 'Error en el login');
        }
    } catch (error) {
        if (loader) loader.classList.add('hidden');
        console.error('💥 Error de conexión:', error);
        alert('Error de conexión con el servidor. Verifica que Laravel esté ejecutándose.');
    }
}

// Función de logout
function logout() {
    console.log('👋 Cerrando sesión...');
    
    // Intentar logout en el servidor (pero no bloquear si falla)
    const token = localStorage.getItem('auth_token');
    if (token) {
        fetch(`${window.API_BASE}/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        }).catch(console.warn); // Ignorar errores
    }
    
    // Limpiar localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_role');
    
    // Redirigir al login
    window.location.href = "login.html";
}

// Función para obtener headers con auth
function getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
}

// Para usar en formularios
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', login);
}

// Hacer checkAuth disponible globalmente
window.checkAuth = checkAuth;
window.logout = logout;
window.getAuthHeaders = getAuthHeaders;