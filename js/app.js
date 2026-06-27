// =========================================================================
// 1. CONFIGURACIÓN SUPABASE (Reemplaza con tus llaves reales de Supabase)
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';

// Inicializamos el cliente de Supabase
// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let restaurantesCacheados = [];
let perfilesCacheados = [];
let currentUserId = null;
let navAuthReady = false;

// Evento principal para App.js y para disparar la inicialización de otras páginas
document.addEventListener('DOMContentLoaded', async () => {
  // ---- Carrusel ----
  const slides = document.querySelectorAll('.bg-slide');
  if (slides.length > 0) {
      let currentSlide = 0;
      const nextSlide = () => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
      };
      setInterval(nextSlide, 5000);
  }

  // ---- Autenticación y NavBar ----
  try {
      await configurarNavegacionAutenticada();
  } catch (err) {
      console.error("Error al configurar navegación:", err);
  } finally {
      navAuthReady = true;
      // Disparar evento para que otras páginas sepan que la sesión está lista
      document.dispatchEvent(new Event('navAuthReady'));
  }

  // ---- Cargar lista de restaurantes y usuarios para la búsqueda ----
  cargarDatosParaBusqueda();

  // ---- Cargar Sugerencias y Tendencias ----
  if (document.querySelector('.tendencias-container')) {
      cargarSugerencias();
      cargarTendencias();
  }

  // ---- Cargar reseñas recientes si estamos en el index ----
  if (document.getElementById('recent-reviews-container')) {
    cargarResenasRecientes();
  }
});

// =========================================================================
// 2. FUNCIONES DE UTILIDAD (Texto a Voz)
// =========================================================================
/**
 * Lee en voz alta el texto proporcionado. Detiene cualquier lectura anterior.
 * @param {string} texto - El texto a leer.
 */
function leerResena(texto) {
  // Detener cualquier lectura en curso para evitar solapamientos
  window.speechSynthesis.cancel();

  // Crear un nuevo objeto de enunciado
  const enunciado = new SpeechSynthesisUtterance(texto);
  enunciado.lang = 'es-ES'; // Establecer el idioma a español

  // Iniciar la lectura
  window.speechSynthesis.speak(enunciado);
}


async function configurarNavegacionAutenticada() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (session && session.user) {
        currentUserId = session.user.id;

        // Buscamos su información en la tabla perfiles
        const { data: perfilData } = await supabaseClient
            .from('perfiles')
            .select('nombre_usuario')
            .eq('id', session.user.id)
            .single();

        let userDisplayName = session.user.email; // Por defecto mostramos el email
        if (perfilData && perfilData.nombre_usuario) {
            userDisplayName = perfilData.nombre_usuario;
        }

        // Actualizamos la barra de navegación superior (incluye notificaciones)
        const userStatusDivs = document.querySelectorAll('#user-status');
        userStatusDivs.forEach(userStatusDiv => {
            if (userStatusDiv) {
                userStatusDiv.innerHTML = `
                    <span class="text-sm text-white font-medium hidden md:inline">Hola, ${userDisplayName}</span>

                    <!-- Contenedor Notificaciones -->
                    <div id="nav-notifications-container" class="relative ml-2 mr-2">
                        <button id="nav-notifications-btn" class="text-white hover:text-red-200 transition focus:outline-none relative mt-1 cursor-pointer z-50">
                        <i class="fas fa-bell text-xl pointer-events-none"></i>
                        <span id="nav-notifications-badge" class="absolute -top-1 -right-2 bg-red-600 border border-[#c41200] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden pointer-events-none">0</span>
                        </button>

                        <!-- Dropdown -->
                        <div id="nav-notifications-dropdown" class="absolute right-0 mt-3 w-80 bg-white rounded-lg shadow-xl overflow-hidden hidden z-50 border border-gray-100 text-gray-800">
                        <div class="bg-gray-50 border-b border-gray-100 px-4 py-3 flex justify-between items-center z-50 relative pointer-events-auto">
                            <h3 class="font-bold text-sm">Notificaciones</h3>
                            <button id="mark-all-read-btn" class="text-xs text-[#c41200] hover:underline font-semibold cursor-pointer relative z-50 pointer-events-auto">Marcar leídas</button>
                        </div>
                        <ul id="nav-notifications-list" class="max-h-80 overflow-y-auto bg-white relative z-10 pointer-events-auto">
                            <li class="px-4 py-4 text-center text-gray-500 text-sm">Cargando...</li>
                        </ul>
                        </div>
                    </div>

                    <button id="logout-btn" class="text-sm bg-red-800 text-white px-3 py-1 rounded font-bold hover:bg-red-900 transition ml-2">Salir</button>
                `;

                // Inicializar Notificaciones
                configurarNotificaciones(userStatusDiv);

                // Agregamos el evento al nuevo botón de cerrar sesión
                userStatusDiv.querySelector('#logout-btn').addEventListener('click', async () => {
                    await supabaseClient.auth.signOut();
                    window.location.reload(); // Recargamos la página al salir
                });
            }
        });
    }
}

// =========================================================================
// 3. LÓGICA DE BARRA DE BÚSQUEDA MIXTA (RESTAURANTES + USUARIOS)
// =========================================================================
async function cargarDatosParaBusqueda() {
  try {
    // Cargar Restaurantes
    const { data: restaurantes, error: errorRest } = await supabaseClient
      .from('restaurantes')
      .select('id, nombre');

    if (!errorRest && restaurantes) {
      restaurantesCacheados = restaurantes.map(r => ({ ...r, tipo: 'restaurante' }));
    }

    // Cargar Perfiles (Usuarios)
    const { data: perfiles, error: errorPerf } = await supabaseClient
      .from('perfiles')
      .select('id, nombre_usuario, imagen_url');

    if (!errorPerf && perfiles) {
      perfilesCacheados = perfiles
          .filter(p => p.nombre_usuario) // Solo usuarios que hayan configurado un nombre
          .map(p => ({
              id: p.id,
              nombre: p.nombre_usuario,
              imagen_url: p.imagen_url,
              tipo: 'usuario'
          }));
    }
  } catch (err) {
    console.error("Error al cargar datos para búsqueda:", err);
  }
}

const searchInputs = document.querySelectorAll('#search-input, #nav-search-input');
const suggestionsContainers = document.querySelectorAll('#search-suggestions, #nav-search-suggestions');
const suggestionsLists = document.querySelectorAll('#suggestions-list, #nav-suggestions-list');

searchInputs.forEach((searchInput, index) => {
    const suggestionsContainer = suggestionsContainers[index];
    const suggestionsList = suggestionsLists[index];

    if (searchInput) {
      // Actualizamos el placeholder para que el usuario sepa que puede buscar ambas cosas
      searchInput.placeholder = "Busca un restaurante o un usuario...";

      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        // Si está vacío, ocultamos la lista
        if (query === '') {
          suggestionsContainer.classList.add('hidden');
          return;
        }

        // Combinar ambas listas y filtrar
        const todosLosDatos = [...restaurantesCacheados, ...perfilesCacheados];
        const coincidencias = todosLosDatos.filter(item =>
          item.nombre.toLowerCase().includes(query)
        );

        mostrarSugerencias(coincidencias, query, suggestionsList, suggestionsContainer, searchInput);
      });
    }
});

// Ocultar sugerencias si hace click afuera
document.addEventListener('click', (e) => {
    searchInputs.forEach((searchInput, index) => {
        const suggestionsContainer = suggestionsContainers[index];
        if (searchInput && suggestionsContainer) {
            if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.classList.add('hidden');
            }
        }
    });
});

function mostrarSugerencias(resultados, query, suggestionsList, suggestionsContainer, searchInput) {
  if (!suggestionsList || !suggestionsContainer) return;

  suggestionsList.innerHTML = ''; // Limpiar anteriores

  if (resultados.length === 0) {
    const li = document.createElement('li');
    li.className = 'px-4 py-3 text-gray-500 text-sm text-center';
    li.textContent = 'No se encontraron resultados';
    suggestionsList.appendChild(li);
  } else {
    // Mostrar hasta 8 resultados para no saturar
    const topResultados = resultados.slice(0, 8);

    topResultados.forEach(item => {
      const li = document.createElement('li');
      li.className = 'px-4 py-3 hover:bg-red-50 cursor-pointer border-b border-gray-100 transition last:border-b-0 text-gray-800 flex items-center justify-between';

      // Resaltar la coincidencia
      const regex = new RegExp(`(${query})`, "gi");
      const nombreResaltado = item.nombre.replace(regex, "<span class='font-bold text-[#c41200]'>$1</span>");

      // Construir el lado izquierdo (icono/foto + nombre)
      let leftContent = '';
      if (item.tipo === 'restaurante') {
          leftContent = `<div class="flex items-center"><i class="fas fa-utensils text-gray-400 mr-3 w-4 text-center"></i> ${nombreResaltado}</div>`;
      } else {
          // Si es usuario, mostrar icono de usuario o su foto en miniatura
          if (item.imagen_url) {
              leftContent = `<div class="flex items-center"><img src="${item.imagen_url}" class="w-6 h-6 rounded-full object-cover mr-3 border border-gray-200"> ${nombreResaltado}</div>`;
          } else {
              leftContent = `<div class="flex items-center"><i class="fas fa-user text-gray-400 mr-3 w-4 text-center"></i> ${nombreResaltado}</div>`;
          }
      }

      // Etiqueta indicadora a la derecha
      const rightBadge = item.tipo === 'restaurante'
          ? `<span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase tracking-wider">Lugar</span>`
          : `<span class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase tracking-wider">Usuario</span>`;

      li.innerHTML = `${leftContent} ${rightBadge}`;

      // Acción al hacer clic
      li.addEventListener('click', () => {
        searchInput.value = item.nombre;
        suggestionsContainer.classList.add('hidden');

        // Redirigir según el tipo
        if (item.tipo === 'restaurante') {
            window.location.href = `restaurante.html?id=${item.id}`;
        } else {
            window.location.href = `perfil.html?id=${item.id}`;
        }
      });

      suggestionsList.appendChild(li);
    });
  }

  suggestionsContainer.classList.remove('hidden');
}

// =========================================================================
// 4. LÓGICA DE SUGERENCIAS Y TENDENCIAS
// =========================================================================
async function cargarSugerencias() {
    const sugerenciasSection = document.getElementById('sugerencias-section');
    if (!sugerenciasSection || !currentUserId) return;

    try {
        const { data: sugerenciasIds, error } = await supabaseClient.rpc('obtener_sugerencias_personalizadas', { user_id_param: currentUserId });

        if (error || !sugerenciasIds || sugerenciasIds.length === 0) {
            return; // No hacer nada si no hay sugerencias
        }

        const ids = sugerenciasIds.map(s => s.id);
        const { data: restaurantes, error: restError } = await supabaseClient
            .from('restaurantes')
            .select('*')
            .in('id', ids);

        if (restError || !restaurantes || restaurantes.length === 0) return;

        // Mostrar la sección y renderizar el carrusel
        sugerenciasSection.classList.remove('hidden');
        const container = sugerenciasSection.querySelector('.sugerencias-container');
        container.innerHTML = ''; // Limpiar

        restaurantes.forEach(rest => {
            const card = document.createElement('div');
            card.className = "snap-start flex-shrink-0 w-72 md:w-80 bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition transform hover:-translate-y-1 relative";
            card.onclick = () => window.location.href = `restaurante.html?id=${rest.id}`;

            const imgHtml = rest.imagen_url
                ? `<img src="${rest.imagen_url}" alt="${rest.nombre}" class="w-full h-40 object-cover">`
                : `<div class="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-400"><i class="fas fa-utensils text-4xl"></i></div>`;

            card.innerHTML = `
                ${imgHtml}
                <div class="p-4">
                    <h3 class="font-bold text-lg text-gray-800 truncate" title="${rest.nombre}">${rest.nombre}</h3>
                    <p class="text-sm text-gray-500">${rest.categoria || 'Restaurante'}</p>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error("Error cargando sugerencias:", err);
    }
}

async function cargarTendencias() {
    const container = document.querySelector('.tendencias-container');
    if (!container) return;

    try {
        let tendencias = [];

        // 1. Intentar obtener el top semanal desde la función RPC de Supabase
        try {
            const { data: topIdsData, error: rpcError } = await supabaseClient.rpc('obtener_tendencias_semanales');

            if (!rpcError && topIdsData && topIdsData.length >= 6) {
                const topIds = topIdsData.map(item => item.id);
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

                const { data: restaurantesData, error: restError } = await supabaseClient
                    .from('restaurantes')
                    .select('*, resenas!inner(puntuacion_general)')
                    .in('id', topIds)
                    .gte('resenas.created_at', sevenDaysAgo);

                if (!restError && restaurantesData) {
                    tendencias = restaurantesData.map(rest => {
                        const resenas = rest.resenas || [];
                        const count = resenas.length;
                        let avg = 0;
                        if (count > 0) {
                            const sum = resenas.reduce((acc, curr) => acc + (curr.puntuacion_general || 0), 0);
                            avg = sum / count;
                        }
                        return { ...rest, rating: avg, resenasCount: count };
                    }).sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id));
                }
            } else {
                throw new Error("No hay suficientes tendencias semanales.");
            }
        } catch (e) {
            console.warn("Fallback a top histórico. Razón:", e.message || e);
            const { data: allRest, error: allRestErr } = await supabaseClient
                .from('restaurantes')
                .select('*, resenas(puntuacion_general)');

            if (allRestErr) throw allRestErr;

            if (allRest) {
                tendencias = allRest.map(rest => {
                    const resenas = rest.resenas || [];
                    const count = resenas.length;
                    let avg = 0;
                    if (count > 0) {
                        const sum = resenas.reduce((acc, curr) => acc + (curr.puntuacion_general || 0), 0);
                        avg = sum / count;
                    }
                    return { ...rest, rating: avg, resenasCount: count };
                }).filter(rest => rest.resenasCount > 0)
                  .sort((a, b) => b.rating - a.rating || b.resenasCount - a.resenasCount)
                  .slice(0, 6);
            }
        }

        // 3. Renderizar
        container.innerHTML = '';

        if (tendencias.length < 6) {
            container.innerHTML = '<p class="text-gray-500 py-4 w-full text-center col-span-full">Aún no hay suficientes reseñas para mostrar tendencias.</p>';
            return;
        }

        const [top1, top2, top3, top4, top5, top6_] = tendencias;

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- Bloque Izquierdo (Destacado #1) -->
                <div class="relative rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer hover:-translate-y-2 flex flex-col" onclick="window.location.href='restaurante.html?id=${top1.id}'">
                    <img src="${top1.imagen_url || ''}" alt="${top1.nombre}" class="w-full h-full object-cover min-h-[400px]">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                    <div class="absolute top-4 left-4 bg-[#c41200] text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-md z-10">1</div>
                    <div class="absolute bottom-0 left-0 p-6 text-white w-full">
                        <span class="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">${top1.categoria || ''}</span>
                        <h3 class="font-bold text-3xl mt-2 drop-shadow-md truncate" title="${top1.nombre}">${top1.nombre}</h3>
                        <div class="flex items-center mt-3 text-sm">
                            <i class="fas fa-star text-yellow-400"></i>
                            <span class="ml-1 font-bold text-yellow-400">${top1.rating.toFixed(1)}</span>
                            <span class="text-gray-300 ml-2">(${top1.resenasCount} reseñas)</span>
                        </div>
                    </div>
                </div>

                <!-- Bloque Derecho Superior (#2 y #3) -->
                <div class="flex flex-col gap-6">
                    <div class="relative flex flex-grow bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer hover:-translate-y-2" onclick="window.location.href='restaurante.html?id=${top2.id}'">
                        <div class="absolute top-3 left-3 bg-[#c41200] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-base shadow-md z-10">2</div>
                        <img src="${top2.imagen_url || ''}" alt="${top2.nombre}" class="w-2/5 object-cover min-h-[120px]">
                        <div class="p-4 flex flex-col justify-center w-3/5">
                            <h4 class="font-bold text-lg truncate" title="${top2.nombre}">${top2.nombre}</h4>
                            <div class="flex justify-between items-center text-sm mt-2">
                                <span class="text-gray-500 truncate mr-2">${top2.categoria || ''}</span>
                                <span class="font-bold text-yellow-500 flex items-center gap-1 shrink-0">${top2.rating.toFixed(1)} <i class="fas fa-star"></i></span>
                            </div>
                        </div>
                    </div>
                    <div class="relative flex flex-grow bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer hover:-translate-y-2" onclick="window.location.href='restaurante.html?id=${top3.id}'">
                        <div class="absolute top-3 left-3 bg-[#c41200] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-base shadow-md z-10">3</div>
                        <img src="${top3.imagen_url || ''}" alt="${top3.nombre}" class="w-2/5 object-cover min-h-[120px]">
                        <div class="p-4 flex flex-col justify-center w-3/5">
                            <h4 class="font-bold text-lg truncate" title="${top3.nombre}">${top3.nombre}</h4>
                            <div class="flex justify-between items-center text-sm mt-2">
                                <span class="text-gray-500 truncate mr-2">${top3.categoria || ''}</span>
                                <span class="font-bold text-yellow-500 flex items-center gap-1 shrink-0">${top3.rating.toFixed(1)} <i class="fas fa-star"></i></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bloque Inferior (#4, #5, #6) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="relative bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer hover:-translate-y-2" onclick="window.location.href='restaurante.html?id=${top4.id}'">
                    <div class="absolute top-3 left-3 bg-[#c41200] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-base shadow-md z-10">4</div>
                    <img src="${top4.imagen_url || ''}" alt="${top4.nombre}" class="w-full h-40 object-cover">
                    <div class="p-4">
                        <h5 class="font-bold text-md truncate">${top4.nombre}</h5>
                        <div class="flex justify-between items-center text-sm mt-1">
                            <span class="text-gray-500 truncate mr-2">${top4.categoria || ''}</span>
                            <span class="font-bold text-yellow-500 flex items-center gap-1 shrink-0">${top4.rating.toFixed(1)} <i class="fas fa-star"></i></span>
                        </div>
                    </div>
                </div>
                <div class="relative bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer hover:-translate-y-2" onclick="window.location.href='restaurante.html?id=${top5.id}'">
                    <div class="absolute top-3 left-3 bg-[#c41200] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-base shadow-md z-10">5</div>
                    <img src="${top5.imagen_url || ''}" alt="${top5.nombre}" class="w-full h-40 object-cover">
                    <div class="p-4">
                        <h5 class="font-bold text-md truncate">${top5.nombre}</h5>
                        <div class="flex justify-between items-center text-sm mt-1">
                            <span class="text-gray-500 truncate mr-2">${top5.categoria || ''}</span>
                            <span class="font-bold text-yellow-500 flex items-center gap-1 shrink-0">${top5.rating.toFixed(1)} <i class="fas fa-star"></i></span>
                        </div>
                    </div>
                </div>
                <div class="relative bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer hover:-translate-y-2" onclick="window.location.href='restaurante.html?id=${top6_.id}'">
                    <div class="absolute top-3 left-3 bg-[#c41200] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-base shadow-md z-10">6</div>
                    <img src="${top6_.imagen_url || ''}" alt="${top6_.nombre}" class="w-full h-40 object-cover">
                    <div class="p-4">
                        <h5 class="font-bold text-md truncate">${top6_.nombre}</h5>
                        <div class="flex justify-between items-center text-sm mt-1">
                            <span class="text-gray-500 truncate mr-2">${top6_.categoria || ''}</span>
                            <span class="font-bold text-yellow-500 flex items-center gap-1 shrink-0">${top6_.rating.toFixed(1)} <i class="fas fa-star"></i></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (err) {
        console.error("Error cargando tendencias:", err);
        container.innerHTML = '<p class="text-red-500 py-4 w-full text-center col-span-full">Error al cargar las tendencias.</p>';
    }
}


// =========================================================================
// 4. LÓGICA DE RESEÑAS RECIENTES (Index) Y VOTOS
// =========================================================================
async function cargarResenasRecientes() {
  const container = document.getElementById('recent-reviews-container');
  if (!container) return;

  try {
    // 1. Cargar las reseñas
    const { data: resenasData, error } = await supabaseClient
      .from('resenas')
      .select(`
        *,
        restaurantes (nombre),
        perfiles (nombre_usuario)
      `)
      .order('created_at', { ascending: false })
      .limit(9);

    if (error) throw error;

    container.innerHTML = '';

    if (!resenasData || resenasData.length === 0) {
      container.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">No hay reseñas recientes aún.</p>';
      return;
    }

    // 2. Extraer los IDs de las reseñas cargadas para buscar sus votos
    const resenasIds = resenasData.map(r => r.id);
    let votosData = [];

    if (resenasIds.length > 0) {
        const { data: votos, error: errVotos } = await supabaseClient
            .from('resenas_votos')
            .select('resena_id, usuario_id, tipo')
            .in('resena_id', resenasIds);

        if (!errVotos) {
            votosData = votos || [];
        }
    }

    resenasData.forEach(resena => {
      const restauranteNombre = resena.restaurantes ? resena.restaurantes.nombre : 'Restaurante Desconocido';
      const usuarioNombre = resena.perfiles && resena.perfiles.nombre_usuario ? resena.perfiles.nombre_usuario : 'Usuario Anónimo';
      const restauranteId = resena.id_restaurante || resena.restaurante_id;
      const usuarioId = resena.id_usuario;

      // Validación más segura de los ratings para evitar posibles problemas con toFixed()
      let ratingTotal = 'N/A';
      if (resena.puntuacion_general !== null && resena.puntuacion_general !== undefined) {
         ratingTotal = Number(resena.puntuacion_general).toFixed(1);
      }

      const comidaRating = (resena.calidad_comida !== null && resena.calidad_comida !== undefined) ? resena.calidad_comida + ' ★' : 'N/A';
      const atencionRating = (resena.atencion !== null && resena.atencion !== undefined) ? resena.atencion + ' ★' : 'N/A';
      const precioRating = (resena.precio !== null && resena.precio !== undefined) ? resena.precio + ' ★' : 'N/A';
      const ambienteRating = (resena.ambiente !== null && resena.ambiente !== undefined) ? resena.ambiente + ' ★' : 'N/A';

      // Calcular likes y dislikes para esta reseña
      const misVotos = votosData.filter(v => v.resena_id === resena.id);
      const likesCount = misVotos.filter(v => v.tipo === 'like').length;
      const dislikesCount = misVotos.filter(v => v.tipo === 'dislike').length;

      // Determinar si el usuario actual ya votó esta reseña
      let userVoto = null;
      if (currentUserId) {
          const votoUsuario = misVotos.find(v => v.usuario_id === currentUserId);
          if (votoUsuario) {
              userVoto = votoUsuario.tipo; // 'like' o 'dislike'
          }
      }

      const likeClass = userVoto === 'like' ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50';
      const dislikeClass = userVoto === 'dislike' ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50';

      const resenaDiv = document.createElement('div');
      resenaDiv.className = "bg-white p-6 rounded-lg shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col h-full relative z-10";

      resenaDiv.innerHTML = `
        <div class="flex justify-between items-start mb-4">
          <div>
            <a href="restaurante.html?id=${restauranteId}" class="font-bold text-lg text-gray-800 hover:text-[#c41200] hover:underline transition">${restauranteNombre}</a>
            <p class="text-sm text-gray-500 mt-1">Por <a href="perfil.html?id=${usuarioId}" class="font-semibold text-gray-600 hover:text-[#c41200] hover:underline transition">${usuarioNombre}</a></p>
          </div>
          <div class="flex items-center gap-3">
            <span class="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">${ratingTotal} ★</span>
            <button onclick="leerResena('${resena.comentario.replace(/'/g, "\\'")}')" class="text-gray-400 hover:text-[#c41200] transition" title="Leer reseña en voz alta">
                <i class="fas fa-volume-up"></i>
            </button>
          </div>
        </div>
        <p class="text-gray-700 mb-4 line-clamp-3 flex-grow">${resena.comentario || 'Sin comentario'}</p>
        <div class="text-xs text-gray-500 flex items-center justify-between mt-auto pt-4 border-t border-gray-100 mb-3">
           <span class="flex items-center gap-1" title="Calidad de la Comida"><i class="fas fa-utensils w-4 text-center text-gray-400"></i> ${comidaRating}</span>
           <span class="flex items-center gap-1" title="Atención"><i class="fas fa-concierge-bell w-4 text-center text-gray-400"></i> ${atencionRating}</span>
           <span class="flex items-center gap-1" title="Precio"><i class="fas fa-money-bill-wave w-4 text-center text-gray-400"></i> ${precioRating}</span>
           <span class="flex items-center gap-1" title="Ambiente"><i class="fas fa-music w-4 text-center text-gray-400"></i> ${ambienteRating}</span>
        </div>

        <!-- Botones de Voto -->
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-50">
            <button class="btn-like flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${likeClass} relative z-20" data-resena-id="${resena.id}" data-autor-id="${resena.id_usuario}">
                <i class="fas fa-thumbs-up pointer-events-none"></i> <span class="like-count pointer-events-none">${likesCount}</span>
            </button>
            <button class="btn-dislike flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${dislikeClass} relative z-20" data-resena-id="${resena.id}">
                <i class="fas fa-thumbs-down pointer-events-none"></i> <span class="dislike-count pointer-events-none">${dislikesCount}</span>
            </button>
        </div>
      `;
      container.appendChild(resenaDiv);
    });

    // Configurar eventos de los botones de voto recién creados
    configurarVotos();

  } catch (err) {
    console.error("Error al cargar reseñas recientes:", err);
    // Mostrar el error completo en pantalla para depuración
    container.innerHTML = `<p class="text-red-500 col-span-full text-center py-8">
      <strong>Error al cargar las reseñas:</strong><br/>
      ${err.message || JSON.stringify(err)}
      <br/><em>(Abre la consola para más detalles)</em>
    </p>`;
  }
}

// Lógica universal de votos para el archivo app.js
function configurarVotos() {
    const btnLikes = document.querySelectorAll('.btn-like');
    const btnDislikes = document.querySelectorAll('.btn-dislike');

    const procesarVoto = async (resenaId, tipoVotoDeseado, botonClickado) => {
        if (!currentUserId) {
            alert("Debes iniciar sesión para votar.");
            window.location.href = 'login.html';
            return;
        }

        const contenedorResena = botonClickado.closest('div.flex.justify-end, .flex.items-center.gap-2');
        if (!contenedorResena) return;

        const btnLike = contenedorResena.querySelector('.btn-like');
        const btnDislike = contenedorResena.querySelector('.btn-dislike');

        if (!btnLike || !btnDislike) return;

        const autorId = btnLike.dataset.autorId; // Para la notificacion

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

                    // Borrar notificacion
                    if(autorId && autorId !== currentUserId) {
                       await supabaseClient.from('notificaciones').delete().match({ tipo: 'like', actor_id: currentUserId, resena_id: resenaId });
                    }

                    // UI Update
                    btnLike.classList.remove('text-green-600', 'bg-green-50');
                    btnLike.classList.add('text-gray-400');
                    spanLikeCount.textContent = currentLikeCount - 1;
                } else {
                    // Poner like (Upsert para sobreescribir dislike si existe)
                    await supabaseClient.from('resenas_votos').upsert({ resena_id: resenaId, usuario_id: currentUserId, tipo: 'like' });

                    // Crear notificacion si no es mia
                    if (autorId && autorId !== currentUserId) {
                        await supabaseClient.from('notificaciones').insert({
                            usuario_id: autorId,
                            actor_id: currentUserId,
                            tipo: 'like',
                            resena_id: resenaId
                        });
                    }

                    // UI Update
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
                    // UI Update
                    btnDislike.classList.remove('text-red-600', 'bg-red-50');
                    btnDislike.classList.add('text-gray-400');
                    spanDislikeCount.textContent = currentDislikeCount - 1;
                } else {
                    // Poner dislike (Upsert)
                    await supabaseClient.from('resenas_votos').upsert({ resena_id: resenaId, usuario_id: currentUserId, tipo: 'dislike' });

                    // Si paso de Like a Dislike, borramos la notificacion de Like
                    if (isCurrentlyLiked && autorId && autorId !== currentUserId) {
                       await supabaseClient.from('notificaciones').delete().match({ tipo: 'like', actor_id: currentUserId, resena_id: resenaId });
                    }

                    // UI Update
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
            e.stopPropagation(); // Evitar click en la tarjeta que lleva al restaurante
            procesarVoto(btn.dataset.resenaId, 'like', btn);
        });
    });

    btnDislikes.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Evitar click en la tarjeta
            procesarVoto(btn.dataset.resenaId, 'dislike', btn);
        });
    });
}

// =========================================================================
// 5. SISTEMA DE NOTIFICACIONES (Universal para NavBar)
// =========================================================================

async function configurarNotificaciones(navContext = document) {
    const notifBtn = navContext.querySelector('#nav-notifications-btn');
    const notifDropdown = navContext.querySelector('#nav-notifications-dropdown');
    const notifBadge = navContext.querySelector('#nav-notifications-badge');
    const notifList = navContext.querySelector('#nav-notifications-list');
    const markAllReadBtn = navContext.querySelector('#mark-all-read-btn');

    if (!notifBtn || !currentUserId) return;

    // 1. Cargar notificaciones al iniciar
    await cargarYRenderizarNotificaciones();

    // 2. Toggle del dropdown
    notifBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        notifDropdown.classList.toggle('hidden');
    });

    // Cerrar si hace click afuera
    document.addEventListener('click', (e) => {
        if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
            notifDropdown.classList.add('hidden');
        }
    });

    // 3. Marcar todas como leídas
    if(markAllReadBtn) {
        // Remover listeners anteriores (útil si se llama multiples veces)
        const newMarkBtn = markAllReadBtn.cloneNode(true);
        markAllReadBtn.parentNode.replaceChild(newMarkBtn, markAllReadBtn);

        newMarkBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                await supabaseClient
                    .from('notificaciones')
                    .update({ leida: true })
                    .eq('usuario_id', currentUserId)
                    .eq('leida', false);

                await cargarYRenderizarNotificaciones();
                // Opcional: notifDropdown.classList.add('hidden');
            } catch(err) {
                console.error("Error marcando notificaciones leídas:", err);
            }
        });
    }

    async function cargarYRenderizarNotificaciones() {
        try {
            // Hacemos el fetch en dos pasos para evitar conflictos con los joins complejos
            const { data: notificaciones, error } = await supabaseClient
                .from('notificaciones')
                .select('*')
                .eq('usuario_id', currentUserId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            notifList.innerHTML = '';

            const unreadCount = notificaciones.filter(n => !n.leida).length;

            if (unreadCount > 0) {
                notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                notifBadge.classList.remove('hidden');
            } else {
                notifBadge.classList.add('hidden');
            }

            if (notificaciones.length === 0) {
                notifList.innerHTML = '<li class="px-4 py-4 text-center text-gray-500 text-sm">No tienes notificaciones</li>';
                return;
            }

            // Cargar datos extra (actores y reseñas)
            const actorIds = [...new Set(notificaciones.map(n => n.actor_id))];
            const resenasIds = [...new Set(notificaciones.filter(n => n.resena_id).map(n => n.resena_id))];

            let actoresMap = {};
            let resenasMap = {};

            if (actorIds.length > 0) {
                const { data: actores } = await supabaseClient.from('perfiles').select('id, nombre_usuario, imagen_url').in('id', actorIds);
                if (actores) actores.forEach(a => actoresMap[a.id] = a);
            }

            if (resenasIds.length > 0) {
                const { data: resenasData } = await supabaseClient
                    .from('resenas')
                    .select('id, id_restaurante, restaurantes(nombre)')
                    .in('id', resenasIds);

                if (resenasData) resenasData.forEach(r => resenasMap[r.id] = r);
            }

            notificaciones.forEach(notif => {
                const li = document.createElement('li');
                const isUnreadClass = notif.leida ? 'bg-white' : 'bg-red-50';
                li.className = `p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition ${isUnreadClass} pointer-events-auto`;

                const actor = actoresMap[notif.actor_id];
                const actorNombre = actor && actor.nombre_usuario ? actor.nombre_usuario : 'Alguien';
                const actorImg = actor && actor.imagen_url ? actor.imagen_url : null;

                let iconHtml = actorImg
                    ? `<img src="${actorImg}" class="w-8 h-8 rounded-full object-cover">`
                    : `<div class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center"><i class="fas fa-user text-xs"></i></div>`;

                let mensaje = '';
                let urlDestino = '#';

                if (notif.tipo === 'like') {
                    const resenaInfo = resenasMap[notif.resena_id];
                    const restNombre = resenaInfo && resenaInfo.restaurantes ? resenaInfo.restaurantes.nombre : 'un restaurante';
                    const restId = resenaInfo ? resenaInfo.id_restaurante : null;

                    mensaje = `<strong>${actorNombre}</strong> le dio me gusta a tu reseña en <strong>${restNombre}</strong>.`;

                    if(restId) {
                       urlDestino = `restaurante.html?id=${restId}`;
                    }
                } else if (notif.tipo === 'follow') {
                    mensaje = `<strong>${actorNombre}</strong> ha empezado a seguirte.`;
                    urlDestino = `perfil.html?id=${notif.actor_id}`;
                }

                // Parsear fecha
                const fecha = new Date(notif.created_at);
                const hoy = new Date();
                let displayDate = '';
                if (fecha.toDateString() === hoy.toDateString()) {
                    displayDate = 'Hoy, ' + fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                } else {
                    displayDate = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                }

                li.innerHTML = `
                    <div class="flex items-start gap-3">
                        <div class="mt-1">${iconHtml}</div>
                        <div class="flex-1">
                            <p class="text-sm text-gray-800 leading-snug">${mensaje}</p>
                            <span class="text-[10px] text-gray-400 mt-1 block">${displayDate}</span>
                        </div>
                        ${!notif.leida ? '<div class="w-2 h-2 bg-[#c41200] rounded-full mt-2"></div>' : ''}
                    </div>
                `;

                li.addEventListener('click', async (e) => {
                    e.preventDefault();
                    // Marcar como leída al tocar
                    if (!notif.leida) {
                        await supabaseClient.from('notificaciones').update({ leida: true }).eq('id', notif.id);
                    }
                    if (urlDestino !== '#') {
                        window.location.href = urlDestino;
                    }
                });

                notifList.appendChild(li);
            });

        } catch (err) {
            console.error("Error obteniendo notificaciones:", err);
            notifList.innerHTML = '<li class="px-4 py-4 text-center text-red-500 text-sm">Error al cargar</li>';
        }
    }
}
