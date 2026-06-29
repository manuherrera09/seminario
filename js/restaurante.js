let currentRestauranteId = null;
let allReviews = [];
// currentUserId and supabaseClient are now global, provided by app.js

// --- Variables para el Modal de Imágenes ---
let currentImageUrls = [];
let currentImageIndex = 0;

// =========================================================================
// 2. INICIALIZACIÓN DE LA PÁGINA
// =========================================================================
function initRestaurantePage() {
    // Obtener ID del restaurante de la URL (ej: restaurante.html?id=5)
    const urlParams = new URLSearchParams(window.location.search);
    currentRestauranteId = urlParams.get('id');

    if (!currentRestauranteId) {
        mostrarError("No se especificó ningún restaurante en la URL.");
        return;
    }

    // Cargar datos del restaurante y reseñas
    cargarDetallesRestaurante();

    // Configurar botón "Escribir Reseña"
    const btnDejarResena = document.getElementById('btn-dejar-resena');
    if (btnDejarResena) {
        btnDejarResena.addEventListener('click', () => {
            window.location.href = `resena.html?restaurante_id=${currentRestauranteId}`;
        });
    }

    // Configurar filtro de reseñas
    const sortReviews = document.getElementById('sort-reviews');
    if (sortReviews) {
        sortReviews.addEventListener('change', (e) => {
            renderizarResenas(e.target.value);
        });
    }

    // --- Listeners para el Modal de Imágenes ---
    const closeImageModalBtn = document.getElementById('close-image-modal');
    const prevImageBtn = document.getElementById('modal-prev-btn');
    const nextImageBtn = document.getElementById('modal-next-btn');

    if(closeImageModalBtn) closeImageModalBtn.addEventListener('click', closeImageModal);
    if(prevImageBtn) prevImageBtn.addEventListener('click', () => changeModalImage(-1));
    if(nextImageBtn) nextImageBtn.addEventListener('click', () => changeModalImage(1));
}

// Escuchar el evento personalizado desde app.js o ejecutar directamente si ya está listo
if (typeof navAuthReady !== 'undefined' && navAuthReady) {
    initRestaurantePage();
} else {
    document.addEventListener('navAuthReady', initRestaurantePage);
}


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
                <a href="${restaurante.url_website}" target="_blank" rel="noopener noreferrer" class="flex items-center text-[var(--color-text-primary)] hover:text-[#c41200] transition p-2 hover:bg-red-50 rounded-lg">
                    <div class="w-8 flex justify-center"><i class="fas fa-globe text-xl text-blue-500"></i></div>
                    <span class="ml-2 font-medium">Sitio Web Oficial</span>
                    <i class="fas fa-external-link-alt ml-auto text-xs text-[var(--color-text-secondary)]"></i>
                </a>
            `;
        }

        if (restaurante.url_ig && restaurante.url_ig.trim() !== '') {
            hasLinks = true;
            linksContainer.innerHTML += `
                <a href="${restaurante.url_ig}" target="_blank" rel="noopener noreferrer" class="flex items-center text-[var(--color-text-primary)] hover:text-[#c41200] transition p-2 hover:bg-red-50 rounded-lg">
                    <div class="w-8 flex justify-center"><i class="fab fa-instagram text-2xl text-pink-600"></i></div>
                    <span class="ml-2 font-medium">Instagram</span>
                    <i class="fas fa-external-link-alt ml-auto text-xs text-[var(--color-text-secondary)]"></i>
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
        // Hacemos JOIN con perfiles para obtener el nombre y la imagen del usuario
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
                urls_imagenes,
                perfiles (nombre_usuario, imagen_url)
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
        const divInfo = document.querySelector('.bg-\\[var\\(--color-surface\\)\\] .space-y-4');
        if (divInfo) {
            divInfo.innerHTML += `
                <div>
                   <div class="flex justify-between text-sm mb-1">
                       <span class="font-medium text-[var(--color-text-primary)]">Ambiente</span>
                       <span class="font-bold" id="rating-ambiente">${avgAmbiente} ★</span>
                   </div>
                   <div class="w-full bg-[var(--color-surface-secondary)] rounded-full h-2">
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
            <div class="text-center py-10 bg-[var(--color-surface-secondary)] rounded-lg border border-[var(--color-border)]">
                <i class="fas fa-comment-slash text-4xl text-[var(--color-text-secondary)] mb-3"></i>
                <p class="text-[var(--color-text-secondary)]">Aún no hay reseñas para este restaurante.</p>
                <p class="text-sm text-[var(--color-text-secondary)] mt-1">¡Sé el primero en compartir tu experiencia!</p>
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
    } else if (sortMode === 'antiguas') {
        sortedReviews.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
        // 'recientes' (por defecto)
        sortedReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    sortedReviews.forEach(resena => {
        const divResena = document.createElement('div');
        divResena.className = "border-b border-[var(--color-border)] last:border-b-0 pb-6 last:pb-0";

        // --- Generar HTML para las miniaturas de imágenes ---
        let imagesHTML = '';
        if (resena.urls_imagenes && resena.urls_imagenes.length > 0) {
            const imageElements = resena.urls_imagenes.map((url, index) => `
                <img src="${url}" alt="Miniatura de reseña ${index + 1}"
                     class="w-full h-24 object-cover rounded-md cursor-pointer hover:opacity-80 transition"
                     onclick="openImageModal(event, ${index})">
            `).join('');

            divResena.dataset.imageUrls = JSON.stringify(resena.urls_imagenes);

            imagesHTML = `
                <div class="w-1/3 pr-4 flex-shrink-0">
                    <div class="grid grid-cols-1 gap-2">
                        ${imageElements}
                    </div>
                </div>
            `;
        }

        const fechaObj = new Date(resena.created_at);
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const autor = resena.perfiles;
        const nombreAutor = autor ? autor.nombre_usuario : 'Usuario Anónimo';
        const imagenAutor = autor ? autor.imagen_url : null;

        let avatarHtml;
        if (imagenAutor) {
            avatarHtml = `<img src="${imagenAutor}" alt="Foto de ${nombreAutor}" class="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-90 transition" onclick="window.location.href='perfil.html?id=${resena.id_usuario}'" title="Ver perfil de ${nombreAutor}">`;
        } else {
            avatarHtml = `<div class="w-10 h-10 bg-red-100 text-[#c41200] rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-red-200 transition" onclick="window.location.href='perfil.html?id=${resena.id_usuario}'" title="Ver perfil de ${nombreAutor}">
                            ${nombreAutor.charAt(0).toUpperCase()}
                        </div>`;
        }

        let starsHtml = '';
        const rating = resena.puntuacion_general || 0;
        const fullStars = Math.floor(rating);
        const hasHalfStar = (rating - fullStars) >= 0.25 && (rating - fullStars) < 0.75;
        const extraFullStar = (rating - fullStars) >= 0.75 ? 1 : 0;
        const totalFullStars = fullStars + extraFullStar;

        for(let i=1; i<=5; i++) {
            if(i <= totalFullStars) {
                starsHtml += '<i class="fas fa-star text-yellow-400"></i>';
            } else if(i === totalFullStars + 1 && hasHalfStar) {
                starsHtml += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
            } else {
                starsHtml += '<i class="far fa-star text-gray-300"></i>';
            }
        }

        let extraRatingsHTML = '';
        if (resena.ambiente) {
            extraRatingsHTML = `<span class="flex items-center gap-1 bg-[var(--color-surface-secondary)] px-2 py-1 rounded"><i class="fas fa-music text-[var(--color-text-secondary)]"></i> ${resena.ambiente}/5</span>`;
        }

        const likeClass = resena.userVoto === 'like' ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50';
        const dislikeClass = resena.userVoto === 'dislike' ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50';

        divResena.innerHTML = `
            <div class="flex">
                ${imagesHTML}
                <div class="flex-grow">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-3">
                            ${avatarHtml}
                            <div>
                                <h4 class="font-bold text-[var(--color-text-primary)] cursor-pointer hover:underline hover:text-[#c41200]" onclick="window.location.href='perfil.html?id=${resena.id_usuario}'">${nombreAutor}</h4>
                                <p class="text-xs text-[var(--color-text-secondary)]">${fechaFormateada}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="flex text-sm bg-[var(--color-surface-secondary)] px-2 py-1 rounded-md border border-[var(--color-border)]">
                                ${starsHtml}
                            </div>
                            <button onclick="leerResena('${resena.comentario.replace(/'/g, "\\'")}')" class="text-[var(--color-text-secondary)] hover:text-[#c41200] transition" title="Leer reseña en voz alta">
                                <i class="fas fa-volume-up"></i>
                            </button>
                        </div>
                    </div>

                    <p class="text-[var(--color-text-primary)] text-sm mb-3 bg-[var(--color-surface)] p-2 rounded">${resena.comentario}</p>

                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex gap-4 text-xs text-[var(--color-text-secondary)] flex-wrap">
                            <span class="flex items-center gap-1 bg-[var(--color-surface-secondary)] px-2 py-1 rounded"><i class="fas fa-utensils text-[var(--color-text-secondary)]"></i> ${resena.calidad_comida}/5</span>
                            <span class="flex items-center gap-1 bg-[var(--color-surface-secondary)] px-2 py-1 rounded"><i class="fas fa-concierge-bell text-[var(--color-text-secondary)]"></i> ${resena.atencion}/5</span>
                            <span class="flex items-center gap-1 bg-[var(--color-surface-secondary)] px-2 py-1 rounded"><i class="fas fa-money-bill-wave text-[var(--color-text-secondary)]"></i> ${resena.precio}/5</span>
                            ${extraRatingsHTML}
                        </div>

                        <div class="flex items-center gap-2">
                            <button class="btn-like flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${likeClass}" data-resena-id="${resena.id}" data-autor-id="${resena.id_usuario}">
                                <i class="fas fa-thumbs-up pointer-events-none"></i> <span class="like-count pointer-events-none">${resena.likes}</span>
                            </button>
                            <button class="btn-dislike flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${dislikeClass}" data-resena-id="${resena.id}">
                                <i class="fas fa-thumbs-down pointer-events-none"></i> <span class="dislike-count pointer-events-none">${resena.dislikes}</span>
                            </button>
                            <button onclick="handleReportReview('${resena.id}', '${resena.id_usuario}')" class="text-gray-400 hover:text-orange-500 hover:bg-orange-50 flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold" title="Denunciar reseña">
                                <i class="fas fa-flag pointer-events-none"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(divResena);
    });

    configurarVotos(); // This will now call the function from app.js
}

function mostrarError(msg = null) {
    document.getElementById('loading-container').classList.add('hidden');
    document.getElementById('restaurant-container').classList.add('hidden');
    document.getElementById('error-container').classList.remove('hidden');

    if (msg) {
        document.getElementById('error-container').querySelector('p').textContent = msg;
    }
}

// --- Funciones para el Modal de Imágenes ---
function openImageModal(event, index) {
    const reviewElement = event.target.closest('[data-image-urls]');
    if (!reviewElement) return;

    const urls = JSON.parse(reviewElement.dataset.imageUrls);

    currentImageUrls = urls;
    currentImageIndex = index;

    document.getElementById('image-modal').classList.remove('hidden');
    updateModalImage();
}

function closeImageModal() {
    document.getElementById('image-modal').classList.add('hidden');
    currentImageUrls = [];
    currentImageIndex = 0;
}

function changeModalImage(direction) {
    currentImageIndex += direction;
    updateModalImage();
}

function updateModalImage() {
    const modalImage = document.getElementById('modal-image-content');
    const prevBtn = document.getElementById('modal-prev-btn');
    const nextBtn = document.getElementById('modal-next-btn');

    modalImage.src = currentImageUrls[currentImageIndex];

    // Mostrar/ocultar botones de navegación
    prevBtn.classList.toggle('hidden', currentImageIndex === 0);
    nextBtn.classList.toggle('hidden', currentImageIndex === currentImageUrls.length - 1);
}
