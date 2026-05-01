// =========================================================================
// 1. CONFIGURACIÓN SUPABASE
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';

// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentSessionUserId = null; // Quien está logueado
let profileUserId = null;        // De quien es el perfil que estamos viendo
let currentBio = "";
let currentImageUrl = "";
let restaurantesList = [];
let currentFavoritos = [];
let isOwnProfile = true;

// Variables para búsqueda mixta
let navRestaurantesCacheados = [];
let navPerfilesCacheados = [];

// =========================================================================
// 2. LÓGICA DE PERFIL Y AUTENTICACIÓN
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {

  // Verificamos si hay una sesión activa
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (session && session.user) {
    currentSessionUserId = session.user.id;
  }

  // Verificamos de quién es el perfil que queremos ver a través de la URL (ej: perfil.html?id=xxx)
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id');

  if (targetId) {
      profileUserId = targetId;
      isOwnProfile = (currentSessionUserId === profileUserId);
  } else {
      // Si no hay ID en la URL, asumimos que quiere ver su propio perfil
      if (!currentSessionUserId) {
          // Si no está logueado y no busca un perfil, lo mandamos al login
          window.location.href = 'login.html';
          return;
      }
      profileUserId = currentSessionUserId;
      isOwnProfile = true;
  }

  // Cargar lista de todos los restaurantes para los selects
  await cargarListaRestaurantes();

  // Buscamos información del perfil que estamos visualizando
  const { data: perfilData, error: perfilError } = await supabaseClient
    .from('perfiles')
    .select('nombre_usuario, biografia, imagen_url, restaurantes_favoritos')
    .eq('id', profileUserId)
    .single();

  let userDisplayName = session && session.user ? session.user.email : '';
  let profileNameDisplay = "Usuario de TrackEat";

  // Actualizar el nav con la info del usuario logueado
  const userStatusDiv = document.getElementById('user-status');
  if (currentSessionUserId) {
      const { data: miPerfilData } = await supabaseClient
        .from('perfiles')
        .select('nombre_usuario')
        .eq('id', currentSessionUserId)
        .single();

      if (miPerfilData && miPerfilData.nombre_usuario) {
          userDisplayName = miPerfilData.nombre_usuario;
      }

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

            <button id="logout-btn" class="text-sm bg-red-800 text-white px-3 py-1 rounded font-bold hover:bg-red-900 transition ml-2">Cerrar sesión</button>
        `;

      configurarNotificaciones();

      document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
      });
  } else {
       // Si no está logueado, los botones de iniciar sesión / registrarse ya están en el HTML
       userStatusDiv.classList.remove('hidden');
  }

  // Llenar la info visual del perfil
  if (perfilData) {
    if (perfilData.nombre_usuario) {
      profileNameDisplay = perfilData.nombre_usuario;
    }

    if (perfilData.biografia && perfilData.biografia.trim() !== '') {
      currentBio = perfilData.biografia;
      mostrarBiografia(currentBio);
    }

    if (perfilData.imagen_url && perfilData.imagen_url.trim() !== '') {
      currentImageUrl = perfilData.imagen_url;
      mostrarImagenPerfil(currentImageUrl);
    }

    if (perfilData.restaurantes_favoritos) {
      currentFavoritos = Array.isArray(perfilData.restaurantes_favoritos) ? perfilData.restaurantes_favoritos : [];
    }
  } else {
      // Si llegamos acá es porque buscaron un perfil que no existe
      document.getElementById('profile-name').textContent = "Perfil no encontrado";
      document.getElementById('profile-email').textContent = "";
      return;
  }

  document.getElementById('profile-name').textContent = profileNameDisplay;

  // Ocultamos el email si no es nuestro perfil por privacidad
  if (isOwnProfile && session) {
      document.getElementById('profile-email').innerHTML = `<i class="fas fa-envelope mr-2"></i>${session.user.email}`;
  } else {
      document.getElementById('profile-email').innerHTML = ''; // Limpiamos el texto '...'
  }

  // Ocultar botones de edición si no es tu perfil
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const editFavsBtn = document.getElementById('edit-favs-btn');

  if (isOwnProfile) {
      editProfileBtn.classList.remove('hidden');
      configurarEdicionPerfil();
      configurarEdicionFavoritos();
  } else if (currentSessionUserId) {
      // Si NO es nuestro perfil y estamos logueados, mostramos el botón seguir
      const followBtn = document.getElementById('follow-btn');
      if(followBtn) followBtn.classList.remove('hidden');
      // La configuración del botón seguir se llama DESPUÉS de cargar seguidores
  }

  // Cargar seguidores y seguidos (esto actualizará el DOM de contadores e isFollowingUser)
  await cargarSeguidores();

  // AHORA sí configuramos el botón para que use isFollowingUser correcto
  if (!isOwnProfile && currentSessionUserId) {
      configurarBotonSeguir();
  }

  configurarModalesFollows();
  cargarHistorialResenas();
  renderizarFavoritos();

  // Cargar datos mixtos para la barra de navegación y configurarla
  await cargarDatosParaBusquedaNav();
  configurarBarraDeBusquedaMixtaNav();
});

// =========================================================================
// 3. FUNCIONES DE UI
// =========================================================================

function mostrarBiografia(texto) {
  const bioContainer = document.getElementById('bio-container');
  const bioText = document.getElementById('profile-bio');

  if (texto && texto.trim() !== '') {
    bioText.innerHTML = `"${texto.replace(/\\n/g, '<br>')}"`;
    bioContainer.classList.remove('hidden');
  } else {
    bioContainer.classList.add('hidden');
  }
}

function mostrarImagenPerfil(url) {
  const icon = document.getElementById('profile-icon');
  const img = document.getElementById('profile-image');

  if (url && url.trim() !== '') {
    img.src = url;
    img.classList.remove('hidden');
    icon.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    icon.classList.remove('hidden');
  }
}

function configurarEdicionPerfil() {
  const btnEditProfile = document.getElementById('edit-profile-btn');
  const bioContainer = document.getElementById('bio-container');
  const bioEditContainer = document.getElementById('bio-edit-container');

  const inputImageUrl = document.getElementById('image-url-input');
  const textareaBio = document.getElementById('bio-edit-textarea');

  const btnSave = document.getElementById('save-bio-btn');
  const btnCancel = document.getElementById('cancel-bio-btn');

  btnEditProfile.addEventListener('click', () => {
    bioContainer.classList.add('hidden');
    bioEditContainer.classList.remove('hidden');
    textareaBio.value = currentBio;
    inputImageUrl.value = currentImageUrl;
    inputImageUrl.focus();
  });

  btnCancel.addEventListener('click', () => {
    bioEditContainer.classList.add('hidden');
    mostrarBiografia(currentBio);
  });

  btnSave.addEventListener('click', async () => {
    const nuevaBio = textareaBio.value.trim();
    const nuevaImgUrl = inputImageUrl.value.trim();

    btnSave.disabled = true;
    btnSave.textContent = '...';

    try {
      const { error } = await supabaseClient
        .from('perfiles')
        .update({
          biografia: nuevaBio,
          imagen_url: nuevaImgUrl
        })
        .eq('id', profileUserId);

      if (error) throw error;

      currentBio = nuevaBio;
      currentImageUrl = nuevaImgUrl;

      bioEditContainer.classList.add('hidden');
      mostrarBiografia(currentBio);
      mostrarImagenPerfil(currentImageUrl);

    } catch (err) {
      console.error('Error al actualizar el perfil:', err);
      alert("Ocurrió un error al guardar tu perfil. Por favor intenta de nuevo.");
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Guardar';
    }
  });
}

// =========================================================================
// 4. LÓGICA DE INSIGNIAS Y CARGA DE RESEÑAS
// =========================================================================

function calcularInsignia(cantidadResenas) {
  let nombre = "Nuevo Crítico";
  let colorClass = "bg-green-100 text-green-800 border-green-200"; // Verde (Nivel 1)
  let icono = "fa-seedling";

  if (cantidadResenas >= 6 && cantidadResenas <= 15) {
    nombre = "Explorador Gastronómico";
    colorClass = "bg-blue-100 text-blue-800 border-blue-200"; // Azul (Nivel 2)
    icono = "fa-compass";
  } else if (cantidadResenas >= 16 && cantidadResenas <= 35) {
    nombre = "Crítico Intermedio";
    colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200"; // Amarillo (Nivel 3)
    icono = "fa-star";
  } else if (cantidadResenas >= 36 && cantidadResenas <= 75) {
    nombre = "Crítico Experimentado";
    colorClass = "bg-orange-100 text-orange-800 border-orange-200"; // Naranja (Nivel 4)
    icono = "fa-fire";
  } else if (cantidadResenas >= 76 && cantidadResenas < 150) {
    nombre = "Experto Gastronómico";
    colorClass = "bg-red-100 text-red-800 border-red-200"; // Rojo (Nivel 5)
    icono = "fa-award";
  } else if (cantidadResenas >= 150) {
    nombre = "Referente TrackEat";
    colorClass = "bg-purple-100 text-purple-800 border-purple-200"; // Morado (Nivel 6)
    icono = "fa-crown";
  }

  return { nombre, colorClass, icono };
}

async function cargarHistorialResenas() {
  const container = document.getElementById('mis-resenas');
  const vacioMsg = document.getElementById('mis-resenas-vacio');
  const statsResenas = document.getElementById('stats-resenas');

  try {
    const { data: resenas, error } = await supabaseClient
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
                  id_restaurante
              `)
      .eq('id_usuario', profileUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalResenas = resenas ? resenas.length : 0;

    statsResenas.textContent = totalResenas;

    const badgeContainer = document.getElementById('user-badge-container');
    const badgeSpan = document.getElementById('user-badge');
    const insignia = calcularInsignia(totalResenas);

    badgeSpan.className = `text-xs px-3 py-1 rounded-full font-semibold border shadow-sm ${insignia.colorClass}`;
    badgeSpan.innerHTML = `<i class="fas ${insignia.icono} mr-1"></i> ${insignia.nombre}`;
    badgeContainer.classList.remove('hidden');

    if (totalResenas > 0) {
      if (vacioMsg) vacioMsg.remove();
      container.innerHTML = '';

      // Cargar votos
      const resenasIds = resenas.map(r => r.id);
      let votosData = [];
      if (resenasIds.length > 0) {
          const { data: votos } = await supabaseClient
              .from('resenas_votos')
              .select('resena_id, usuario_id, tipo')
              .in('resena_id', resenasIds);
          votosData = votos || [];
      }

      for (const resena of resenas) {
        const fechaObj = new Date(resena.created_at);
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
          day: 'numeric', month: 'long', year: 'numeric'
        });

        let nombreRestaurante = 'Restaurante Desconocido';
        if (resena.id_restaurante) {
          const { data: restData, error: restError } = await supabaseClient
            .from('restaurantes')
            .select('nombre')
            .eq('id', resena.id_restaurante)
            .single();
          if (restData) {
            nombreRestaurante = restData.nombre;
          }
        }

        const misVotos = votosData.filter(v => v.resena_id === resena.id);
        const likesCount = misVotos.filter(v => v.tipo === 'like').length;
        const dislikesCount = misVotos.filter(v => v.tipo === 'dislike').length;

        let userVoto = null;
        if (currentSessionUserId) {
            userVoto = misVotos.find(v => v.usuario_id === currentSessionUserId)?.tipo;
        }

        const likeClass = userVoto === 'like' ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50';
        const dislikeClass = userVoto === 'dislike' ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50';

        const divResena = document.createElement('div');
        divResena.className = "border border-gray-100 rounded-lg p-4 hover:shadow-md transition mb-4 bg-white";

        const ratingGeneral = (resena.puntuacion_general !== null && resena.puntuacion_general !== undefined)
                                ? Number(resena.puntuacion_general).toFixed(1)
                                : 'N/A';

        divResena.innerHTML = `
                    <div class="flex justify-between items-start mb-2 cursor-pointer" onclick="window.location.href='restaurante.html?id=${resena.id_restaurante}'">
                      <div>
                        <h3 class="font-bold text-lg text-[#c41200] hover:underline">${nombreRestaurante}</h3>
                        <p class="text-xs text-gray-400">Escrita el ${fechaFormateada}</p>
                      </div>
                    </div>

                    <div class="mb-3 flex items-center gap-2 cursor-pointer" onclick="window.location.href='restaurante.html?id=${resena.id_restaurante}'">
                      <span class="bg-yellow-100 text-yellow-800 text-sm font-semibold px-2.5 py-0.5 rounded">General: ${ratingGeneral} ★</span>
                    </div>

                    <div class="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 mb-3 bg-gray-50 p-2 rounded cursor-pointer" onclick="window.location.href='restaurante.html?id=${resena.id_restaurante}'">
                       <span><strong>Comida:</strong> ${resena.calidad_comida} ★</span>
                       <span><strong>Atención:</strong> ${resena.atencion} ★</span>
                       <span><strong>Precio:</strong> ${resena.precio} ★</span>
                       ${resena.ambiente ? `<span><strong>Ambiente:</strong> ${resena.ambiente} ★</span>` : ''}
                    </div>

                    <p class="text-gray-700 text-sm mb-3 cursor-pointer" onclick="window.location.href='restaurante.html?id=${resena.id_restaurante}'">${resena.comentario}</p>

                    <div class="flex justify-end gap-2 pt-2 border-t border-gray-50 mt-auto">
                        <button class="btn-like flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${likeClass}" data-resena-id="${resena.id}" data-autor-id="${profileUserId}">
                            <i class="fas fa-thumbs-up"></i> <span class="like-count">${likesCount}</span>
                        </button>
                        <button class="btn-dislike flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${dislikeClass}" data-resena-id="${resena.id}">
                            <i class="fas fa-thumbs-down"></i> <span class="dislike-count">${dislikesCount}</span>
                        </button>
                    </div>
                  `;

        container.appendChild(divResena);
      }

      configurarVotosEnPerfil();

    } else {
        if (vacioMsg) {
            vacioMsg.textContent = isOwnProfile ? "Aún no has publicado reseñas." : "Este usuario aún no ha publicado reseñas.";
        }
    }
  } catch (err) {
    console.error("Error al cargar historial de reseñas:", err);
    if (vacioMsg) vacioMsg.textContent = "Hubo un error al cargar las reseñas.";
  }
}

function configurarVotosEnPerfil() {
    const btnLikes = document.querySelectorAll('.btn-like');
    const btnDislikes = document.querySelectorAll('.btn-dislike');

    const procesarVoto = async (resenaId, tipoVotoDeseado, botonClickado) => {
        if (!currentSessionUserId) {
            alert("Debes iniciar sesión para votar.");
            window.location.href = 'login.html';
            return;
        }

        const contenedorResena = botonClickado.closest('.flex.justify-end');
        const btnLike = contenedorResena.querySelector('.btn-like');
        const btnDislike = contenedorResena.querySelector('.btn-dislike');

        const autorId = btnLike.dataset.autorId; // Para la notificacion

        const spanLikeCount = btnLike.querySelector('.like-count');
        const spanDislikeCount = btnDislike.querySelector('.dislike-count');

        let isCurrentlyLiked = btnLike.classList.contains('text-green-600');
        let isCurrentlyDisliked = btnDislike.classList.contains('text-red-600');

        let currentLikeCount = parseInt(spanLikeCount.textContent);
        let currentDislikeCount = parseInt(spanDislikeCount.textContent);

        btnLike.disabled = true;
        btnDislike.disabled = true;

        try {
            if (tipoVotoDeseado === 'like') {
                if (isCurrentlyLiked) {
                    await supabaseClient.from('resenas_votos').delete().match({ resena_id: resenaId, usuario_id: currentSessionUserId });

                    if(autorId && autorId !== currentSessionUserId) {
                       await supabaseClient.from('notificaciones').delete().match({ tipo: 'like', actor_id: currentSessionUserId, resena_id: resenaId });
                    }

                    btnLike.classList.remove('text-green-600', 'bg-green-50');
                    btnLike.classList.add('text-gray-400');
                    spanLikeCount.textContent = currentLikeCount - 1;
                } else {
                    await supabaseClient.from('resenas_votos').upsert({ resena_id: resenaId, usuario_id: currentSessionUserId, tipo: 'like' });

                    if (autorId && autorId !== currentSessionUserId) {
                        await supabaseClient.from('notificaciones').insert({
                            usuario_id: autorId,
                            actor_id: currentSessionUserId,
                            tipo: 'like',
                            resena_id: resenaId
                        });
                    }

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
                    await supabaseClient.from('resenas_votos').delete().match({ resena_id: resenaId, usuario_id: currentSessionUserId });
                    btnDislike.classList.remove('text-red-600', 'bg-red-50');
                    btnDislike.classList.add('text-gray-400');
                    spanDislikeCount.textContent = currentDislikeCount - 1;
                } else {
                    await supabaseClient.from('resenas_votos').upsert({ resena_id: resenaId, usuario_id: currentSessionUserId, tipo: 'dislike' });

                    if (isCurrentlyLiked && autorId && autorId !== currentSessionUserId) {
                       await supabaseClient.from('notificaciones').delete().match({ tipo: 'like', actor_id: currentSessionUserId, resena_id: resenaId });
                    }

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
            e.stopPropagation();
            procesarVoto(btn.dataset.resenaId, 'like', btn);
        });
    });

    btnDislikes.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            procesarVoto(btn.dataset.resenaId, 'dislike', btn);
        });
    });
}

// =========================================================================
// 5. LÓGICA DE FAVORITOS MANUALES
// =========================================================================

async function cargarListaRestaurantes() {
  try {
    const { data, error } = await supabaseClient
      .from('restaurantes')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    if (error) throw error;
    if (data) restaurantesList = data;
  } catch (err) {
    console.error("Error al cargar lista de restaurantes:", err);
  }
}

function getNombreRestaurante(id) {
  // Parsear a numero o string dependiendo de como esté guardado
  const rest = restaurantesList.find(r => String(r.id) === String(id));
  return rest ? rest.nombre : 'Desconocido';
}

function renderizarFavoritos() {
  const container = document.getElementById('mis-restaurantes-favoritos');
  const editBtn = document.getElementById('edit-favs-btn');

  if (isOwnProfile) {
      editBtn.classList.remove('hidden'); // Mostrar botón de editar si es su perfil
  }

  if (currentFavoritos.length === 0) {
    container.innerHTML = `<li class="text-gray-500 text-sm">${isOwnProfile ? 'No has elegido ningún favorito aún.' : 'Este usuario no tiene favoritos.'}</li>`;
    return;
  }

  container.innerHTML = '';
  currentFavoritos.forEach(id => {
    const li = document.createElement('li');
    li.className = "flex items-center text-sm font-medium text-gray-700 cursor-pointer hover:underline hover:text-[#c41200]";
    li.onclick = () => { window.location.href = `restaurante.html?id=${id}`; };
    li.innerHTML = `<i class="fas fa-heart text-[#c41200] text-xs mr-2"></i> ${getNombreRestaurante(id)}`;
    container.appendChild(li);
  });
}

function configurarEdicionFavoritos() {
  const editBtn = document.getElementById('edit-favs-btn');
  const listContainer = document.getElementById('mis-restaurantes-favoritos');
  const editContainer = document.getElementById('favs-edit-container');
  const selectContainer = document.getElementById('favs-select-container');
  const btnSave = document.getElementById('save-favs-btn');
  const btnCancel = document.getElementById('cancel-favs-btn');

  editBtn.addEventListener('click', () => {
    listContainer.classList.add('hidden');
    editBtn.classList.add('hidden');
    editContainer.classList.remove('hidden');

    // Crear 5 selects
    selectContainer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const select = document.createElement('select');
      select.className = "w-full border p-1 rounded text-sm focus:outline-none focus:ring-[#c41200] focus:border-[#c41200] fav-select";
      select.innerHTML = '<option value="">(Ninguno)</option>';

      restaurantesList.forEach(rest => {
        const option = document.createElement('option');
        option.value = rest.id;
        option.textContent = rest.nombre;
        if (currentFavoritos[i] && String(currentFavoritos[i]) === String(rest.id)) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      selectContainer.appendChild(select);
    }
  });

  btnCancel.addEventListener('click', () => {
    editContainer.classList.add('hidden');
    listContainer.classList.remove('hidden');
    editBtn.classList.remove('hidden');
  });

  btnSave.addEventListener('click', async () => {
    const selects = document.querySelectorAll('.fav-select');
    const nuevosFavoritos = [];

    selects.forEach(select => {
      if (select.value) {
        // Castear a numero si tu ID es numerico, sino dejarlo como string
        // Aquí lo pasamos como entero por si Supabase lo requiere así en tu base
        const val = isNaN(Number(select.value)) ? select.value : Number(select.value);
        nuevosFavoritos.push(val);
      }
    });

    // Filtrar duplicados por si eligieron el mismo dos veces
    const favoritosUnicos = [...new Set(nuevosFavoritos)];

    btnSave.disabled = true;
    btnSave.textContent = '...';

    try {
      const { error } = await supabaseClient
        .from('perfiles')
        .update({ restaurantes_favoritos: favoritosUnicos })
        .eq('id', profileUserId);

      if (error) throw error;

      currentFavoritos = favoritosUnicos;
      editContainer.classList.add('hidden');
      listContainer.classList.remove('hidden');

      renderizarFavoritos();

    } catch (err) {
      console.error('Error al actualizar favoritos:', err);
      alert("Ocurrió un error al guardar tus favoritos.");
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Guardar';
      editBtn.classList.remove('hidden');
    }
  });
}

// =========================================================================
// 6. LÓGICA DE BARRA DE BÚSQUEDA (MIXTA)
// =========================================================================

async function cargarDatosParaBusquedaNav() {
  try {
    // Restaurantes (ya estaban cargados, pero por si acaso remapeamos)
    if (restaurantesList.length > 0) {
        navRestaurantesCacheados = restaurantesList.map(r => ({ ...r, tipo: 'restaurante' }));
    }

    // Usuarios
    const { data: perfiles, error: errorPerf } = await supabaseClient
      .from('perfiles')
      .select('id, nombre_usuario, imagen_url');

    if (!errorPerf && perfiles) {
      navPerfilesCacheados = perfiles
          .filter(p => p.nombre_usuario)
          .map(p => ({
              id: p.id,
              nombre: p.nombre_usuario,
              imagen_url: p.imagen_url,
              tipo: 'usuario'
          }));
    }
  } catch (err) {
    console.error("Error al cargar datos mixtos para búsqueda nav:", err);
  }
}

function configurarBarraDeBusquedaMixtaNav() {
  const searchInput = document.getElementById('nav-search-input');
  const suggestionsContainer = document.getElementById('nav-search-suggestions');
  const suggestionsList = document.getElementById('nav-suggestions-list');

  if (!searchInput) return;

  searchInput.placeholder = "Busca un restaurante o un usuario...";

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (query === '') {
      suggestionsContainer.classList.add('hidden');
      return;
    }

    const todosLosDatos = [...navRestaurantesCacheados, ...navPerfilesCacheados];
    const coincidencias = todosLosDatos.filter(item =>
      item.nombre.toLowerCase().includes(query)
    );

    mostrarSugerenciasBusquedaMixta(coincidencias, query, suggestionsList, suggestionsContainer, searchInput);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.classList.add('hidden');
    }
  });
}

function mostrarSugerenciasBusquedaMixta(resultados, query, listElement, containerElement, inputElement) {
  listElement.innerHTML = '';

  if (resultados.length === 0) {
    const li = document.createElement('li');
    li.className = 'px-4 py-3 text-gray-500 text-sm text-center';
    li.textContent = 'No se encontraron resultados';
    listElement.appendChild(li);
  } else {
    const topResultados = resultados.slice(0, 6);

    topResultados.forEach(item => {
      const li = document.createElement('li');
      li.className = 'px-4 py-3 hover:bg-red-50 cursor-pointer border-b border-gray-100 transition last:border-b-0 text-gray-800 flex items-center justify-between text-sm';

      const regex = new RegExp(`(${query})`, "gi");
      const nombreResaltado = item.nombre.replace(regex, "<span class='font-bold text-[#c41200]'>$1</span>");

      let leftContent = '';
      if (item.tipo === 'restaurante') {
          leftContent = `<div class="flex items-center"><i class="fas fa-utensils text-gray-400 mr-3 w-4 text-center"></i> ${nombreResaltado}</div>`;
      } else {
          if (item.imagen_url) {
              leftContent = `<div class="flex items-center"><img src="${item.imagen_url}" class="w-6 h-6 rounded-full object-cover mr-3 border border-gray-200"> ${nombreResaltado}</div>`;
          } else {
              leftContent = `<div class="flex items-center"><i class="fas fa-user text-gray-400 mr-3 w-4 text-center"></i> ${nombreResaltado}</div>`;
          }
      }

      const rightBadge = item.tipo === 'restaurante'
          ? `<span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase tracking-wider">Lugar</span>`
          : `<span class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase tracking-wider">Usuario</span>`;

      li.innerHTML = `${leftContent} ${rightBadge}`;

      li.addEventListener('click', () => {
        inputElement.value = item.nombre;
        containerElement.classList.add('hidden');

        if (item.tipo === 'restaurante') {
            window.location.href = `restaurante.html?id=${item.id}`;
        } else {
            window.location.href = `perfil.html?id=${item.id}`;
        }
      });

      listElement.appendChild(li);
    });
  }

  containerElement.classList.remove('hidden');
}

// =========================================================================
// 7. LÓGICA DE SEGUIDORES (FOLLOWS)
// =========================================================================

let isFollowingUser = false;
let seguidoresData = [];
let seguidosData = [];

async function cargarSeguidores() {
    try {
        // Traer a quienes siguen al usuario actual (Seguidores)
        const { data: followers, error: errFollowers } = await supabaseClient
            .from('follows')
            .select('follower_id')
            .eq('following_id', profileUserId);

        if (errFollowers) throw errFollowers;

        // Comprobar si YO sigo a este usuario (por si ya está en la BD)
        if (currentSessionUserId && !isOwnProfile) {
            // Buscamos si currentSessionUserId (mi ID) está entre los follower_id
            isFollowingUser = followers.some(f => f.follower_id === currentSessionUserId);
        }

        const followerIds = followers.map(f => f.follower_id);
        if (followerIds.length > 0) {
            const { data: pFollowers } = await supabaseClient
                .from('perfiles')
                .select('id, nombre_usuario, imagen_url')
                .in('id', followerIds);
            seguidoresData = pFollowers || [];
        } else {
            seguidoresData = [];
        }
        document.getElementById('stats-seguidores').textContent = seguidoresData.length;

        // Traer a quienes sigue el usuario actual (Seguidos)
        const { data: following, error: errFollowing } = await supabaseClient
            .from('follows')
            .select('following_id')
            .eq('follower_id', profileUserId);

        if (errFollowing) throw errFollowing;

        const followingIds = following.map(f => f.following_id);
        if (followingIds.length > 0) {
            const { data: pFollowing } = await supabaseClient
                .from('perfiles')
                .select('id, nombre_usuario, imagen_url')
                .in('id', followingIds);
            seguidosData = pFollowing || [];
        } else {
            seguidosData = [];
        }
        document.getElementById('stats-seguidos').textContent = seguidosData.length;

    } catch(err) {
        console.error("Error al cargar seguidores/seguidos:", err);
    }
}

function configurarBotonSeguir() {
    const followBtn = document.getElementById('follow-btn');

    if (!followBtn) return;

    // Solo mostramos el botón si NO es mi propio perfil y estoy logueado
    if (!isOwnProfile && currentSessionUserId) {
        // Actualizamos visualmente el botón
        actualizarBotonSeguirUI();

        // Evitamos que se acumulen event listeners reemplazando el botón por un clon
        const newBtn = followBtn.cloneNode(true);
        followBtn.parentNode.replaceChild(newBtn, followBtn);

        newBtn.addEventListener('click', async () => {
            newBtn.disabled = true;
            try {
                // Comprobación directa a la BD
                const { data: verifyData, error: verifyError } = await supabaseClient
                    .from('follows')
                    .select('*')
                    .match({ follower_id: currentSessionUserId, following_id: profileUserId });

                if (verifyError) throw verifyError;

                const actuallyFollowing = verifyData && verifyData.length > 0;

                if (actuallyFollowing) {
                    // DEJAR DE SEGUIR
                    const { error } = await supabaseClient
                        .from('follows')
                        .delete()
                        .match({ follower_id: currentSessionUserId, following_id: profileUserId });

                    if (error) throw error;

                    // Borrar notificacion
                    await supabaseClient.from('notificaciones').delete().match({ tipo: 'follow', actor_id: currentSessionUserId, usuario_id: profileUserId });

                    isFollowingUser = false;
                } else {
                    // SEGUIR
                    const { error } = await supabaseClient
                        .from('follows')
                        .insert({ follower_id: currentSessionUserId, following_id: profileUserId });

                    if (error) throw error;

                    // Crear notificacion
                    await supabaseClient.from('notificaciones').insert({
                        usuario_id: profileUserId,
                        actor_id: currentSessionUserId,
                        tipo: 'follow'
                    });

                    isFollowingUser = true;
                }

                // Recargar la info completa para actualizar contadores y el estado del botón
                await cargarSeguidores();
                actualizarBotonSeguirUI();
            } catch(err) {
                console.error("Error al seguir/dejar de seguir:", err);

                // Mostrar alerta con el error exacto para debugear el RLS
                let errMsg = "Error desconocido.";
                if (err.message) errMsg = err.message;
                else if (err.details) errMsg = err.details;
                else if (typeof err === 'string') errMsg = err;

                alert(`Error al procesar la acción.\n\nDetalle: ${errMsg}`);
            } finally {
                newBtn.disabled = false;
            }
        });
    }
}

function actualizarBotonSeguirUI() {
    const followBtn = document.getElementById('follow-btn');
    if (!followBtn) return;

    if (isFollowingUser) {
        followBtn.textContent = "Siguiendo";
        followBtn.className = "text-sm bg-gray-200 text-gray-800 px-4 py-1.5 rounded-full font-semibold hover:bg-gray-300 transition ml-2 shadow-sm border border-gray-300";
    } else {
        followBtn.textContent = "Seguir";
        followBtn.className = "text-sm bg-[#c41200] text-white px-4 py-1.5 rounded-full font-semibold hover:bg-[#a00e00] transition ml-2 shadow-sm";
    }
}

function configurarModalesFollows() {
    const modal = document.getElementById('follows-modal');
    const modalTitle = document.getElementById('follows-modal-title');
    const listContainer = document.getElementById('follows-list-container');
    const closeBtn = document.getElementById('close-follows-modal');

    if (!modal) return;

    // Cerrar modal
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Abrir Seguidores
    const followersContainer = document.getElementById('followers-container');
    if (followersContainer) {
        const newFc = followersContainer.cloneNode(true);
        followersContainer.parentNode.replaceChild(newFc, followersContainer);
        newFc.addEventListener('click', () => {
            abrirModalUsuarios("Seguidores", seguidoresData);
        });
    }

    // Abrir Seguidos
    const followingContainer = document.getElementById('following-container');
    if (followingContainer) {
        const newFic = followingContainer.cloneNode(true);
        followingContainer.parentNode.replaceChild(newFic, followingContainer);
        newFic.addEventListener('click', () => {
            abrirModalUsuarios("Siguiendo", seguidosData);
        });
    }

    function abrirModalUsuarios(titulo, listaUsuarios) {
        modalTitle.textContent = titulo;
        listContainer.innerHTML = '';

        if (listaUsuarios.length === 0) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 mt-4 py-4">No hay usuarios para mostrar.</p>`;
        } else {
            listaUsuarios.forEach(u => {
                const imgHtml = (u.imagen_url && u.imagen_url.trim() !== '')
                    ? `<img src="${u.imagen_url}" class="w-10 h-10 rounded-full object-cover">`
                    : `<div class="w-10 h-10 bg-red-100 text-[#c41200] rounded-full flex justify-center items-center font-bold text-lg"><i class="fas fa-user"></i></div>`;

                const div = document.createElement('div');
                div.className = "flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer rounded transition";
                div.onclick = () => { window.location.href = `perfil.html?id=${u.id}`; };
                div.innerHTML = `
                    ${imgHtml}
                    <span class="font-semibold text-gray-800 hover:underline">${u.nombre_usuario || 'Usuario Anónimo'}</span>
                `;
                listContainer.appendChild(div);
            });
        }

        modal.classList.remove('hidden');
    }
}

// =========================================================================
// 8. SISTEMA DE NOTIFICACIONES (Universal para NavBar)
// =========================================================================

async function configurarNotificaciones() {
    const notifBtn = document.getElementById('nav-notifications-btn');
    const notifDropdown = document.getElementById('nav-notifications-dropdown');
    const notifBadge = document.getElementById('nav-notifications-badge');
    const notifList = document.getElementById('nav-notifications-list');
    const markAllReadBtn = document.getElementById('mark-all-read-btn');

    if (!notifBtn || !currentSessionUserId) return;

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
                .eq('usuario_id', currentSessionUserId)
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
                .eq('usuario_id', currentSessionUserId)
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
