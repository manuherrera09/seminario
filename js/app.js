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

    // Actualizamos la barra de navegación superior
    const userStatusDiv = document.getElementById('user-status');
    if (userStatusDiv) {
      userStatusDiv.innerHTML = `
              <span class="text-sm text-white font-medium">Hola, ${userDisplayName}</span>
              <button id="logout-btn" class="text-sm bg-red-800 text-white px-3 py-1 rounded font-bold hover:bg-red-900 transition ml-2">Cerrar sesión</button>
          `;

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
            <button class="btn-like flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${likeClass}" data-resena-id="${resena.id}">
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
                    // UI Update
                    btnLike.classList.remove('text-green-600', 'bg-green-50');
                    btnLike.classList.add('text-gray-400');
                    spanLikeCount.textContent = currentLikeCount - 1;
                } else {
                    // Poner like (Upsert)
                    await supabaseClient.from('resenas_votos').upsert({ resena_id: resenaId, usuario_id: currentUserId, tipo: 'like' });
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
