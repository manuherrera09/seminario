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

// =========================================================================
// 2. LÓGICA DEL CARRUSEL DE FONDO Y AUTENTICACIÓN
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // ---- Carrusel ----
  const slides = document.querySelectorAll('.bg-slide');
  let currentSlide = 0;

  const nextSlide = () => {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
  };
  if (slides.length > 0) {
    setInterval(nextSlide, 5000);
  }

  // ---- Autenticación ----
  // Verificamos si hay una sesión activa
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (session && session.user) {
    currentUserId = session.user.id;
    // El usuario está logueado
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
    const userStatusDiv = document.getElementById('user-status');
    if (userStatusDiv) {
      userStatusDiv.innerHTML = `
              <span class="text-sm text-white font-medium">Hola, ${userDisplayName}</span>

              <!-- Contenedor Notificaciones -->
              <div id="nav-notifications-container" class="relative ml-2 mr-2">
                <button id="nav-notifications-btn" class="text-white hover:text-red-200 transition focus:outline-none relative mt-1">
                  <i class="fas fa-bell text-xl"></i>
                  <span id="nav-notifications-badge" class="absolute -top-1 -right-2 bg-red-600 border border-[#c41200] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden">0</span>
                </button>

                <!-- Dropdown -->
                <div id="nav-notifications-dropdown" class="absolute right-0 mt-3 w-80 bg-white rounded-lg shadow-2xl overflow-hidden hidden z-50 border border-gray-100 text-gray-800">
                  <div class="bg-gray-50 border-b border-gray-100 px-4 py-2 flex justify-between items-center">
                    <h3 class="font-bold text-sm">Notificaciones</h3>
                    <button id="mark-all-read-btn" class="text-xs text-[#c41200] hover:underline">Marcar leídas</button>
                  </div>
                  <ul id="nav-notifications-list" class="max-h-80 overflow-y-auto bg-white">
                    <li class="px-4 py-4 text-center text-gray-500 text-sm">Cargando...</li>
                  </ul>
                </div>
              </div>

              <button id="logout-btn" class="text-sm bg-red-800 text-white px-3 py-1 rounded font-bold hover:bg-red-900 transition">Salir</button>
          `;

      // Inicializar Notificaciones
      configurarNotificaciones();

      // Agregamos el evento al nuevo botón de cerrar sesión
      document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload(); // Recargamos la página al salir
      });
    }
  }

  // ---- Cargar lista de restaurantes y usuarios para la búsqueda ----
  cargarDatosParaBusqueda();

  // ---- Cargar reseñas recientes si estamos en el index ----
  if (document.getElementById('recent-reviews-container')) {
    cargarResenasRecientes();
  }
});

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

const searchInput = document.getElementById('search-input');
const suggestionsContainer = document.getElementById('search-suggestions');
const suggestionsList = document.getElementById('suggestions-list');

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

    mostrarSugerencias(coincidencias, query);
  });
}

// Ocultar sugerencias si hace click afuera
document.addEventListener('click', (e) => {
  if (searchInput && suggestionsContainer) {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.classList.add('hidden');
    }
  }
});

function mostrarSugerencias(resultados, query) {
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
      resenaDiv.className = "bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition flex flex-col h-full relative";

      resenaDiv.innerHTML = `
        <div class="flex justify-between items-start mb-4 cursor-pointer" onclick="window.location.href='restaurante.html?id=${resena.id_restaurante || resena.restaurante_id}'">
          <div>
            <h3 class="font-bold text-lg text-gray-800">${restauranteNombre}</h3>
            <p class="text-sm text-gray-500">Por ${usuarioNombre}</p>
          </div>
          <span class="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">${ratingTotal} ★</span>
        </div>
        <p class="text-gray-700 mb-4 line-clamp-3 flex-grow cursor-pointer" onclick="window.location.href='restaurante.html?id=${resena.id_restaurante || resena.restaurante_id}'">${resena.comentario || 'Sin comentario'}</p>
        <div class="text-sm text-gray-500 grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-gray-100 mb-3 cursor-pointer" onclick="window.location.href='restaurante.html?id=${resena.id_restaurante || resena.restaurante_id}'">
           <span>Comida: ${comidaRating}</span>
           <span>Atención: ${atencionRating}</span>
           <span>Precio: ${precioRating}</span>
           <span>Ambiente: ${ambienteRating}</span>
        </div>

        <!-- Botones de Voto -->
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-50">
            <button class="btn-like flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${likeClass}" data-resena-id="${resena.id}" data-autor-id="${resena.id_usuario}">
                <i class="fas fa-thumbs-up"></i> <span class="like-count">${likesCount}</span>
            </button>
            <button class="btn-dislike flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${dislikeClass}" data-resena-id="${resena.id}">
                <i class="fas fa-thumbs-down"></i> <span class="dislike-count">${dislikesCount}</span>
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

        const contenedorResena = botonClickado.closest('div.flex.justify-end');
        const btnLike = contenedorResena.querySelector('.btn-like');
        const btnDislike = contenedorResena.querySelector('.btn-dislike');

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
                    // Poner like (Upsert)
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
            e.stopPropagation(); // Evitar click en la tarjeta que lleva al restaurante
            procesarVoto(btn.dataset.resenaId, 'like', btn);
        });
    });

    btnDislikes.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar click en la tarjeta
            procesarVoto(btn.dataset.resenaId, 'dislike', btn);
        });
    });
}

// =========================================================================
// 5. SISTEMA DE NOTIFICACIONES (Universal para NavBar)
// =========================================================================

async function configurarNotificaciones() {
    const notifBtn = document.getElementById('nav-notifications-btn');
    const notifDropdown = document.getElementById('nav-notifications-dropdown');
    const notifBadge = document.getElementById('nav-notifications-badge');
    const notifList = document.getElementById('nav-notifications-list');
    const markAllReadBtn = document.getElementById('mark-all-read-btn');

    if (!notifBtn || !currentUserId) return;

    // 1. Cargar notificaciones al iniciar
    await cargarYRenderizarNotificaciones();

    // 2. Toggle del dropdown
    notifBtn.addEventListener('click', (e) => {
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
    markAllReadBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await supabaseClient
                .from('notificaciones')
                .update({ leida: true })
                .eq('usuario_id', currentUserId)
                .eq('leida', false);

            await cargarYRenderizarNotificaciones();
            notifDropdown.classList.add('hidden');
        } catch(err) {
            console.error("Error marcando notificaciones leídas:", err);
        }
    });

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
                li.className = `p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition ${isUnreadClass}`;

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

                li.addEventListener('click', async () => {
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
