// =========================================================================
// 1. CONFIGURACIÓN SUPABASE (Reemplaza con tus llaves reales de Supabase)
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co'; // <--- PON TU URL AQUÍ
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';                  // <--- PON TU KEY AQUÍ

// Inicializamos el cliente de Supabase
// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserId = null; // Variable para almacenar el ID del usuario logueado
let editReviewId = null; // ID de la reseña a editar (si existe)
let restaurantesList = []; // Para almacenar todos los restaurantes para la búsqueda

// =========================================================================
// 2. CARGAR RESTAURANTES DINÁMICAMENTE DESDE LA BASE DE DATOS
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {

  // ---- Autenticación y control de UI ----
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  if (session && session.user) {
    currentUserId = session.user.id;

    // Buscamos su info
    const { data: perfilData } = await supabaseClient
      .from('perfiles')
      .select('nombre_usuario, modo_oscuro')
      .eq('id', currentUserId)
      .single();

    let userDisplayName = session.user.email;
    if (perfilData && perfilData.nombre_usuario) {
      userDisplayName = perfilData.nombre_usuario;
    }

    // Aplicar el modo oscuro globalmente
    if (perfilData && perfilData.modo_oscuro) {
        document.body.classList.add('dark');
    }

    // Actualizamos nav
    const userStatusDiv = document.getElementById('user-status');
    userStatusDiv.innerHTML = `
            <span class="text-sm text-white font-medium">Hola, ${userDisplayName}</span>
            <button id="logout-btn" class="text-sm bg-red-800 text-white px-3 py-1 rounded font-bold hover:bg-red-900 transition ml-2">Cerrar sesión</button>
        `;

    document.getElementById('logout-btn').addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.reload();
    });
  } else {
    // Si NO hay sesión, bloqueamos el formulario y mostramos advertencia
    document.getElementById('auth-warning').classList.remove('hidden');
    document.getElementById('submit-btn').disabled = true;
    document.getElementById('submit-btn').classList.add('cursor-not-allowed', 'opacity-50');

    // Deshabilitar los inputs (opcional)
    const formElements = document.getElementById('resena-form').elements;
    for (let i = 0; i < formElements.length; i++) {
      formElements[i].disabled = true;
    }
  }


  // ---- Cargar Restaurantes para el buscador ----
  const searchInput = document.getElementById('restaurante-search');
  const suggestionsContainer = document.getElementById('resena-search-suggestions');
  const suggestionsList = document.getElementById('resena-search-suggestions-list');

  if (!supabaseClient) {
    searchInput.placeholder = 'Error al cargar cliente Supabase';
    searchInput.disabled = true;
    return;
  }

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

  // ---- Cargar datos de la reseña si es modo edición ----
  const urlParams = new URLSearchParams(window.location.search);
  editReviewId = urlParams.get('edit_id');

  // Si venimos con un restaurante pre-seleccionado en la URL (ej: desde restaurante.html)
  const preSelectedRestauranteId = urlParams.get('restaurante_id');
  if (preSelectedRestauranteId && !editReviewId && restaurantesList.length > 0) {
      const rest = restaurantesList.find(r => r.id === preSelectedRestauranteId);
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

        // Al escribir, borramos el ID seleccionado anteriormente para obligar a seleccionar uno de la lista
        document.getElementById('restaurante-id').value = '';

        if (query === '') {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        const coincidencias = restaurantesList.filter(r => r.nombre.toLowerCase().includes(query) || r.direccion.toLowerCase().includes(query));

        suggestionsList.innerHTML = '';

        if (coincidencias.length === 0) {
            suggestionsList.innerHTML = '<li class="px-4 py-3 text-[var(--color-text-secondary)] text-sm">No se encontraron resultados</li>';
        } else {
            coincidencias.forEach(rest => {
                const li = document.createElement('li');
                li.className = 'px-4 py-2 hover:bg-red-50 cursor-pointer text-[var(--color-text-primary)] text-sm transition border-b border-[var(--color-border)] last:border-0';

                // Resaltar coincidencia
                const displayText = `${rest.nombre} - ${rest.direccion}`;
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

    // Cerrar sugerencias al hacer clic fuera
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
    errorMsg.classList.add('hidden'); // Ocultar error si había
}

// Función para cargar los datos de una reseña existente en el formulario
async function cargarDatosResena() {
    try {
        const { data: resena, error } = await supabaseClient
            .from('resenas')
            .select('*, restaurantes(nombre, direccion)')
            .eq('id', editReviewId)
            .eq('id_usuario', currentUserId) // Asegurar que sea del usuario actual
            .single();

        if (error) {
            console.error("Supabase Error:", error);
            throw error;
        }

        if (!resena) {
            alert('No se encontró la reseña o no tienes permisos para editarla.');
            window.location.href = 'perfil.html';
            return;
        }

        // Cambiar título y botón
        const titleEl = document.querySelector('h2.text-2xl');
        if (titleEl) titleEl.textContent = 'Editar Reseña';

        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';

        // Llenar el formulario
        const restDisplayText = resena.restaurantes ? `${resena.restaurantes.nombre} - ${resena.restaurantes.direccion}` : 'Restaurante';
        seleccionarRestaurante(resena.id_restaurante, restDisplayText);

        // En modo edición, podríamos deshabilitar cambiar de restaurante si queremos
        // document.getElementById('restaurante-search').disabled = true;
        // document.getElementById('restaurante-search').classList.add('bg-gray-100');

        document.getElementById('comentario').value = resena.comentario;

        // Función segura para marcar estrellas
        const checkStar = (prefix, value) => {
            if (value === null || value === undefined) return;
            const parsedValue = Number(value); // convierte "4.0" a 4 para que coincida con el ID
            const el = document.getElementById(`${prefix}-${parsedValue}`);
            if (el) el.checked = true;
        };

        checkStar('comida', resena.calidad_comida);
        checkStar('aten', resena.atencion);
        checkStar('prec', resena.precio);
        checkStar('amb', resena.ambiente);

    } catch (error) {
        console.error('Error al cargar la reseña para editar:', error);
        alert(`Error al cargar los datos de la reseña: ${error.message || JSON.stringify(error)}`);
    }
}


// =========================================================================
// 3. GUARDAR LA RESEÑA EN SUPABASE
// =========================================================================
const form = document.getElementById('resena-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUserId) {
    alert("Debes iniciar sesión para publicar una reseña.");
    return;
  }

  const restauranteId = document.getElementById('restaurante-id').value;
  const errorMsg = document.getElementById('restaurante-validation-msg');

  // Validación personalizada para el buscador de restaurantes
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

  // Obtener valores de las estrellas (ahora como floats)
  const comida = parseFloat(document.querySelector('input[name="comida"]:checked')?.value || 0);
  const atencion = parseFloat(document.querySelector('input[name="atencion"]:checked')?.value || 0);
  const precio = parseFloat(document.querySelector('input[name="precio"]:checked')?.value || 0);
  const ambiente = parseFloat(document.querySelector('input[name="ambiente"]:checked')?.value || 0);

  // Calcular el promedio general con decimales
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
        // Actualizar reseña existente
        const { error } = await supabaseClient
            .from('resenas')
            .update(resenaData)
            .eq('id', editReviewId)
            .eq('id_usuario', currentUserId); // Doble validación de seguridad

        if (error) throw error;
        alert("¡Reseña actualizada con éxito!");
        window.location.href = 'perfil.html'; // Volver al perfil
    } else {
        // Insertar nueva reseña
        const { error } = await supabaseClient
            .from('resenas')
            .insert([resenaData]);

        if (error) throw error;
        alert("¡Reseña publicada con éxito!");
        form.reset();
        document.getElementById('restaurante-id').value = ''; // Limpiar campo oculto
        window.location.href = 'index.html';
    }

  } catch (err) {
    console.error('Error al guardar la reseña:', err);
    alert(`Hubo un error al guardar tu reseña: ${err.message || JSON.stringify(err)}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editReviewId ? 'Guardar Cambios' : 'Publicar Reseña';
  }
});
