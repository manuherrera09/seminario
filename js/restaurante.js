// =========================================================================
// 1. CONFIGURACIÓN SUPABASE
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';

// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentRestauranteId = null;
let allReviews = [];
let currentUserId = null; // Guardar ID de sesión para los votos

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

        // Lógica de la imagen de portada
        const imagenEl = document.getElementById('restaurante-imagen');
        const noImagenEl = document.getElementById('restaurante-no-imagen');

        if (restaurante.imagen_url && restaurante.imagen_url.trim() !== '') {
            imagenEl.src = restaurante.imagen_url;
            imagenEl.classList.remove('hidden');
            noImagenEl.classList.add('hidden');
        } else {
            imagenEl.classList.add('hidden');
            noImagenEl.classList.remove('hidden');
        }

        // Llenar información de la columna izquierda (categoría, horario, teléfono)
        const tipoEl = document.getElementById('restaurante-tipo');
        const horarioEl = document.getElementById('restaurante-horario');
        const telefonoEl = document.getElementById('restaurante-telefono');

        if (restaurante.categoria) {
            tipoEl.textContent = restaurante.categoria;
        }

        if (restaurante.horario) {
            let horarioHTML = '<ul class="mt-1 space-y-1">';
            // Como es JSONB, restaurante.horario ya debería ser un objeto de JS
            const dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

            // Convertir las claves del JSON a un formato que podamos comparar (ignorar mayúsculas)
            const horarioNormalizado = {};
            if (typeof restaurante.horario === 'object') {
                for (const [key, value] of Object.entries(restaurante.horario)) {
                    horarioNormalizado[key.toLowerCase()] = value;
                }
            }

            dias.forEach(dia => {
                const diaKey = dia.toLowerCase();
                if (horarioNormalizado[diaKey]) {
                    horarioHTML += `<li><span class="font-medium inline-block w-20">${dia}:</span> ${horarioNormalizado[diaKey]}</li>`;
                }
            });
            horarioHTML += '</ul>';

            // Si encontró al menos un día, mostramos la lista, sino el raw o nada
            if (horarioHTML !== '<ul class="mt-1 space-y-1"></ul>') {
                 // Quitamos la clase 'flex items-start' del li padre para que la lista de horarios se vea bien debajo del ícono de reloj
                 const liPadre = horarioEl.closest('li');
                 if(liPadre) {
                     liPadre.classList.remove('items-start');
                     liPadre.classList.add('items-baseline');
                 }
                 horarioEl.innerHTML = `<span class="font-semibold block mb-1">Horarios:</span>${horarioHTML}`;
            } else {
                 horarioEl.textContent = "Horarios no estructurados";
            }
        }

        if (restaurante.telefono) {
            telefonoEl.textContent = restaurante.telefono;
        }

        // Mostrar y linkear la dirección en Google Maps
        const ubicacionEl = document.getElementById('restaurante-ubicacion');
        if (restaurante.direccion && restaurante.direccion.trim() !== '') {
            // Creamos un link de búsqueda en Google Maps basado en el nombre y la dirección
            const queryParaMaps = encodeURIComponent(`${restaurante.nombre} ${restaurante.direccion}`);
            const linkGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${queryParaMaps}`;

            ubicacionEl.innerHTML = `
                <a href="${linkGoogleMaps}" target="_blank" rel="noopener noreferrer" class="hover:text-white hover:underline transition flex items-center group">
                    <i class="fas fa-map-marker-alt mr-2 text-red-400 group-hover:text-red-300"></i>
                    ${restaurante.direccion}
                    <i class="fas fa-external-link-alt ml-2 text-xs opacity-50 group-hover:opacity-100"></i>
                </a>
            `;
        } else {
            ubicacionEl.innerHTML = `<i class="fas fa-map-marker-alt mr-2 text-red-400"></i> Ubicación no especificada`;
        }

        // Mostrar Redes Sociales y Web
        const redesContainer = document.getElementById('restaurante-enlaces');
        const linksContainer = document.getElementById('contenedor-links');

        let hasLinks = false;
        linksContainer.innerHTML = ''; // Limpiar anteriores por si acaso

        if (restaurante.url_website && restaurante.url_website.trim() !== '') {
            hasLinks = true;
            linksContainer.innerHTML += `
                <a href="${restaurante.url_website}" target="_blank" rel="noopener noreferrer" class="flex items-center text-gray-700 hover:text-[#c41200] transition p-2 hover:bg-red-50 rounded-lg">
                    <div class="w-8 flex justify-center"><i class="fas fa-globe text-xl text-blue-500"></i></div>
                    <span class="ml-2 font-medium">Sitio Web Oficial</span>
                    <i class="fas fa-external-link-alt ml-auto text-xs text-gray-400"></i>
                </a>
            `;
        }

        if (restaurante.url_ig && restaurante.url_ig.trim() !== '') {
            hasLinks = true;
            linksContainer.innerHTML += `
                <a href="${restaurante.url_ig}" target="_blank" rel="noopener noreferrer" class="flex items-center text-gray-700 hover:text-[#c41200] transition p-2 hover:bg-red-50 rounded-lg">
                    <div class="w-8 flex justify-center"><i class="fab fa-instagram text-2xl text-pink-600"></i></div>
                    <span class="ml-2 font-medium">Instagram</span>
                    <i class="fas fa-external-link-alt ml-auto text-xs text-gray-400"></i>
                </a>
            `;
        }

        // Si existe al menos un link, mostramos la tarjeta
        if (hasLinks) {
            redesContainer.classList.remove('hidden');
        } else {
            redesContainer.classList.add('hidden');
        }

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
                ambiente,
                id_usuario,
                perfiles (nombre_usuario)
            `)
            .eq('id_restaurante', currentRestauranteId)
            .order('created_at', { ascending: false });

        if (resenasError) throw resenasError;

        // 2.1 Cargar VOTOS de las reseñas
        let votosData = [];
        if (resenas && resenas.length > 0) {
            const resenasIds = resenas.map(r => r.id);
            const { data: votos, error: errVotos } = await supabaseClient
                .from('resenas_votos')
                .select('resena_id, usuario_id, tipo')
                .in('resena_id', resenasIds);

            if (!errVotos && votos) {
                votosData = votos;
            }
        }

        // Inyectar los votos dentro de cada reseña en allReviews
        allReviews = (resenas || []).map(resena => {
            const misVotos = votosData.filter(v => v.resena_id === resena.id);
            return {
                ...resena,
                likes: misVotos.filter(v => v.tipo === 'like').length,
                dislikes: misVotos.filter(v => v.tipo === 'dislike').length,
                userVoto: currentUserId ? misVotos.find(v => v.usuario_id === currentUserId)?.tipo : null
            };
        });

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
    let sumAmbiente = 0;

    let ambienteCount = 0; // Para no promediar los que no tienen ambiente (los viejos)

    allReviews.forEach(r => {
        sumGeneral += r.puntuacion_general;
        sumComida += r.calidad_comida;
        sumAtencion += r.atencion;
        sumPrecio += r.precio;
        if (r.ambiente) {
            sumAmbiente += r.ambiente;
            ambienteCount++;
        }
    });

    const avgGeneral = (sumGeneral / totalCount).toFixed(1);
    const avgComida = (sumComida / totalCount).toFixed(1);
    const avgAtencion = (sumAtencion / totalCount).toFixed(1);
    const avgPrecio = (sumPrecio / totalCount).toFixed(1);

    let avgAmbiente = 0;
    if (ambienteCount > 0) {
        avgAmbiente = (sumAmbiente / ambienteCount).toFixed(1);
    }

    document.getElementById('restaurante-rating').textContent = avgGeneral;

    document.getElementById('rating-comida').textContent = `${avgComida} ★`;
    document.getElementById('bar-comida').style.width = `${(avgComida / 5) * 100}%`;

    document.getElementById('rating-atencion').textContent = `${avgAtencion} ★`;
    document.getElementById('bar-atencion').style.width = `${(avgAtencion / 5) * 100}%`;

    document.getElementById('rating-precio').textContent = `${avgPrecio} ★`;
    document.getElementById('bar-precio').style.width = `${(avgPrecio / 5) * 100}%`;

    // Buscar si ya existe el bar de ambiente en el DOM, si no, lo agregamos dinámicamente
    let barAmbiente = document.getElementById('bar-ambiente');
    if (!barAmbiente && ambienteCount > 0) {
        const divInfo = document.querySelector('.bg-white.p-6.rounded-lg.shadow-md .space-y-4');
        if (divInfo) {
            divInfo.innerHTML += `
                <div>
                   <div class="flex justify-between text-sm mb-1">
                       <span class="font-medium text-gray-700">Ambiente</span>
                       <span class="font-bold" id="rating-ambiente">${avgAmbiente} ★</span>
                   </div>
                   <div class="w-full bg-gray-200 rounded-full h-2">
                       <div class="bg-yellow-400 h-2 rounded-full" id="bar-ambiente" style="width: ${(avgAmbiente / 5) * 100}%"></div>
                   </div>
               </div>
            `;
        }
    } else if (barAmbiente && ambienteCount > 0) {
        document.getElementById('rating-ambiente').textContent = `${avgAmbiente} ★`;
        barAmbiente.style.width = `${(avgAmbiente / 5) * 100}%`;
    }
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

        // Determinar cuántas estrellas llenas, medias o vacías dibujar
        const rating = resena.puntuacion_general || 0;
        const fullStars = Math.floor(rating);
        const hasHalfStar = (rating - fullStars) >= 0.25 && (rating - fullStars) < 0.75;
        const extraFullStar = (rating - fullStars) >= 0.75 ? 1 : 0;

        const totalFullStars = fullStars + extraFullStar;

        for(let i=1; i<=5; i++) {
            if(i <= totalFullStars) {
                // Estrella llena
                starsHtml += '<i class="fas fa-star text-yellow-400"></i>';
            } else if(i === totalFullStars + 1 && hasHalfStar) {
                // Media estrella
                starsHtml += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
            } else {
                // Estrella vacía
                starsHtml += '<i class="far fa-star text-gray-300"></i>';
            }
        }

        let extraRatingsHTML = '';
        if (resena.ambiente) {
            extraRatingsHTML = `<span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><i class="fas fa-music text-gray-400"></i> ${resena.ambiente}/5</span>`;
        }

        // Lógica de botones de like/dislike visuales
        const likeClass = resena.userVoto === 'like' ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50';
        const dislikeClass = resena.userVoto === 'dislike' ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50';

        const divResena = document.createElement('div');
        divResena.className = "border-b border-gray-100 last:border-b-0 pb-6 last:pb-0";

        divResena.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-red-100 text-[#c41200] rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-red-200 transition" onclick="window.location.href='perfil.html?id=${resena.id_usuario}'" title="Ver perfil de ${nombreAutor}">
                        ${nombreAutor.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-800 cursor-pointer hover:underline hover:text-[#c41200]" onclick="window.location.href='perfil.html?id=${resena.id_usuario}'">${nombreAutor}</h4>
                        <p class="text-xs text-gray-500">${fechaFormateada}</p>
                    </div>
                </div>
                <div class="flex text-sm bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                    ${starsHtml}
                </div>
            </div>

            <p class="text-gray-700 text-sm mb-3 bg-white p-2 rounded">${resena.comentario}</p>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex gap-4 text-xs text-gray-500 flex-wrap">
                    <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><i class="fas fa-utensils text-gray-400"></i> ${resena.calidad_comida}/5</span>
                    <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><i class="fas fa-concierge-bell text-gray-400"></i> ${resena.atencion}/5</span>
                    <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><i class="fas fa-money-bill-wave text-gray-400"></i> ${resena.precio}/5</span>
                    ${extraRatingsHTML}
                </div>

                <div class="flex items-center gap-2">
                    <button class="btn-like flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${likeClass}" data-resena-id="${resena.id}">
                        <i class="fas fa-thumbs-up"></i> <span class="like-count">${resena.likes}</span>
                    </button>
                    <button class="btn-dislike flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${dislikeClass}" data-resena-id="${resena.id}">
                        <i class="fas fa-thumbs-down"></i> <span class="dislike-count">${resena.dislikes}</span>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(divResena);
    });

    configurarVotos();
}

function mostrarError(msg = null) {
    document.getElementById('loading-container').classList.add('hidden');
    document.getElementById('restaurant-container').classList.add('hidden');
    document.getElementById('error-container').classList.remove('hidden');

    if (msg) {
        document.getElementById('error-container').querySelector('p').textContent = msg;
    }
}

// Lógica de interacción para los botones de Like/Dislike
function configurarVotos() {
    const btnLikes = document.querySelectorAll('.btn-like');
    const btnDislikes = document.querySelectorAll('.btn-dislike');

    const procesarVoto = async (resenaId, tipoVotoDeseado, botonClickado) => {
        if (!currentUserId) {
            alert("Debes iniciar sesión para votar.");
            window.location.href = 'login.html';
            return;
        }

        const contenedorResena = botonClickado.closest('.flex.items-center.gap-2');
        const btnLike = contenedorResena.querySelector('.btn-like');
        const btnDislike = contenedorResena.querySelector('.btn-dislike');

        const spanLikeCount = btnLike.querySelector('.like-count');
        const spanDislikeCount = btnDislike.querySelector('.dislike-count');

        let isCurrentlyLiked = btnLike.classList.contains('text-green-600');
        let isCurrentlyDisliked = btnDislike.classList.contains('text-red-600');

        let currentLikeCount = parseInt(spanLikeCount.textContent);
        let currentDislikeCount = parseInt(spanDislikeCount.textContent);

        // Deshabilitar botones temporalmente
        btnLike.disabled = true;
        btnDislike.disabled = true;

        try {
            if (tipoVotoDeseado === 'like') {
                if (isCurrentlyLiked) {
                    // Quitar like
                    await supabaseClient.from('resenas_votos').delete().match({ resena_id: resenaId, usuario_id: currentUserId });

                    btnLike.classList.remove('text-green-600', 'bg-green-50');
                    btnLike.classList.add('text-gray-400');
                    spanLikeCount.textContent = currentLikeCount - 1;
                } else {
                    // Poner like (Upsert para sobreescribir dislike si existe)
                    await supabaseClient.from('resenas_votos').upsert({ resena_id: resenaId, usuario_id: currentUserId, tipo: 'like' });

                    btnLike.classList.remove('text-gray-400');
                    btnLike.classList.add('text-green-600', 'bg-green-50');
                    spanLikeCount.textContent = currentLikeCount + 1;

                    if (isCurrentlyDisliked) {
                        btnDislike.classList.remove('text-red-600', 'bg-red-50');
                        btnDislike.classList.add('text-gray-400');
                        spanDislikeCount.textContent = currentDislikeCount - 1;
                    }
                }
            } else if (tipoVotoDeseado === 'dislike') {
                if (isCurrentlyDisliked) {
                    // Quitar dislike
                    await supabaseClient.from('resenas_votos').delete().match({ resena_id: resenaId, usuario_id: currentUserId });

                    btnDislike.classList.remove('text-red-600', 'bg-red-50');
                    btnDislike.classList.add('text-gray-400');
                    spanDislikeCount.textContent = currentDislikeCount - 1;
                } else {
                    // Poner dislike
                    await supabaseClient.from('resenas_votos').upsert({ resena_id: resenaId, usuario_id: currentUserId, tipo: 'dislike' });

                    btnDislike.classList.remove('text-gray-400');
                    btnDislike.classList.add('text-red-600', 'bg-red-50');
                    spanDislikeCount.textContent = currentDislikeCount + 1;

                    if (isCurrentlyLiked) {
                        btnLike.classList.remove('text-green-600', 'bg-green-50');
                        btnLike.classList.add('text-gray-400');
                        spanLikeCount.textContent = currentLikeCount - 1;
                    }
                }
            }
        } catch (err) {
            console.error("Error al registrar voto:", err);
            alert("No se pudo registrar tu voto.");
        } finally {
            btnLike.disabled = false;
            btnDislike.disabled = false;
        }
    };

    btnLikes.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            procesarVoto(btn.dataset.resenaId, 'like', btn);
        });
    });

    btnDislikes.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            procesarVoto(btn.dataset.resenaId, 'dislike', btn);
        });
    });
}

// =========================================================================
// 4. NAVEGACIÓN Y BÚSQUEDA
// =========================================================================

async function configurarNavegacionAutenticada() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session && session.user) {
        currentUserId = session.user.id; // Lo guardamos para la lógica de votos

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
