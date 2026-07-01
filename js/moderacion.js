// supabaseClient, currentUserId, and currentUserProfile are global, from app.js

let selectedUserToEdit = null;

document.addEventListener('navAuthReady', () => {
    if (!currentUserProfile || (currentUserProfile.rol !== 'admin' && currentUserProfile.rol !== 'moderador')) {
        document.querySelector('main').innerHTML = `<div class="text-center py-20"><i class="fas fa-exclamation-triangle text-5xl text-red-500 mb-4"></i><h2 class="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2><p class="text-gray-500">No tienes los permisos necesarios para ver esta página.</p></div>`;
        return;
    }

    // Si es admin, mostrar la sección de gestión de roles
    if (currentUserProfile.rol === 'admin') {
        const adminSection = document.getElementById('admin-section');
        if(adminSection) adminSection.classList.remove('hidden');
        setupRoleManagement();
    }

    loadReports('pendiente');

    document.getElementById('filter-reports').addEventListener('change', (e) => {
        loadReports(e.target.value);
    });
});

async function loadReports(status) {
    const container = document.getElementById('reports-container');
    container.innerHTML = `<p class="text-center text-[var(--color-text-secondary)] py-8">Cargando denuncias con estado '${status}'...</p>`;

    try {
        const { data: reports, error } = await supabaseClient
            .from('denuncias')
            .select(`
                id, created_at, motivo, estado, resena_id,
                denunciante:perfiles!denuncias_denunciante_id_fkey ( id, nombre_usuario ),
                denunciado:perfiles!denuncias_denunciado_id_fkey ( id, nombre_usuario ),
                resenas ( id, comentario, puntuacion_general )
            `)
            .eq('estado', status)
            .order('created_at', { ascending: true });

        if (error) throw error;

        container.innerHTML = '';

        if (reports.length === 0) {
            container.innerHTML = `<p class="text-center text-[var(--color-text-secondary)] py-8">No hay denuncias con el estado '${status}'.</p>`;
            return;
        }

        reports.forEach(report => {
            const reportEl = document.createElement('div');
            reportEl.className = 'bg-[var(--color-surface-secondary)] p-4 rounded-lg shadow';
            reportEl.setAttribute('data-report-id', report.id);

            const denunciante = report.denunciante;
            const denunciado = report.denunciado;
            const resena = report.resenas;

            let buttonsHTML = '';
            if (report.estado === 'pendiente') {
                buttonsHTML = `
                <div class="mt-4 flex flex-wrap gap-2">
                    <button data-action="delete_review" class="bg-red-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-red-700 transition">Eliminar Reseña</button>
                    <button data-action="suspend_user" class="bg-black text-white px-3 py-1 rounded text-sm font-semibold hover:bg-gray-800 transition">Suspender Usuario</button>
                    <button data-action="dismiss" class="bg-gray-500 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-gray-600 transition">Desestimar Denuncia</button>
                </div>
                `;
            }

            reportEl.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-lg">Denuncia #${report.id}</h3>
                        <p class="text-xs text-[var(--color-text-secondary)]">Recibida el: ${new Date(report.created_at).toLocaleString()}</p>
                    </div>
                    <span class="text-sm font-semibold px-3 py-1 rounded-full ${getStatusColor(report.estado)}">${report.estado}</span>
                </div>
                <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p><strong>Denunciante:</strong> <a href="perfil.html?id=${denunciante.id}" class="text-[#c41200] hover:underline">${denunciante.nombre_usuario}</a></p>
                        <p><strong>Denunciado:</strong> <a href="perfil.html?id=${denunciado.id}" class="text-[#c41200] hover:underline">${denunciado.nombre_usuario}</a></p>
                    </div>
                    <div>
                        <p><strong>Motivo de la denuncia:</strong></p>
                        <p class="italic">"${report.motivo}"</p>
                    </div>
                </div>
                <div class="mt-4 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
                    <p class="font-semibold">Contenido de la reseña denunciada:</p>
                    <p class="text-sm mt-1"><em>"${resena ? resena.comentario : 'Reseña no disponible (puede haber sido eliminada)'}"</em></p>
                    ${resena ? `<p class="text-xs text-right font-bold text-yellow-500 mt-1">${resena.puntuacion_general} ★</p>` : ''}
                </div>
                ${buttonsHTML}
            `;
            container.appendChild(reportEl);

            // **AÑADIR EVENT LISTENERS DINÁMICAMENTE**
            reportEl.querySelectorAll('button[data-action]').forEach(button => {
                button.addEventListener('click', () => {
                    const action = button.dataset.action;
                    takeAction(action, report);
                });
            });
        });

    } catch (error) {
        console.error('Error cargando denuncias:', error);
        container.innerHTML = `<p class="text-center text-red-500 py-8">Error al cargar las denuncias.</p>`;
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

async function takeAction(action, report) {
    let confirmationMessage = '';
    switch (action) {
        case 'delete_review':
            confirmationMessage = '¿Estás seguro de que quieres ELIMINAR la reseña? Esta acción no se puede deshacer.';
            break;
        case 'dismiss':
            confirmationMessage = '¿Estás seguro de que quieres DESESTIMAR esta denuncia?';
            break;
        default:
            alert(`La acción '${action}' aún no está implementada.`);
            return;
    }

    if (!confirm(confirmationMessage)) {
        return;
    }

    try {
        const newStatus = (action === 'dismiss') ? 'desestimada' : 'resuelta';

        if (action === 'delete_review') {
            const resenaId = report.resena_id;
            if (!resenaId) {
                throw new Error('La reseña ya ha sido eliminada o no se pudo encontrar su ID.');
            }

            console.log(`Iniciando borrado para reseña ID: ${resenaId}`);

            // Paso 1: Borrar votos
            const { error: voteError } = await supabaseClient.from('resenas_votos').delete().eq('resena_id', resenaId);
            if (voteError) {
                console.error("Error en Paso 1 (borrar votos):", voteError);
                throw new Error(`Fallo al borrar votos: ${voteError.message}. Revisa los permisos (RLS) en la tabla 'resenas_votos'.`);
            }
            console.log("Paso 1 completado: Votos eliminados.");

            // Paso 2: Borrar la reseña
            const { data: reviewData, error: reviewError } = await supabaseClient.from('resenas').delete().eq('id', resenaId).select(); // .select() para obtener info de lo borrado
            if (reviewError) {
                console.error("Error en Paso 2 (borrar reseña):", reviewError);
                throw new Error(`Fallo al borrar la reseña: ${reviewError.message}. Revisa los permisos (RLS) en la tabla 'resenas'.`);
            }

            // **Verificación crucial**
            if (reviewData.length === 0) {
                 console.error("Error silencioso: La operación de borrado de reseña no devolvió ningún error, pero no se borró ninguna fila. Esto casi siempre es un problema de RLS.");
                 throw new Error("No se pudo eliminar la reseña. La política de seguridad (RLS) de la tabla 'resenas' podría estar impidiéndolo.");
            }

            console.log("Paso 2 completado: Reseña eliminada.", reviewData);
        }

        // Paso 3: Actualizar la denuncia
        const { error: updateError } = await supabaseClient.from('denuncias').update({ estado: newStatus }).eq('id', report.id);
        if (updateError) throw updateError;

        alert(`La acción se ha procesado y la denuncia ha sido marcada como '${newStatus}'.`);
        document.querySelector(`[data-report-id='${report.id}']`)?.remove();

    } catch (error) {
        console.error(`Error al procesar la acción '${action}':`, error);
        alert(`Hubo un error en el proceso: ${error.message}`);
    }
}

// =========================================================================
// GESTIÓN DE ROLES (SOLO ADMINS)
// =========================================================================
function setupRoleManagement() {
    const searchInput = document.getElementById('user-search-input');
    const resultsContainer = document.getElementById('user-search-results');
    const editor = document.getElementById('user-role-editor');
    const saveButton = document.getElementById('save-role-button');

    let searchTimeout;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();

        if (query.length < 1) {
            resultsContainer.innerHTML = '';
            editor.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('perfiles')
                    .select('id, nombre_usuario, rol')
                    .ilike('nombre_usuario', `%${query}%`)
                    .neq('rol', 'admin')
                    .limit(5);

                if (error) throw error;

                resultsContainer.innerHTML = '';
                if (data.length === 0) {
                    resultsContainer.innerHTML = '<p class="text-sm text-[var(--color-text-secondary)] p-2">No se encontraron usuarios.</p>';
                } else {
                    data.forEach(user => {
                        const userEl = document.createElement('div');
                        userEl.className = 'p-2 hover:bg-[var(--color-surface-secondary)] cursor-pointer rounded';
                        userEl.innerHTML = `
                            <p class="font-semibold">${user.nombre_usuario}</p>
                            <p class="text-xs text-[var(--color-text-secondary)]">Rol: ${user.rol}</p>
                        `;
                        userEl.addEventListener('click', () => selectUserForEditing(user));
                        resultsContainer.appendChild(userEl);
                    });
                }
            } catch (err) {
                console.error("Error al buscar usuarios:", err);
                resultsContainer.innerHTML = `<p class="text-sm text-red-500 p-2">Error: ${err.message}</p>`;
            }
        }, 300);
    });

    saveButton.addEventListener('click', async () => {
        if (!selectedUserToEdit) return;

        const newRole = document.getElementById('role-select').value;
        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';

        try {
            // Usamos .select() para que la query devuelva los datos actualizados
            const { data, error } = await supabaseClient
                .from('perfiles')
                .update({ rol: newRole })
                .eq('id', selectedUserToEdit.id)
                .select(); // ¡Importante!

            if (error) throw error;

            // Verificación crucial: si la data está vacía, la RLS lo bloqueó
            if (!data || data.length === 0) {
                throw new Error("La operación no devolvió datos. Esto usualmente significa que la Política de Seguridad a Nivel de Fila (RLS) en la tabla 'perfiles' impidió la actualización. Asegúrate de que el admin tiene permisos para modificar roles.");
            }

            alert(`El rol de ${selectedUserToEdit.nombre_usuario} ha sido actualizado a '${newRole}'.`);
            editor.classList.add('hidden');
            searchInput.value = '';
            resultsContainer.innerHTML = '';
            selectedUserToEdit = null;

        } catch (err) {
            alert(`Error al actualizar el rol: ${err.message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Guardar Rol';
        }
    });
}

function selectUserForEditing(user) {
    selectedUserToEdit = user;
    const editor = document.getElementById('user-role-editor');
    document.getElementById('editing-user-name').textContent = user.nombre_usuario;
    document.getElementById('editing-user-email').textContent = `ID: ${user.id}`;
    document.getElementById('role-select').value = user.rol;
    editor.classList.remove('hidden');
    document.getElementById('user-search-results').innerHTML = '';
    document.getElementById('user-search-input').value = user.nombre_usuario;
}
