// ============================================================
// ACCESO A BASE DE DATOS
// ============================================================

// ---- CONFIGURACIÓN ----
async function getConfig() {
  const { data } = await db.from('configuracion').select('*');
  const cfg = {};
  if (data) data.forEach(r => cfg[r.clave] = r.valor);
  return cfg;
}

async function saveConfig(clave, valor) {
  await db.from('configuracion')
    .update({ valor: String(valor), updated_at: new Date().toISOString() })
    .eq('clave', clave);
}

// ---- EMPLEADOS ----
async function getEmpleados(soloActivos = true) {
  let q = db.from('empleados').select('*').order('nombre');
  if (soloActivos) q = q.eq('activo', true);
  const { data } = await q;
  return data || [];
}

async function upsertEmpleado(emp) {
  if (emp.id) {
    const { error } = await db.from('empleados')
      .update({ ...emp, updated_at: new Date().toISOString() })
      .eq('id', emp.id);
    return error;
  } else {
    const { error } = await db.from('empleados').insert(emp);
    return error;
  }
}

async function toggleEmpleadoActivo(id, activo) {
  await db.from('empleados').update({ activo, updated_at: new Date().toISOString() }).eq('id', id);
}

// ---- SEMANAS ----
async function getSemanas() {
  const { data } = await db.from('semanas').select('*').order('fecha_inicio', { ascending: false });
  return data || [];
}

async function crearSemana(semana) {
  const { data, error } = await db.from('semanas')
    .insert({ ...semana, created_by: currentUser.id })
    .select().single();
  return { data, error };
}

async function cerrarSemana(id) {
  await db.from('semanas').update({ cerrada: true }).eq('id', id);
}

// ---- MARCACIONES ----
async function getMarcacionesSemana(semanaId) {
  const { data } = await db.from('marcaciones')
    .select('*, empleados(nombre,tipo,salario_mensual)')
    .eq('semana_id', semanaId)
    .order('fecha');
  return data || [];
}

async function upsertMarcaciones(marcaciones) {
  const { error } = await db.from('marcaciones').upsert(marcaciones, { onConflict: 'semana_id,empleado_id,fecha' });
  return error;
}

async function deleteMarcacionesSemana(semanaId) {
  await db.from('marcaciones').delete().eq('semana_id', semanaId);
}

// ---- FERIADOS ----
async function getFeriados() {
  const { data } = await db.from('feriados').select('*').order('fecha');
  return data || [];
}

async function upsertFeriado(fer) {
  if (fer.id) {
    const { error } = await db.from('feriados').update(fer).eq('id', fer.id);
    return error;
  } else {
    const { error } = await db.from('feriados').insert(fer);
    return error;
  }
}

async function deleteFeriado(id) {
  await db.from('feriados').delete().eq('id', id);
}

async function toggleFeriadoTrabajado(id, trabajado) {
  await db.from('feriados').update({ se_trabajo: trabajado }).eq('id', id);
}

// ---- LIQUIDACIONES ----
async function getLiquidacionSemana(semanaId) {
  const { data } = await db.from('liquidaciones')
    .select('*, empleados(nombre,tipo)')
    .eq('semana_id', semanaId)
    .order('empleados(nombre)');
  return data || [];
}

async function upsertLiquidacion(liq) {
  const { error } = await db.from('liquidaciones')
    .upsert(liq, { onConflict: 'semana_id,empleado_id' });
  return error;
}

async function deleteLiquidacionSemana(semanaId) {
  await db.from('liquidaciones').delete().eq('semana_id', semanaId);
}

// ---- USUARIOS (solo admin) ----
async function getUsuarios() {
  const { data } = await db.from('perfiles').select('*').order('nombre');
  return data || [];
}

async function toggleUsuarioActivo(id, activo) {
  await db.from('perfiles').update({ activo }).eq('id', id);
}

async function cambiarRol(id, rol) {
  await db.from('perfiles').update({ rol }).eq('id', id);
}

// Crear usuario via Supabase Auth Admin (requiere service_role — solo funciona en backend)
// Para crear usuarios desde el frontend usamos el flujo de invitación
async function invitarUsuario(email, nombre, rol) {
  // Supabase signUp crea el usuario; el trigger handle_new_user crea el perfil
  const { data, error } = await db.auth.signUp({
    email,
    password: generarPasswordTemporal(),
    options: {
      data: { nombre, rol },
      emailRedirectTo: window.location.origin
    }
  });
  return { data, error };
}

function generarPasswordTemporal() {
  // Contraseña temporal aleatoria — el usuario la cambia al recibir el email
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  for (let i = 0; i < 16; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}
