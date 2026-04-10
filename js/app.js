// =========================================================================
// 1. CONFIGURACIÓN SUPABASE (Reemplaza con tus llaves reales de Supabase)
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';

// Inicializamos el cliente de Supabase
// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let restaurantesCacheados = [];

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
  setInterval(nextSlide, 5000);

  // ---- Autenticación ----
  // Verificamos si hay una sesión activa
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (session && session.user) {
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

  // ---- Cargar lista de restaurantes para la búsqueda ----
  cargarRestaurantesParaBusqueda();
});

// =========================================================================
// 3. LÓGICA DE BARRA DE BÚSQUEDA
// =========================================================================
async function cargarRestaurantesParaBusqueda() {
  try {
    const { data, error } = await supabaseClient
      .from('restaurantes')
      .select('id, nombre');

    if (error) throw error;

    if (data) {
      restaurantesCacheados = data;
    }
  } catch (err) {
    console.error("Error al cargar restaurantes para búsqueda:", err);
  }
}

const searchInput = document.getElementById('search-input');
const suggestionsContainer = document.getElementById('search-suggestions');
const suggestionsList = document.getElementById('suggestions-list');

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();

  // Si está vacío, ocultamos la lista
  if (query === '') {
    suggestionsContainer.classList.add('hidden');
    return;
  }

  // Filtramos la lista de restaurantes en memoria
  const coincidencias = restaurantesCacheados.filter(rest =>
    rest.nombre.toLowerCase().includes(query)
  );

  mostrarSugerencias(coincidencias, query);
});

// Ocultar sugerencias si hace click afuera
document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
    suggestionsContainer.classList.add('hidden');
  }
});

function mostrarSugerencias(resultados, query) {
  suggestionsList.innerHTML = ''; // Limpiar anteriores

  if (resultados.length === 0) {
    const li = document.createElement('li');
    li.className = 'px-4 py-3 text-gray-500 text-sm text-center';
    li.textContent = 'No se encontraron restaurantes';
    suggestionsList.appendChild(li);
  } else {
    // Mostrar hasta 7 resultados para no saturar
    const topResultados = resultados.slice(0, 7);

    topResultados.forEach(rest => {
      const li = document.createElement('li');
      li.className = 'px-4 py-3 hover:bg-red-50 cursor-pointer border-b border-gray-100 transition last:border-b-0 text-gray-800 flex items-center';

      // Resaltar la coincidencia
      const regex = new RegExp(`(${query})`, "gi");
      const nombreResaltado = rest.nombre.replace(regex, "<span class='font-bold text-[#c41200]'>$1</span>");

      li.innerHTML = `<i class="fas fa-utensils text-gray-400 mr-3"></i> ${nombreResaltado}`;

      // Acción al hacer clic en un restaurante
      li.addEventListener('click', () => {
        searchInput.value = rest.nombre;
        suggestionsContainer.classList.add('hidden');

        // Para el MVP: Al darle clic a un restaurante lo mandamos a dejar reseña de ese lugar
        // Opcionalmente podrías pasarlo por URL: window.location.href = `resena.html?rest_id=${rest.id}`;
        // De momento solo redirigimos a la página de reseña.
        window.location.href = 'resena.html';
      });

      suggestionsList.appendChild(li);
    });
  }

  suggestionsContainer.classList.remove('hidden');
}
