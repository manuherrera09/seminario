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
            <button id="logout-btn" class="text-sm bg-red-800 text-white px-3 py-1 rounded font-bold hover:bg-red-900 transition ml-2">Cerrar sesión</button>
        `;

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
  }

  // Cargar seguidores y seguidos
  await cargarSeguidores();
  configurarBotonSeguir();
  configurarModalesFollows();

  cargarHistorialResenas();
  renderizarFavoritos();
  configurarBarraDeBusqueda();
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

        const divResena = document.createElement('div');
        divResena.className = "border border-gray-100 rounded-lg p-4 hover:shadow-md transition mb-4 bg-white cursor-pointer";
        divResena.onclick = () => {
            window.location.href = `restaurante.html?id=${resena.id_restaurante}`;
        };

        divResena.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                      <div>
                        <h3 class="font-bold text-lg text-[#c41200] hover:underline">${nombreRestaurante}</h3>
                        <p class="text-xs text-gray-400">Escrita el ${fechaFormateada}</p>
                      </div>
                    </div>

                    <div class="mb-3 flex items-center gap-2">
                      <span class="bg-yellow-100 text-yellow-800 text-sm font-semibold px-2.5 py-0.5 rounded">General: ${resena.puntuacion_general}.0 ★</span>
                    </div>

                    <div class="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 mb-3 bg-gray-50 p-2 rounded">
                       <span><strong>Comida:</strong> ${resena.calidad_comida} ★</span>
                       <span><strong>Atención:</strong> ${resena.atencion} ★</span>
                       <span><strong>Precio:</strong> ${resena.precio} ★</span>
                    </div>

                    <p class="text-gray-700 text-sm">${resena.comentario}</p>
                  `;

        container.appendChild(divResena);
      }
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
// 6. LÓGICA DE BARRA DE BÚSQUEDA
// =========================================================================
function configurarBarraDeBusqueda() {
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

    const coincidencias = restaurantesList.filter(rest =>
      rest.nombre.toLowerCase().includes(query)
    );

    mostrarSugerenciasBusqueda(coincidencias, query, suggestionsList, suggestionsContainer, searchInput);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.classList.add('hidden');
    }
  });
}

function mostrarSugerenciasBusqueda(resultados, query, listElement, containerElement, inputElement) {
  listElement.innerHTML = '';

  if (resultados.length === 0) {
    const li = document.createElement('li');
    li.className = 'px-4 py-3 text-gray-500 text-sm text-center';
    li.textContent = 'No se encontraron restaurantes';
    listElement.appendChild(li);
  } else {
    const topResultados = resultados.slice(0, 5);

    topResultados.forEach(rest => {
      const li = document.createElement('li');
      li.className = 'px-4 py-3 hover:bg-red-50 cursor-pointer border-b border-gray-100 transition last:border-b-0 text-gray-800 flex items-center text-sm';

      const regex = new RegExp(`(${query})`, "gi");
      const nombreResaltado = rest.nombre.replace(regex, "<span class='font-bold text-[#c41200]'>$1</span>");

      li.innerHTML = `<i class="fas fa-utensils text-gray-400 mr-3"></i> ${nombreResaltado}`;

      li.addEventListener('click', () => {
        inputElement.value = rest.nombre;
        containerElement.classList.add('hidden');
        // Redirigir a la página de detalles del restaurante, pasando el ID en la URL
        window.location.href = `restaurante.html?id=${rest.id}`;
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
            .select(`
                follower_id,
                perfiles:follower_id (id, nombre_usuario, imagen_url)
            `)
            .eq('following_id', profileUserId);

        if (errFollowers) throw errFollowers;

        // Formatear array de seguidores
        seguidoresData = followers.map(f => f.perfiles).filter(Boolean);
        document.getElementById('stats-seguidores').textContent = seguidoresData.length;

        // Comprobar si YO sigo a este usuario
        if (currentSessionUserId && !isOwnProfile) {
            isFollowingUser = followers.some(f => f.follower_id === currentSessionUserId);
        }

        // Traer a quienes sigue el usuario actual (Seguidos)
        const { data: following, error: errFollowing } = await supabaseClient
            .from('follows')
            .select(`
                following_id,
                perfiles:following_id (id, nombre_usuario, imagen_url)
            `)
            .eq('follower_id', profileUserId);

        if (errFollowing) throw errFollowing;

        seguidosData = following.map(f => f.perfiles).filter(Boolean);
        document.getElementById('stats-seguidos').textContent = seguidosData.length;

    } catch(err) {
        console.error("Error al cargar seguidores/seguidos:", err);
    }
}

function configurarBotonSeguir() {
    const followBtn = document.getElementById('follow-btn');

    // Solo mostramos el botón si NO es mi propio perfil y estoy logueado
    if (!isOwnProfile && currentSessionUserId) {
        followBtn.classList.remove('hidden');
        actualizarBotonSeguirUI();

        followBtn.addEventListener('click', async () => {
            followBtn.disabled = true;
            try {
                if (isFollowingUser) {
                    // Dejar de seguir
                    const { error } = await supabaseClient
                        .from('follows')
                        .delete()
                        .match({ follower_id: currentSessionUserId, following_id: profileUserId });

                    if (error) throw error;
                    isFollowingUser = false;
                } else {
                    // Seguir: primero verificar si ya lo sigo para evitar el error de unique constraint
                    const yaSigo = seguidoresData.some(f => f.id === currentSessionUserId);

                    if (!yaSigo) {
                        const { error } = await supabaseClient
                            .from('follows')
                            .insert({ follower_id: currentSessionUserId, following_id: profileUserId });

                        if (error) throw error;
                    }
                    isFollowingUser = true;
                }

                // Recargar info
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
                followBtn.disabled = false;
            }
        });
    }
}

function actualizarBotonSeguirUI() {
    const followBtn = document.getElementById('follow-btn');
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

    // Cerrar modal
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Abrir Seguidores
    document.getElementById('followers-container').addEventListener('click', () => {
        abrirModalUsuarios("Seguidores", seguidoresData);
    });

    // Abrir Seguidos
    document.getElementById('following-container').addEventListener('click', () => {
        abrirModalUsuarios("Siguiendo", seguidosData);
    });

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
