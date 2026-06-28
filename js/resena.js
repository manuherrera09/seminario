// supabaseClient y currentUserId son globales, proporcionados por app.js

let editReviewId = null; // ID de la reseña a editar (si existe)
let restaurantesList = []; // Para almacenar todos los restaurantes para la búsqueda

// =========================================================================
// 2. INICIALIZACIÓN DE LA PÁGINA
// =========================================================================
document.addEventListener('navAuthReady', async () => {

  // ---- Control de UI basado en la sesión ----
  if (!currentUserId) {
    // Si NO hay sesión, bloqueamos el formulario y mostramos advertencia
    document.getElementById('auth-warning').classList.remove('hidden');
    const submitBtn = document.getElementById('submit-btn');
    if(submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('cursor-not-allowed', 'opacity-50');
    }

    const formElements = document.getElementById('resena-form').elements;
    for (let i = 0; i < formElements.length; i++) {
      formElements[i].disabled = true;
    }
  }

  // ---- Cargar Restaurantes para el buscador ----
  const searchInput = document.getElementById('restaurante-search');
  const suggestionsContainer = document.getElementById('resena-search-suggestions');
  const suggestionsList = document.getElementById('resena-search-suggestions-list');

  try {
    const { data: restaurantes, error } = await supabaseClient
      .from('restaurantes')
      .select('id, nombre, direccion')
      .order('nombre', { ascending: true });

    if (error) throw error;

    if (restaurantes && restaurantes.length > 0) {
      restaurantesList = restaurantes;
      configurarBuscadorRestaurantes(searchInput, suggestionsContainer, suggestionsList);
    } else {
      searchInput.placeholder = 'No se encontraron restaurantes en la BD.';
      searchInput.disabled = true;
    }

  } catch (err) {
    console.error('Error al cargar restaurantes:', err);
    searchInput.placeholder = 'Error al cargar la lista.';
    searchInput.disabled = true;
  }

  // ---- Cargar datos de la reseña si es modo edición o pre-seleccionado ----
  const urlParams = new URLSearchParams(window.location.search);
  editReviewId = urlParams.get('edit_id');
  const preSelectedRestauranteId = urlParams.get('restaurante_id');

  if (preSelectedRestauranteId && !editReviewId && restaurantesList.length > 0) {
      const rest = restaurantesList.find(r => String(r.id) === preSelectedRestauranteId);
      if (rest) {
          seleccionarRestaurante(rest.id, `${rest.nombre} - ${rest.direccion}`);
      }
  }

  if (editReviewId && currentUserId) {
    await cargarDatosResena();
  }
});

// ---- Lógica del Buscador de Restaurantes ----
function configurarBuscadorRestaurantes(searchInput, suggestionsContainer, suggestionsList) {

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        document.getElementById('restaurante-id').value = '';

        if (query === '') {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        const coincidencias = restaurantesList.filter(r => r.nombre.toLowerCase().includes(query) || (r.direccion && r.direccion.toLowerCase().includes(query)));

        suggestionsList.innerHTML = '';

        if (coincidencias.length === 0) {
            suggestionsList.innerHTML = '<li class="px-4 py-3 text-[var(--color-text-secondary)] text-sm">No se encontraron resultados</li>';
        } else {
            coincidencias.slice(0, 7).forEach(rest => { // Limitar a 7 resultados
                const li = document.createElement('li');
                li.className = 'px-4 py-2 hover:bg-red-50 cursor-pointer text-[var(--color-text-primary)] text-sm transition border-b border-[var(--color-border)] last:border-0';

                const displayText = `${rest.nombre} - ${rest.direccion || 'Dirección no disponible'}`;
                const regex = new RegExp(`(${query})`, "gi");
                li.innerHTML = displayText.replace(regex, "<span class='font-bold text-[#c41200]'>$1</span>");

                li.addEventListener('click', () => {
                    seleccionarRestaurante(rest.id, displayText);
                    suggestionsContainer.classList.add('hidden');
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

function seleccionarRestaurante(id, nombre) {
    const searchInput = document.getElementById('restaurante-search');
    const hiddenInput = document.getElementById('restaurante-id');
    const errorMsg = document.getElementById('restaurante-validation-msg');

    searchInput.value = nombre;
    hiddenInput.value = id;
    if(errorMsg) errorMsg.classList.add('hidden');
}

async function cargarDatosResena() {
    try {
        const { data: resena, error } = await supabaseClient
            .from('resenas')
            .select('*, restaurantes(nombre, direccion)')
            .eq('id', editReviewId)
            .eq('id_usuario', currentUserId)
            .single();

        if (error) throw error;

        if (!resena) {
            alert('No se encontró la reseña o no tienes permisos para editarla.');
            window.location.href = 'perfil.html';
            return;
        }

        const titleEl = document.querySelector('h2.text-2xl');
        if (titleEl) titleEl.textContent = 'Editar Reseña';

        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';

        const restDisplayText = resena.restaurantes ? `${resena.restaurantes.nombre} - ${resena.restaurantes.direccion}` : 'Restaurante';
        seleccionarRestaurante(resena.id_restaurante, restDisplayText);

        document.getElementById('comentario').value = resena.comentario;

        const checkStar = (prefix, value) => {
            if (value === null || value === undefined) return;
            const el = document.getElementById(`${prefix}-${value}`);
            if (el) el.checked = true;
        };

        checkStar('comida', resena.calidad_comida);
        checkStar('aten', resena.atencion);
        checkStar('prec', resena.precio);
        checkStar('amb', resena.ambiente);

    } catch (error) {
        console.error('Error al cargar la reseña para editar:', error);
        alert(`Error al cargar los datos de la reseña: ${error.message}`);
    }
}

// =========================================================================
// 3. GUARDAR LA RESEÑA EN SUPABASE
// =========================================================================
const form = document.getElementById('resena-form');
if(form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentUserId) {
        alert("Debes iniciar sesión para publicar una reseña.");
        return;
      }

      const restauranteId = document.getElementById('restaurante-id').value;
      const errorMsg = document.getElementById('restaurante-validation-msg');

      if (!restauranteId) {
          errorMsg.classList.remove('hidden');
          document.getElementById('restaurante-search').focus();
          return;
      } else {
          errorMsg.classList.add('hidden');
      }

      const submitBtn = document.getElementById('submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = editReviewId ? 'Guardando...' : 'Publicando...';

      const comentario = document.getElementById('comentario').value;
      const comida = parseFloat(document.querySelector('input[name="comida"]:checked')?.value || 0);
      const atencion = parseFloat(document.querySelector('input[name="atencion"]:checked')?.value || 0);
      const precio = parseFloat(document.querySelector('input[name="precio"]:checked')?.value || 0);
      const ambiente = parseFloat(document.querySelector('input[name="ambiente"]:checked')?.value || 0);

      let general = 0;
      if (comida > 0 && atencion > 0 && precio > 0 && ambiente > 0) {
          general = (comida + atencion + precio + ambiente) / 4;
      }

      const resenaData = {
        id_restaurante: restauranteId,
        id_usuario: currentUserId,
        puntuacion_general: general,
        calidad_comida: comida,
        atencion: atencion,
        precio: precio,
        ambiente: ambiente,
        comentario: comentario
      };

      try {
        if (editReviewId) {
            const { error } = await supabaseClient
                .from('resenas')
                .update(resenaData)
                .eq('id', editReviewId)
                .eq('id_usuario', currentUserId);

            if (error) throw error;
            alert("¡Reseña actualizada con éxito!");
            window.location.href = 'perfil.html';
        } else {
            const { error } = await supabaseClient
                .from('resenas')
                .insert([resenaData]);

            if (error) throw error;
            alert("¡Reseña publicada con éxito!");
            form.reset();
            document.getElementById('restaurante-id').value = '';
            window.location.href = 'index.html';
        }

      } catch (err) {
        console.error('Error al guardar la reseña:', err);
        alert(`Hubo un error al guardar tu reseña: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editReviewId ? 'Guardar Cambios' : 'Publicar Reseña';
      }
    });
}
