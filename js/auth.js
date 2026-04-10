// =========================================================================
// 1. CONFIGURACIÓN SUPABASE
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';

// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================================================
// 2. LÓGICA DE INICIO DE SESIÓN
// =========================================================================
const loginForm = document.getElementById('login-form');
const errorDiv = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-btn');

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
    // Supabase guarda automáticamente la sesión en localStorage
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
