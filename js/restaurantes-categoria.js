// Este archivo contendrá la lógica para la página de restaurantes por categoría.
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoria = urlParams.get('categoria');

    const titleElement = document.getElementById('category-title');
    const gridElement = document.getElementById('restaurants-grid');

    if (!categoria) {
        if (titleElement) titleElement.textContent = 'Categoría no especificada';
        if (gridElement) gridElement.innerHTML = '<p class="text-center text-[var(--color-text-secondary)]">Por favor, selecciona una categoría para ver los restaurantes.</p>';
        return;
    }

    if (titleElement) {
        titleElement.textContent = `Restaurantes de la categoría: ${categoria}`;
    }

    cargarRestaurantesPorCategoria(categoria, gridElement);
});

async function cargarRestaurantesPorCategoria(categoria, gridElement) {
    if (!gridElement) return;

    gridElement.innerHTML = '<p class="text-center text-[var(--color-text-secondary)]">Cargando restaurantes...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('restaurantes')
            .select('*, resenas(puntuacion_general)')
            .eq('categoria', categoria);

        if (error) throw error;

        if (data.length === 0) {
            gridElement.innerHTML = '<p class="text-center text-[var(--color-text-secondary)]">No se encontraron restaurantes en esta categoría.</p>';
            return;
        }

        gridElement.innerHTML = ''; // Limpiar el mensaje de "cargando"

        data.forEach(restaurante => {
            const card = document.createElement('div');
            card.className = "bg-[var(--color-surface)] rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition transform hover:-translate-y-1";
            card.onclick = () => { window.location.href = `restaurante.html?id=${restaurante.id}` };

            const imgHtml = restaurante.imagen_url
                ? `<img src="${restaurante.imagen_url}" alt="${restaurante.nombre}" class="w-full h-48 object-cover">`
                : `<div class="w-full h-48 bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-secondary)]"><i class="fas fa-utensils text-5xl"></i></div>`;

            let avgRating = 0;
            if (restaurante.resenas && restaurante.resenas.length > 0) {
                const sum = restaurante.resenas.reduce((acc, curr) => acc + curr.puntuacion_general, 0);
                avgRating = (sum / restaurante.resenas.length).toFixed(1);
            }

            card.innerHTML = `
                ${imgHtml}
                <div class="p-4">
                    <h3 class="font-bold text-xl text-[var(--color-text-primary)] truncate" title="${restaurante.nombre}">${restaurante.nombre}</h3>
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-sm text-[var(--color-text-secondary)]">${restaurante.categoria}</p>
                        ${avgRating > 0 ? `<span class="font-bold text-yellow-500 flex items-center gap-1">${avgRating} <i class="fas fa-star"></i></span>` : ''}
                    </div>
                </div>
            `;
            gridElement.appendChild(card);
        });

    } catch (err) {
        console.error('Error cargando restaurantes por categoría:', err);
        gridElement.innerHTML = '<p class="text-center text-red-500">Error al cargar los restaurantes.</p>';
    }
}
