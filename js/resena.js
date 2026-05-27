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
      .select('nombre_usuario')
      .eq('id', currentUserId)
      .single();

    let userDisplayName = session.user.email;
    if (perfilData && perfilData.nombre_usuario) {
      userDisplayName = perfilData.nombre_usuario;
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


  // ---- Cargar Restaurantes ----
  const selectRestaurante = document.getElementById('restaurante');

  if (!supabaseClient) {
    selectRestaurante.innerHTML = '<option value="">Error al cargar cliente Supabase</option>';
    return;
  }

  try {
    const { data: restaurantes, error } = await supabaseClient
      .from('restaurantes')
      .select('id, nombre')
      .order('nombre', { ascending: true });

    if (error) throw error;

    selectRestaurante.innerHTML = '<option value="">Selecciona un restaurante...</option>';

    if (restaurantes && restaurantes.length > 0) {
      restaurantes.forEach(rest => {
        const option = document.createElement('option');
        option.value = rest.id;
        option.textContent = rest.nombre;
        selectRestaurante.appendChild(option);
      });
    } else {
      selectRestaurante.innerHTML = '<option value="">No se encontraron restaurantes en la BD.</option>';
    }

  } catch (err) {
    console.error('Error al cargar restaurantes:', err);
    selectRestaurante.innerHTML = '<option value="">Error al cargar la lista.</option>';
  }

  // ---- Cargar datos de la reseña si es modo edición ----
  const urlParams = new URLSearchParams(window.location.search);
  editReviewId = urlParams.get('edit_id');

  if (editReviewId && currentUserId) {
    await cargarDatosResena();
  }
});

// Función para cargar los datos de una reseña existente en el formulario
async function cargarDatosResena() {
    try {
        const { data: resena, error } = await supabaseClient
            .from('resenas')
            .select('*')
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
        document.getElementById('restaurante').value = resena.id_restaurante;
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

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = editReviewId ? 'Guardando...' : 'Publicando...';

  const restauranteId = document.getElementById('restaurante').value;
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
