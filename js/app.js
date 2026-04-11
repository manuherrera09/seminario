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
  if (slides.length > 0) {
    setInterval(nextSlide, 5000);
  }

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

  // ---- Cargar lista de restaurantes para la búsqueda ----
  cargarRestaurantesParaBusqueda();

  // ---- Cargar reseñas recientes si estamos en el index ----
  if (document.getElementById('recent-reviews-container')) {
    cargarResenasRecientes();
  }
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

if (searchInput) {
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

        // Redirigir a la página de detalles del restaurante, pasando el ID en la URL
        window.location.href = `restaurante.html?id=${rest.id}`;
      });

      suggestionsList.appendChild(li);
    });
  }

  suggestionsContainer.classList.remove('hidden');
}

// =========================================================================
// 4. LÓGICA DE RESEÑAS RECIENTES (Index)
// =========================================================================
async function cargarResenasRecientes() {
  const container = document.getElementById('recent-reviews-container');
  if (!container) return;

  try {
    const { data, error } = await supabaseClient
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

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">No hay reseñas recientes aún.</p>';
      return;
    }

    data.forEach(resena => {
      const restauranteNombre = resena.restaurantes ? resena.restaurantes.nombre : 'Restaurante Desconocido';
      const usuarioNombre = resena.perfiles && resena.perfiles.nombre_usuario ? resena.perfiles.nombre_usuario : 'Usuario Anónimo';

      const ratingTotal = resena.puntuacion_general ? Number(resena.puntuacion_general).toFixed(1) : 'N/A';

      const comidaRating = resena.calidad_comida ? resena.calidad_comida + ' ★' : 'N/A';
      const atencionRating = resena.atencion ? resena.atencion + ' ★' : 'N/A';
      const precioRating = resena.precio ? resena.precio + ' ★' : 'N/A';

      const resenaHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition flex flex-col h-full" onclick="window.location.href='restaurante.html?id=${resena.id_restaurante}'">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="font-bold text-lg text-gray-800">${restauranteNombre}</h3>
              <p class="text-sm text-gray-500">Por ${usuarioNombre}</p>
            </div>
            <span class="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">${ratingTotal} ★</span>
          </div>
          <p class="text-gray-700 mb-4 line-clamp-3 flex-grow">${resena.comentario || 'Sin comentario'}</p>
          <div class="text-sm text-gray-500 grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-gray-100">
             <span>Comida: ${comidaRating}</span>
             <span>Atención: ${atencionRating}</span>
             <span>Precio: ${precioRating}</span>
          </div>
        </div>
      `;
      container.innerHTML += resenaHTML;
    });

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
