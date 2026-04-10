// =========================================================================
// 1. CONFIGURACIÓN SUPABASE
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';

// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentRestauranteId = null;
let allReviews = [];

// =========================================================================
// 2. INICIALIZACIÓN DE LA PÁGINA
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {

    // Configurar Auth y Nav
    await configurarNavegacionAutenticada();

    // Obtener ID del restaurante de la URL (ej: restaurante.html?id=5)
    const urlParams = new URLSearchParams(window.location.search);
    currentRestauranteId = urlParams.get('id');

    if (!currentRestauranteId) {
        mostrarError("No se especificó ningún restaurante en la URL.");
        return;
    }

    // Cargar datos del restaurante y reseñas
    await cargarDetallesRestaurante();

    // Configurar botón "Escribir Reseña"
    document.getElementById('btn-dejar-resena').addEventListener('click', () => {
        window.location.href = `resena.html?restaurante_id=${currentRestauranteId}`;
    });

    // Configurar filtro de reseñas
    document.getElementById('sort-reviews').addEventListener('change', (e) => {
        renderizarResenas(e.target.value);
    });

    // Cargar lista para la barra de búsqueda superior
    cargarRestaurantesParaBusquedaNav();
});

// =========================================================================
// 3. FUNCIONES DE CARGA Y RENDERIZADO
// =========================================================================

async function cargarDetallesRestaurante() {
    try {
        // 1. Obtener información básica del restaurante
        const { data: restaurante, error: restError } = await supabaseClient
            .from('restaurantes')
            .select('*')
            .eq('id', currentRestauranteId)
            .single();

        if (restError || !restaurante) {
            throw new Error("No se encontró el restaurante.");
        }

        // Mostrar datos en el DOM
        document.getElementById('restaurante-nombre').textContent = restaurante.nombre;

        // Si tienes más campos en la tabla, puedes asignarlos aquí.
        // Ej: document.getElementById('restaurante-ubicacion').innerHTML = `<i class="fas fa-map-marker-alt mr-2 text-red-400"></i> ${restaurante.direccion}`;

        // 2. Obtener todas las reseñas de este restaurante
        // Hacemos JOIN con perfiles para obtener el nombre del usuario
        const { data: resenas, error: resenasError } = await supabaseClient
            .from('resenas')
            .select(`
                id,
                created_at,
                comentario,
                puntuacion_general,
                calidad_comida,
                atencion,
                precio,
                id_usuario,
                perfiles (nombre_usuario)
            `)
            .eq('id_restaurante', currentRestauranteId)
            .order('created_at', { ascending: false });

        if (resenasError) throw resenasError;

        allReviews = resenas || [];

        // 3. Calcular y mostrar promedios
        calcularYMostrarPromedios();

        // 4. Renderizar lista de reseñas
        renderizarResenas('recientes');

        // Mostrar el contenedor y ocultar el loading
        document.getElementById('loading-container').classList.add('hidden');
        document.getElementById('restaurant-container').classList.remove('hidden');

    } catch (err) {
        console.error("Error al cargar detalles:", err);
        mostrarError();
    }
}

function calcularYMostrarPromedios() {
    const totalCount = allReviews.length;
    document.getElementById('restaurante-resenas-count').textContent = totalCount;

    if (totalCount === 0) return;

    let sumGeneral = 0;
    let sumComida = 0;
    let sumAtencion = 0;
    let sumPrecio = 0;

    allReviews.forEach(r => {
        sumGeneral += r.puntuacion_general;
        sumComida += r.calidad_comida;
        sumAtencion += r.atencion;
        sumPrecio += r.precio;
    });

    const avgGeneral = (sumGeneral / totalCount).toFixed(1);
    const avgComida = (sumComida / totalCount).toFixed(1);
    const avgAtencion = (sumAtencion / totalCount).toFixed(1);
    const avgPrecio = (sumPrecio / totalCount).toFixed(1);

    document.getElementById('restaurante-rating').textContent = avgGeneral;

    document.getElementById('rating-comida').textContent = `${avgComida} ★`;
    document.getElementById('bar-comida').style.width = `${(avgComida / 5) * 100}%`;

    document.getElementById('rating-atencion').textContent = `${avgAtencion} ★`;
    document.getElementById('bar-atencion').style.width = `${(avgAtencion / 5) * 100}%`;

    document.getElementById('rating-precio').textContent = `${avgPrecio} ★`;
    document.getElementById('bar-precio').style.width = `${(avgPrecio / 5) * 100}%`;
}

function renderizarResenas(sortMode) {
    const container = document.getElementById('reviews-container');
    container.innerHTML = '';

    if (allReviews.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-gray-50 rounded-lg border border-gray-100">
                <i class="fas fa-comment-slash text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">Aún no hay reseñas para este restaurante.</p>
                <p class="text-sm text-gray-400 mt-1">¡Sé el primero en compartir tu experiencia!</p>
            </div>
        `;
        return;
    }

    // Copiar el array para no mutar el original al ordenar
    let sortedReviews = [...allReviews];

    if (sortMode === 'mejores') {
        sortedReviews.sort((a, b) => b.puntuacion_general - a.puntuacion_general);
    } else if (sortMode === 'peores') {
        sortedReviews.sort((a, b) => a.puntuacion_general - b.puntuacion_general);
    } // si es 'recientes', ya viene ordenado de BD.

    sortedReviews.forEach(resena => {
        const fechaObj = new Date(resena.created_at);
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        // Extraer nombre de usuario del join
        const nombreAutor = (resena.perfiles && resena.perfiles.nombre_usuario)
                            ? resena.perfiles.nombre_usuario
                            : 'Usuario Anónimo';

        // Generar HTML de las estrellitas generales
        let starsHtml = '';
        for(let i=1; i<=5; i++) {
            if(i <= resena.puntuacion_general) {
                starsHtml += '<i class="fas fa-star text-yellow-400"></i>';
            } else {
                starsHtml += '<i class="fas fa-star text-gray-300"></i>';
            }
        }

        const divResena = document.createElement('div');
        divResena.className = "border-b border-gray-100 last:border-b-0 pb-6 last:pb-0";

        divResena.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-red-100 text-[#c41200] rounded-full flex items-center justify-center font-bold">
                        ${nombreAutor.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-800">${nombreAutor}</h4>
                        <p class="text-xs text-gray-500">${fechaFormateada}</p>
                    </div>
                </div>
                <div class="flex text-sm bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                    ${starsHtml}
                </div>
            </div>

            <p class="text-gray-700 text-sm mb-3 bg-white p-2 rounded">${resena.comentario}</p>

            <div class="flex gap-4 text-xs text-gray-500">
                <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><i class="fas fa-utensils text-gray-400"></i> ${resena.calidad_comida}/5</span>
                <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><i class="fas fa-concierge-bell text-gray-400"></i> ${resena.atencion}/5</span>
                <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><i class="fas fa-money-bill-wave text-gray-400"></i> ${resena.precio}/5</span>
            </div>
        `;

        container.appendChild(divResena);
    });
}

function mostrarError(msg = null) {
    document.getElementById('loading-container').classList.add('hidden');
    document.getElementById('restaurant-container').classList.add('hidden');
    document.getElementById('error-container').classList.remove('hidden');

    if (msg) {
        document.getElementById('error-container').querySelector('p').textContent = msg;
    }
}

// =========================================================================
// 4. NAVEGACIÓN Y BÚSQUEDA
// =========================================================================

async function configurarNavegacionAutenticada() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session && session.user) {
        const { data: perfilData } = await supabaseClient
            .from('perfiles')
            .select('nombre_usuario')
            .eq('id', session.user.id)
            .single();

        let userDisplayName = session.user.email;
        if (perfilData && perfilData.nombre_usuario) {
            userDisplayName = perfilData.nombre_usuario;
        }

        const userStatusDiv = document.getElementById('user-status');
        if(userStatusDiv) {
            userStatusDiv.innerHTML = `
                <span class="text-sm text-white font-medium">Hola, ${userDisplayName}</span>
                <button id="logout-btn" class="text-sm bg-red-800 text-white px-3 py-1 rounded font-bold hover:bg-red-900 transition ml-2">Cerrar sesión</button>
            `;

            document.getElementById('logout-btn').addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                window.location.reload();
            });
        }
    }
}

let navRestaurantesCacheados = [];

async function cargarRestaurantesParaBusquedaNav() {
    try {
        const { data, error } = await supabaseClient
            .from('restaurantes')
            .select('id, nombre');

        if (!error && data) {
            navRestaurantesCacheados = data;
            configurarBarraBusquedaNav();
        }
    } catch (err) {
        console.error("Error cargando búsqueda nav:", err);
    }
}

function configurarBarraBusquedaNav() {
    const searchInput = document.getElementById('nav-search-input');
    const suggestionsContainer = document.getElementById('nav-search-suggestions');
    const suggestionsList = document.getElementById('nav-suggestions-list');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        if (query === '') {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        const coincidencias = navRestaurantesCacheados.filter(rest =>
            rest.nombre.toLowerCase().includes(query)
        );

        suggestionsList.innerHTML = '';

        if (coincidencias.length === 0) {
            suggestionsList.innerHTML = '<li class="px-4 py-3 text-gray-500 text-sm text-center">No se encontraron restaurantes</li>';
        } else {
            const topResultados = coincidencias.slice(0, 5);
            topResultados.forEach(rest => {
                const li = document.createElement('li');
                li.className = 'px-4 py-3 hover:bg-red-50 cursor-pointer border-b border-gray-100 transition last:border-b-0 text-gray-800 flex items-center text-sm';

                const regex = new RegExp(`(${query})`, "gi");
                const nombreResaltado = rest.nombre.replace(regex, "<span class='font-bold text-[#c41200]'>$1</span>");

                li.innerHTML = `<i class="fas fa-utensils text-gray-400 mr-3"></i> ${nombreResaltado}`;

                li.addEventListener('click', () => {
                    window.location.href = `restaurante.html?id=${rest.id}`;
                });

                suggestionsList.appendChild(li);
            });
        }

        suggestionsContainer.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.classList.add('hidden');
        }
    });
}
