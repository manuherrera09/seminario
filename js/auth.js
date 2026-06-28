// supabaseClient es global, proporcionado por app.js

// =========================================================================
// 2. LÓGICA DE INICIO DE SESIÓN
// =========================================================================
const loginForm = document.getElementById('login-form');
const errorDiv = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-btn');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Limpiar errores previos y deshabilitar el botón
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesión...';

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        // Intentar iniciar sesión en Supabase
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          throw error;
        }

        // Si es exitoso, redigir al index
        window.location.href = 'index.html';

      } catch (error) {
        // Mostrar el error si las credenciales son incorrectas
        console.error('Error de login:', error.message);
        errorDiv.textContent = 'Correo o contraseña incorrectos. Por favor, intenta nuevamente.';
        errorDiv.classList.remove('hidden');

        // Restaurar el botón
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar Sesión';
      }
    });
}
