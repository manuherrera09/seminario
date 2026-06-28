// supabaseClient es global, proporcionado por app.js

// =========================================================================
// 2. LÓGICA DE REGISTRO
// =========================================================================
const registerForm = document.getElementById('register-form');
const messageDiv = document.getElementById('message-container');
const submitBtn = document.getElementById('submit-btn');

function showMessage(msg, isError = false) {
    messageDiv.textContent = msg;
    messageDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');

    if (isError) {
        messageDiv.classList.add('bg-red-100', 'text-red-700');
    } else {
        messageDiv.classList.add('bg-green-100', 'text-green-700');
    }
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Limpiar errores previos y deshabilitar el botón
        messageDiv.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registrando...';

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // 1. Crear usuario en Supabase Auth
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
            });

            if (authError) throw authError;

            const userId = authData.user?.id;
            if (!userId) {
                throw new Error("No se pudo obtener el ID del usuario creado.");
            }

            // 2. Guardar datos extra en la tabla 'perfiles'
            const { error: profileError } = await supabaseClient
                .from('perfiles')
                .insert([{ id: userId, nombre_usuario: username, email: email }]);

            if (profileError) {
                console.error("Error al crear el perfil:", profileError);
            }

            showMessage("¡Registro exitoso! Redirigiendo...", false);

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);

        } catch (error) {
            console.error('Error de registro:', error.message);
            let errorMsg = 'Hubo un error al registrar tu cuenta. Intenta nuevamente.';

            if (error.message.includes('already registered')) {
                errorMsg = 'Este correo ya se encuentra registrado.';
            } else if (error.message.includes('Password should be at least')) {
                errorMsg = 'La contraseña es demasiado corta.';
            }

            showMessage(errorMsg, true);

            submitBtn.disabled = false;
            submitBtn.textContent = 'Registrarse';
        }
    });
}
