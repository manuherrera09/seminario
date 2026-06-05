// supabaseClient and currentUserId are now global, provided by app.js
let viewedUserId = null;
let allUserRestaurants = []; // Cache for favorite restaurants editing
let allUserReviews = []; // Cache for user's reviews
let allUserVotes = []; // Cache for votes on those reviews

// =========================================================================
// 2. INICIALIZACIÓN DE LA PÁGINA
// =========================================================================
function initProfilePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');

    if (idFromUrl) {
        viewedUserId = idFromUrl;
    } else if (currentUserId) {
        viewedUserId = currentUserId;
    } else {
        // Si no hay ID en la URL y no hay sesión, redirigir a login
        window.location.href = 'login.html';
        return;
    }

    // Cargar todos los datos del perfil
    loadProfileData();

    // Configurar listeners de los botones de edición y modales
    setupEventListeners();

    // Configurar filtro de reseñas
    const sortReviews = document.getElementById('sort-reviews');
    if (sortReviews) {
        sortReviews.addEventListener('change', (e) => {
            renderUserReviews(e.target.value);
        });
    }
}

// Escuchar el evento personalizado desde app.js o ejecutar directamente si ya está listo
if (typeof navAuthReady !== 'undefined' && navAuthReady) {
    initProfilePage();
} else {
    document.addEventListener('navAuthReady', initProfilePage);
}

// =========================================================================
// 3. CARGA DE DATOS DEL PERFIL
// =========================================================================
async function loadProfileData() {
    try {
        // Cargar perfil, reseñas, seguidores y seguidos en paralelo
        const [profileRes, reviewsRes, followersRes, followingRes] = await Promise.all([
            supabaseClient.from('perfiles').select('*').eq('id', viewedUserId).single(),
            supabaseClient.from('resenas').select('*, restaurantes(id, nombre)').eq('id_usuario', viewedUserId),
            supabaseClient.from('follows').select('follower_id', { count: 'exact' }).eq('following_id', viewedUserId),
            supabaseClient.from('follows').select('following_id', { count: 'exact' }).eq('follower_id', viewedUserId)
        ]);

        // --- Renderizar Información del Perfil ---
        if (profileRes.error) throw profileRes.error;
        const profile = profileRes.data;

        const followersCount = followersRes.count !== null ? followersRes.count : 0;
        const followingCount = followingRes.count !== null ? followingRes.count : 0;

        if (followersRes.error) console.error("Error cargando seguidores:", followersRes.error);
        if (followingRes.error) console.error("Error cargando seguidos:", followingRes.error);

        renderProfileHeader(profile, followersCount, followingCount);

        // --- Cargar y Guardar Reseñas y Votos en caché ---
        if (reviewsRes.error) throw reviewsRes.error;
        allUserReviews = reviewsRes.data || [];

        const reviewIds = allUserReviews.map(r => r.id);
        if (reviewIds.length > 0) {
            const { data: votesData, error: votesError } = await supabaseClient
                .from('resenas_votos')
                .select('resena_id, usuario_id, tipo')
                .in('resena_id', reviewIds);
            if (votesError) throw votesError;
            allUserVotes = votesData;
        }

        // Renderizar por primera vez (orden por defecto)
        renderUserReviews('recientes');
        document.getElementById('stats-resenas').textContent = allUserReviews.length;

        // Calcular y mostrar la insignia del usuario
        calcularYMostrarInsignia(allUserReviews.length);

        // --- Lógica de Botones (Seguir/Editar) ---
        const { data: isFollowingData, error: isFollowingError } = await supabaseClient
            .from('follows')
            .select('follower_id')
            .eq('follower_id', currentUserId)
            .eq('following_id', viewedUserId);

        if(isFollowingError) console.error("Error al verificar si sigue al usuario:", isFollowingError);

        setupActionButtons(isFollowingData && isFollowingData.length > 0);

        // --- Cargar Restaurantes Favoritos ---
        await loadFavoriteRestaurants(profile.restaurantes_favoritos);

    } catch (error) {
        console.error('Error al cargar el perfil:', error);
        let errorMsg = error.message || JSON.stringify(error);

        if (error.code === 'PGRST116') {
            errorMsg = "No se encontró el usuario o las políticas de privacidad (RLS) impiden ver su información.";
        }

        document.querySelector('main').innerHTML = `
            <div class="text-center py-20">
                <i class="fas fa-user-slash text-5xl text-gray-300 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Error al cargar el perfil</h2>
                <p class="text-gray-500 mb-4">Es posible que el usuario no exista o sea privado.</p>
                <div class="bg-red-50 text-red-600 p-3 rounded text-sm inline-block max-w-lg mx-auto">
                    <strong>Detalle técnico:</strong> ${errorMsg}
                </div>
            </div>
        `;
    }
}

// =========================================================================
// 4. RENDERIZADO DE COMPONENTES
// =========================================================================
function renderProfileHeader(profile, followersCount, followingCount) {
    document.getElementById('profile-name').textContent = profile.nombre_usuario || 'Usuario';
    document.getElementById('profile-email').textContent = profile.email;
    document.querySelector('#profile-email + p').textContent = `Miembro desde: ${new Date(profile.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}`;

    // Foto de Portada
    const coverImage = document.getElementById('cover-image');
    const coverPlaceholder = document.getElementById('cover-placeholder');
    if (profile.portada_url) {
        coverImage.src = profile.portada_url;
        coverImage.classList.remove('hidden');
        coverPlaceholder.classList.add('hidden');
    } else {
        coverImage.classList.add('hidden');
        coverPlaceholder.classList.remove('hidden');
    }

    // Biografía
    const bioContainer = document.getElementById('bio-container');
    const profileBio = document.getElementById('profile-bio');
    if (profile.biografia) {
        profileBio.textContent = profile.biografia;
        bioContainer.classList.remove('hidden');
    }

    // Foto de perfil
    const profileImage = document.getElementById('profile-image');
    const profileIcon = document.getElementById('profile-icon');
    if (profile.imagen_url) {
        profileImage.src = profile.imagen_url;
        profileImage.classList.remove('hidden');
        profileIcon.classList.add('hidden');
    } else {
        profileImage.classList.add('hidden');
        profileIcon.classList.remove('hidden');
        profileIcon.textContent = (profile.nombre_usuario || 'U').charAt(0).toUpperCase();
    }

    // Estadísticas
    document.getElementById('stats-seguidores').textContent = followersCount;
    document.getElementById('stats-seguidos').textContent = followingCount;
}

function renderUserReviews(sortMode = 'recientes') {
    const container = document.getElementById('mis-resenas');
    const emptyMsg = document.getElementById('mis-resenas-vacio');

    if (!allUserReviews || allUserReviews.length === 0) {
        if (emptyMsg) {
            emptyMsg.textContent = 'Este usuario aún no ha escrito ninguna reseña.';
            emptyMsg.classList.remove('hidden');
        }
        if (container) container.innerHTML = ''; // Limpiar por si había algo
        return;
    }

    if (emptyMsg) emptyMsg.classList.add('hidden');
    if (container) container.innerHTML = ''; // Limpiar

    let sortedReviews = [...allUserReviews];

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

    sortedReviews.forEach(review => {
        const reviewEl = document.createElement('div');
        reviewEl.className = 'border-b last:border-b-0 pb-4 mb-4';
        reviewEl.setAttribute('data-review-id', review.id); // ID para poder eliminarlo del DOM

        const restaurantName = review.restaurantes ? review.restaurantes.nombre : 'un restaurante';
        const restaurantId = review.restaurantes ? review.restaurantes.id : null;

        // Lógica de votos
        const reviewVotes = allUserVotes.filter(v => v.resena_id === review.id);
        const likesCount = reviewVotes.filter(v => v.tipo === 'like').length;
        const dislikesCount = reviewVotes.filter(v => v.tipo === 'dislike').length;
        const userVote = currentUserId ? reviewVotes.find(v => v.usuario_id === currentUserId)?.tipo : null;

        const likeClass = userVote === 'like' ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50';
        const dislikeClass = userVote === 'dislike' ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50';

        let actionsHTML = '';
        if (currentUserId && currentUserId === viewedUserId) {
            actionsHTML = `
                <div class="flex items-center gap-2 mt-3">
                    <button onclick="window.location.href='resena.html?edit_id=${review.id}'" class="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded font-semibold hover:bg-blue-200 transition">
                        <i class="fas fa-edit mr-1"></i> Editar
                    </button>
                    <button onclick="handleDeleteReview('${review.id}')" class="text-xs bg-red-100 text-red-700 px-3 py-1 rounded font-semibold hover:bg-red-200 transition">
                        <i class="fas fa-trash mr-1"></i> Eliminar
                    </button>
                </div>
            `;
        }

        reviewEl.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold text-lg hover:text-[#c41200] cursor-pointer" onclick="window.location.href='restaurante.html?id=${restaurantId}'">${restaurantName}</h4>
                    <p class="text-xs text-gray-400">${new Date(review.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <span class="text-sm font-bold text-yellow-500">${review.puntuacion_general} ★</span>
            </div>
            <p class="text-gray-600 text-sm mb-2">"${review.comentario}"</p>

            <div class="flex items-center justify-between mt-3">
                ${actionsHTML}
                <div class="flex items-center gap-2 ml-auto">
                    <button class="btn-like flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${likeClass}" data-resena-id="${review.id}" data-autor-id="${review.id_usuario}">
                        <i class="fas fa-thumbs-up pointer-events-none"></i> <span class="like-count pointer-events-none">${likesCount}</span>
                    </button>
                    <button class="btn-dislike flex items-center gap-1 px-2 py-1 rounded transition text-xs font-semibold ${dislikeClass}" data-resena-id="${review.id}">
                        <i class="fas fa-thumbs-down pointer-events-none"></i> <span class="dislike-count pointer-events-none">${dislikesCount}</span>
                    </button>
                </div>
            </div>
        `;
        if (container) container.appendChild(reviewEl);
    });

    // Re-configurar los listeners de los botones de voto
    configurarVotos();
}


async function loadFavoriteRestaurants(favIds) {
    const favList = document.getElementById('mis-restaurantes-favoritos');
    const emptyMsg = document.getElementById('mis-restaurantes-vacio');

    if (!favIds || favIds.length === 0) {
        emptyMsg.textContent = 'Aún no hay restaurantes favoritos.';
        return;
    }

    const { data, error } = await supabaseClient
        .from('restaurantes')
        .select('id, nombre')
        .in('id', favIds);

    if (error) {
        emptyMsg.textContent = 'Error al cargar favoritos.';
        return;
    }

    emptyMsg.classList.add('hidden');
    favList.innerHTML = '';
    data.forEach(rest => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between text-sm';
        li.innerHTML = `
            <a href="restaurante.html?id=${rest.id}" class="hover:text-[#c41200] font-medium">${rest.nombre}</a>
        `;
        favList.appendChild(li);
    });
}

// =========================================================================
// 5. MANEJO DE EVENTOS Y ACCIONES
// =========================================================================

function calcularYMostrarInsignia(reviewCount) {
    const badgeContainer = document.getElementById('user-badge-container');
    const badge = document.getElementById('user-badge');
    if (!badge || !badgeContainer) return;

    let insignia = { texto: 'Novato', color: 'bg-gray-100', icono: 'fa-concierge-bell' };

    if (reviewCount >= 200) {
        insignia = { texto: 'Referente TrackEat', color: 'bg-black text-white', icono: 'fa-trophy' };
    } else if (reviewCount >= 151) {
        insignia = { texto: 'Gurú Gastronómico', color: 'bg-purple-600 text-white', icono: 'fa-crown' };
    } else if (reviewCount >= 100) {
        insignia = { texto: 'Crítico Reconocido', color: 'bg-yellow-400 text-yellow-900', icono: 'fa-star' };
    } else if (reviewCount >= 60) {
        insignia = { texto: 'Comensal Experto', color: 'bg-red-500 text-white', icono: 'fa-fire' };
    } else if (reviewCount >= 30) {
        insignia = { texto: 'Crítico Amateur', color: 'bg-orange-400 text-white', icono: 'fa-pen-nib' };
    } else if (reviewCount >= 15) {
        insignia = { texto: 'Crítico Emergente', color: 'bg-blue-400 text-white', icono: 'fa-lightbulb' };
    } else if (reviewCount >= 5) {
        insignia = { texto: 'Explorador Gastronómico', color: 'bg-green-500 text-white', icono: 'fa-map-signs' };
    } else if (reviewCount >= 1) {
        insignia = { texto: 'Nuevo Comensal', color: 'bg-green-200 text-green-800', icono: 'fa-utensils' };
    }

    badge.className = `text-xs px-3 py-1 rounded-full font-semibold border ${insignia.color}`;
    badge.innerHTML = `<i class="fas ${insignia.icono} mr-1"></i> ${insignia.texto}`;
    badgeContainer.classList.remove('hidden');
}

async function handleDeleteReview(reviewId) {
    const isConfirmed = confirm('¿Estás seguro de que quieres eliminar esta reseña? Esta acción no se puede deshacer.');

    if (isConfirmed) {
        try {
            // Por seguridad, primero borramos los votos asociados a la reseña
            const { error: voteError } = await supabaseClient
                .from('resenas_votos')
                .delete()
                .eq('resena_id', reviewId);

            if (voteError) throw voteError;

            // Luego, borramos la reseña
            const { error: reviewError } = await supabaseClient
                .from('resenas')
                .delete()
                .eq('id', reviewId)
                .eq('id_usuario', currentUserId); // Doble chequeo de seguridad

            if (reviewError) throw reviewError;

            // Eliminar la reseña de la caché local
            allUserReviews = allUserReviews.filter(r => r.id !== reviewId);

            // Volver a renderizar
            const sortMode = document.getElementById('sort-reviews').value;
            renderUserReviews(sortMode);

            // Actualizar el contador de reseñas y la insignia
            const newCount = allUserReviews.length;
            document.getElementById('stats-resenas').textContent = newCount;
            calcularYMostrarInsignia(newCount);

            alert('Reseña eliminada correctamente.');

        } catch (error) {
            console.error('Error al eliminar la reseña:', error);
            alert(`No se pudo eliminar la reseña. Error: ${error.message}`);
        }
    }
}

function setupEventListeners() {
    // --- Edición de Biografía ---
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const saveBioBtn = document.getElementById('save-bio-btn');
    const cancelBioBtn = document.getElementById('cancel-bio-btn');

    if (editProfileBtn) editProfileBtn.addEventListener('click', toggleBioEditMode);
    if (saveBioBtn) saveBioBtn.addEventListener('click', saveProfile);
    if (cancelBioBtn) cancelBioBtn.addEventListener('click', toggleBioEditMode);

    // --- Edición de Restaurantes Favoritos ---
    const editFavsBtn = document.getElementById('edit-favs-btn');
    const saveFavsBtn = document.getElementById('save-favs-btn');
    const cancelFavsBtn = document.getElementById('cancel-favs-btn');

    if (editFavsBtn) editFavsBtn.addEventListener('click', toggleFavsEditMode);
    if (saveFavsBtn) saveFavsBtn.addEventListener('click', saveFavoriteRestaurants);
    if (cancelFavsBtn) cancelFavsBtn.addEventListener('click', toggleFavsEditMode);

    // --- Modal de Seguidores/Seguidos ---
    const followersContainer = document.getElementById('followers-container');
    const followingContainer = document.getElementById('following-container');
    const closeModalBtn = document.getElementById('close-follows-modal');

    if (followersContainer) followersContainer.addEventListener('click', () => openFollowsModal('seguidores'));
    if (followingContainer) followingContainer.addEventListener('click', () => openFollowsModal('seguidos'));
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeFollowsModal);
}

function setupActionButtons(isFollowing) {
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const editFavsBtn = document.getElementById('edit-favs-btn');
    const followBtn = document.getElementById('follow-btn');

    if (currentUserId === viewedUserId) {
        // Es mi perfil
        if (editProfileBtn) editProfileBtn.classList.remove('hidden');
        if (editFavsBtn) editFavsBtn.classList.remove('hidden');
        if (followBtn) followBtn.classList.add('hidden');
    } else {
        // Es el perfil de otro
        if (editProfileBtn) editProfileBtn.classList.add('hidden');
        if (editFavsBtn) editFavsBtn.classList.add('hidden');
        if (followBtn) {
            followBtn.classList.remove('hidden');
            updateFollowButton(isFollowing);
            followBtn.addEventListener('click', toggleFollow);
        }
    }
}

function updateFollowButton(isFollowing) {
    const followBtn = document.getElementById('follow-btn');
    if (isFollowing) {
        followBtn.textContent = 'Dejar de Seguir';
        followBtn.classList.replace('bg-[#c41200]', 'bg-gray-500');
        followBtn.classList.replace('hover:bg-[#a00e00]', 'hover:bg-gray-600');
    } else {
        followBtn.textContent = 'Seguir';
        followBtn.classList.replace('bg-gray-500', 'bg-[#c41200]');
        followBtn.classList.replace('hover:bg-gray-600', 'hover:bg-[#a00e00]');
    }
}

async function toggleFollow() {
    if (!currentUserId) {
        alert('Debes iniciar sesión para seguir a otros usuarios.');
        return;
    }

    const followBtn = document.getElementById('follow-btn');
    followBtn.disabled = true;

    const { data, error } = await supabaseClient
        .from('follows')
        .select('*')
        .eq('follower_id', currentUserId)
        .eq('following_id', viewedUserId);

    const isFollowing = data && data.length > 0;

    try {
        if (isFollowing) {
            // Dejar de seguir
            await supabaseClient.from('follows').delete().match({ follower_id: currentUserId, following_id: viewedUserId });
            updateFollowButton(false);
        } else {
            // Seguir
            await supabaseClient.from('follows').insert({ follower_id: currentUserId, following_id: viewedUserId });
            updateFollowButton(true);
        }
        // Recargar estadísticas de seguidores
        const { count } = await supabaseClient.from('follows').select('*', { count: 'exact' }).eq('following_id', viewedUserId);
        document.getElementById('stats-seguidores').textContent = count;

    } catch (err) {
        console.error('Error al seguir/dejar de seguir:', err);
    } finally {
        followBtn.disabled = false;
    }
}

function toggleBioEditMode() {
    document.getElementById('bio-container').classList.toggle('hidden');
    document.getElementById('bio-edit-container').classList.toggle('hidden');
    // Pre-rellenar el formulario
    document.getElementById('bio-edit-textarea').value = document.getElementById('profile-bio').textContent;
    document.getElementById('image-url-input').value = document.getElementById('profile-image').src;
    document.getElementById('cover-url-input').value = document.getElementById('cover-image').src;
}

async function saveProfile() {
    const newBio = document.getElementById('bio-edit-textarea').value;
    const newImageUrl = document.getElementById('image-url-input').value;
    const newCoverUrl = document.getElementById('cover-url-input').value;

    const { error } = await supabaseClient
        .from('perfiles')
        .update({
            biografia: newBio,
            imagen_url: newImageUrl,
            portada_url: newCoverUrl
        })
        .eq('id', currentUserId);

    if (error) {
        alert('Error al guardar el perfil.');
    } else {
        // Actualizar la UI sin recargar
        document.getElementById('profile-bio').textContent = newBio;
        if (newBio) document.getElementById('bio-container').classList.remove('hidden');
        else document.getElementById('bio-container').classList.add('hidden');

        if (newImageUrl) {
            document.getElementById('profile-image').src = newImageUrl;
            document.getElementById('profile-image').classList.remove('hidden');
            document.getElementById('profile-icon').classList.add('hidden');
        }

        if (newCoverUrl) {
            document.getElementById('cover-image').src = newCoverUrl;
            document.getElementById('cover-image').classList.remove('hidden');
            document.getElementById('cover-placeholder').classList.add('hidden');
        }

        toggleBioEditMode();
    }
}

async function toggleFavsEditMode() {
    const isEditing = document.getElementById('favs-edit-container').classList.toggle('hidden');
    document.getElementById('mis-restaurantes-favoritos').classList.toggle('hidden');

    if (!isEditing) { // Si estamos entrando en modo edición
        const selectContainer = document.getElementById('favs-select-container');
        selectContainer.innerHTML = '<p class="text-sm text-gray-500">Cargando restaurantes...</p>';

        // Cargar todos los restaurantes para los selects
        if (allUserRestaurants.length === 0) {
            const { data } = await supabaseClient.from('restaurantes').select('id, nombre').order('nombre');
            allUserRestaurants = data || [];
        }

        // Obtener favoritos actuales
        const { data: profile } = await supabaseClient.from('perfiles').select('restaurantes_favoritos').eq('id', currentUserId).single();
        const currentFavs = profile.restaurantes_favoritos || [];

        selectContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const select = document.createElement('select');
            select.className = 'w-full border p-2 rounded text-sm mb-2';
            let options = '<option value="">-- Selecciona un restaurante --</option>';
            allUserRestaurants.forEach(r => {
                const isSelected = currentFavs[i] === r.id ? 'selected' : '';
                options += `<option value="${r.id}" ${isSelected}>${r.nombre}</option>`;
            });
            select.innerHTML = options;
            selectContainer.appendChild(select);
        }
    }
}

async function saveFavoriteRestaurants() {
    const selects = document.querySelectorAll('#favs-select-container select');
    const newFavs = Array.from(selects).map(s => s.value).filter(Boolean); // Filtra vacíos

    const { error } = await supabaseClient
        .from('perfiles')
        .update({ restaurantes_favoritos: newFavs })
        .eq('id', currentUserId);

    if (error) {
        alert('Error al guardar los favoritos.');
    } else {
        await loadFavoriteRestaurants(newFavs);
        toggleFavsEditMode();
    }
}

async function openFollowsModal(type) {
    const modal = document.getElementById('follows-modal');
    const title = document.getElementById('follows-modal-title');
    const listContainer = document.getElementById('follows-list-container');
    modal.classList.remove('hidden');
    listContainer.innerHTML = '<p class="text-center text-gray-500 text-sm">Cargando...</p>';

    let idsToFetch = [];
    if (type === 'seguidores') {
        title.textContent = 'Seguidores';
        const { data: followsData, error: fError } = await supabaseClient.from('follows').select('follower_id').eq('following_id', viewedUserId);
        if (!fError && followsData) idsToFetch = followsData.map(f => f.follower_id);
    } else {
        title.textContent = 'Seguidos';
        const { data: followsData, error: fError } = await supabaseClient.from('follows').select('following_id').eq('follower_id', viewedUserId);
        if (!fError && followsData) idsToFetch = followsData.map(f => f.following_id);
    }

    if (idsToFetch.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 text-sm">No hay usuarios que mostrar.</p>`;
        return;
    }

    const { data, error } = await supabaseClient.from('perfiles').select('id, nombre_usuario, imagen_url').in('id', idsToFetch);

    if (error || !data || data.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 text-sm">No se pudieron cargar los usuarios.</p>`;
        return;
    }

    listContainer.innerHTML = '';
    data.forEach(user => {
        const userEl = document.createElement('div');
        userEl.className = 'flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer';
        userEl.onclick = () => window.location.href = `perfil.html?id=${user.id}`;
        userEl.innerHTML = `
            <img src="${user.imagen_url || ''}" class="w-10 h-10 rounded-full object-cover bg-gray-200">
            <span class="font-semibold">${user.nombre_usuario}</span>
        `;
        listContainer.appendChild(userEl);
    });
}

function closeFollowsModal() {
    document.getElementById('follows-modal').classList.add('hidden');
}
