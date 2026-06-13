// ============================================================
// AUTENTICACIÓN
// ============================================================

let currentUser = null;
let currentPerfil = null;

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('btn-login');
  const errEl = document.getElementById('login-error');

  if (!email || !pass) {
    showLoginError('Completá usuario y contraseña.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Ingresando...';
  errEl.style.display = 'none';

  const { data, error } = await db.auth.signInWithPassword({ email, password: pass });

  if (error) {
    showLoginError('Credenciales incorrectas. Verificá tu usuario y contraseña.');
    btn.disabled = false;
    btn.textContent = 'Ingresar';
    return;
  }

  currentUser = data.user;
  await cargarPerfil();
  iniciarApp();
}

async function cargarPerfil() {
  const { data, error } = await db
    .from('perfiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (error || !data || !data.activo) {
    await db.auth.signOut();
    showLoginError('Tu cuenta está desactivada. Contactá al administrador.');
    return;
  }

  currentPerfil = data;
}

async function logout() {
  await db.auth.signOut();
  currentUser = null;
  currentPerfil = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
}

function isAdmin() {
  return currentPerfil && currentPerfil.rol === 'admin';
}

function isReadonly() {
  return currentPerfil && currentPerfil.rol === 'readonly';
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function togglePass() {
  const inp = document.getElementById('login-pass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// Verificar sesión al cargar la página
async function checkSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await cargarPerfil();
    if (currentPerfil) {
      iniciarApp();
      return;
    }
  }
  document.getElementById('login-screen').style.display = 'flex';
}

// Escuchar cambios de sesión
db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
});
