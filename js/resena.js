// =========================================================================
// 1. CONFIGURACIÓN SUPABASE (Reemplaza con tus llaves reales de Supabase)
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co'; // <--- PON TU URL AQUÍ
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';                  // <--- PON TU KEY AQUÍ

// Inicializamos el cliente de Supabase
// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserId = null; // Variable para almacenar el ID del usuario logueado

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
});

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
  submitBtn.textContent = 'Publicando...';

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

  try {
    // Insertamos la nueva reseña en la tabla 'resenas'
    const { data, error } = await supabaseClient
      .from('resenas')
      .insert([{
        id_restaurante: restauranteId,
        id_usuario: currentUserId,     // AHORA SÍ ENVIAMOS EL ID DEL USUARIO LOGUEADO
        puntuacion_general: general,   // Ahora se guarda con decimales (ej: 4.25)
        calidad_comida: comida,
        atencion: atencion,
        precio: precio,
        ambiente: ambiente, // Agregado el campo ambiente a la base de datos
        comentario: comentario
      }]);

    if (error) throw error;

    alert("¡Reseña publicada con éxito!");
    form.reset();

    // Redirigir al inicio o a su perfil
    window.location.href = 'index.html';

  } catch (err) {
    console.error('Error al guardar la reseña:', err);
    alert("Hubo un error al guardar tu reseña. Revisa la consola para más detalles.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publicar Reseña';
  }
});
