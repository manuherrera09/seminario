// supabaseClient, currentUserId, and currentUserProfile are global, from app.js

document.addEventListener('navAuthReady', () => {
    // Asegurarse de que hay un usuario logueado
    if (!currentUserId) {
        document.querySelector('main').innerHTML = `
            <div class="text-center py-20">
                <i class="fas fa-exclamation-triangle text-5xl text-red-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
                <p class="text-gray-500">Debes iniciar sesión para ver esta página.</p>
            </div>`;
        return;
    }

    loadMyReports();
});

async function loadMyReports() {
    const container = document.getElementById('my-reports-container');
    const loadingMsg = document.getElementById('reports-loading');
    container.innerHTML = '';
    loadingMsg.classList.remove('hidden');

    try {
        const { data: reports, error } = await supabaseClient
            .from('denuncias')
            .select(`
                id,
                created_at,
                motivo,
                estado,
                resenas ( id, comentario )
            `)
            .eq('denunciante_id', currentUserId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        loadingMsg.classList.add('hidden');

        if (reports.length === 0) {
            container.innerHTML = `<p class="text-center text-[var(--color-text-secondary)] py-8">No has realizado ninguna denuncia.</p>`;
            return;
        }

        reports.forEach(report => {
            const reportEl = document.createElement('div');
            reportEl.className = 'bg-[var(--color-surface-secondary)] p-4 rounded-lg shadow';

            const statusColor = getStatusColor(report.estado);

            reportEl.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold">Denuncia sobre reseña #${report.resenas.id}</h3>
                        <p class="text-xs text-[var(--color-text-secondary)]">Realizada el: ${new Date(report.created_at).toLocaleString()}</p>
                    </div>
                    <span class="text-sm font-semibold px-3 py-1 rounded-full ${statusColor}">${report.estado}</span>
                </div>

                <div class="mt-3">
                    <p><strong>Tu motivo:</strong> <em class="italic">"${report.motivo}"</em></p>
                </div>

                <div class="mt-2 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] text-sm">
                    <p class="font-semibold">Contenido de la reseña denunciada:</p>
                    <p class="text-sm mt-1"><em>"${report.resenas.comentario}"</em></p>
                </div>
            `;
            container.appendChild(reportEl);
        });

    } catch (error) {
        console.error('Error cargando mis denuncias:', error);
        loadingMsg.textContent = 'Error al cargar tus denuncias.';
    }
}

function getStatusColor(status) {
    switch (status) {
        case 'pendiente': return 'bg-yellow-100 text-yellow-800';
        case 'resuelta': return 'bg-green-100 text-green-800';
        case 'desestimada': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-200';
    }
}
