// =========================================================================
// 1. CONFIGURACIÓN SUPABASE
// =========================================================================
const SUPABASE_URL = 'https://xnndkqcuuejtznxhdiue.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmRrcWN1dWVqdHpueGhkaXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTg2MjMsImV4cCI6MjA5MTI3NDYyM30.OrM0AqS0Q4KLmhYa8R9-wyMdDz7tlxU8h5ceacW37f8';

// @ts-ignore
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Dependiendo de tu config de Supabase, podría requerir confirmación de email
const userId = authData.user?.id;

if (!userId) {
throw new Error("No se pudo obtener el ID del usuario creado.");
}

// 2. Guardar datos extra en la tabla 'perfiles'
const { error: profileError } = await supabaseClient
.from('perfiles')
.insert([
{
id: userId,
nombre_usuario: username
}
]);

if (profileError) {
console.error("Error al crear el perfil:", profileError);
// Opcional: mostrar un mensaje advirtiendo que el usuario se creó pero el perfil falló
}

showMessage("¡Registro exitoso! Redirigiendo...", false);

// Redirigimos al inicio después de un segundo
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

// Restaurar el botón
submitBtn.disabled = false;
submitBtn.textContent = 'Registrarse';
}
});
