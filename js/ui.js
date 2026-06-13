// ============================================================
// INTERFAZ DE USUARIO
// ============================================================

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelector(`[onclick="showPage('${id}')"]`).classList.add('active');
  document.getElementById('page-title').textContent = {
    semanas:'Semanas',empleados:'Empleados',feriados:'Feriados',
    liquidacion:'Liquidación semanal',detalle:'Detalle de extras',
    ips:'IPS / Aportes',configuracion:'Configuración',usuarios:'Usuarios'
  }[id] || id;
  if (window.innerWidth < 768) closeSidebar();
}

function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); }

function openModal(titulo, bodyHTML, footerHTML) {
  document.getElementById('modal-title').textContent = titulo;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML || '';
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal(){ document.getElementById('modal-overlay').style.display = 'none'; }

function toast(msg, dur = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', dur);
}

function tipoBadge(tipo) {
  const map = {operativo:['badge-op','Operativo'],administrativo:['badge-adm','Administrativo'],directivo:['badge-dir','Directivo']};
  const [cls, label] = map[tipo] || ['badge-ok', tipo];
  return `<span class="badge ${cls}">${label}</span>`;
}
function rolBadge(rol) {
  return rol === 'admin' ? `<span class="badge badge-ok">Admin</span>` : `<span class="badge badge-ro">Solo lectura</span>`;
}
function estadoBadge(estado) {
  const map = {completo:['badge-ok','Completo'],solo_entrada:['badge-warn','Solo entrada'],solo_salida:['badge-warn','Solo salida'],estimado:['badge-warn','Estimado'],falta:['badge-err','Falta']};
  const [cls, label] = map[estado] || ['badge-warn', estado];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ---- MODAL: EMPLEADO ----
function modalEmpleado(emp = null) {
  const salMin = getSalMin();
  const body = `
    <div class="field-group"><label>Nombre completo</label>
      <input type="text" id="emp-nombre" value="${emp?.nombre || ''}" placeholder="APELLIDO NOMBRE" style="text-transform:uppercase"/>
    </div>
    <div class="field-group"><label>Tipo</label>
      <select id="emp-tipo">
        <option value="operativo" ${emp?.tipo==='operativo'?'selected':''}>Operativo (marca en reloj)</option>
        <option value="administrativo" ${emp?.tipo==='administrativo'?'selected':''}>Administrativo</option>
        <option value="directivo" ${emp?.tipo==='directivo'?'selected':''}>Directivo</option>
      </select>
    </div>
    <div class="field-group">
      <label>Salario mensual (Gs.) — vacío = mínimo (${fmtNum(salMin)})</label>
      <input type="number" id="emp-salario" value="${emp?.salario_mensual || ''}" placeholder="${fmtNum(salMin)}"/>
    </div>`;
  const footer = `
    <button class="btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarEmpleado(${emp?`'${emp.id}'`:'null'})">${emp?'Guardar cambios':'Agregar empleado'}</button>`;
  openModal(emp ? 'Editar empleado' : 'Nuevo empleado', body, footer);
}

async function guardarEmpleado(id) {
  const nombre = (document.getElementById('emp-nombre').value || '').trim().toUpperCase();
  const tipo = document.getElementById('emp-tipo').value;
  const salario = parseFloat(document.getElementById('emp-salario').value) || null;
  if (!nombre) { toast('Ingresá el nombre del empleado.'); return; }
  const emp = { nombre, tipo, salario_mensual: salario };
  if (id && id !== 'null') emp.id = id;
  const error = await upsertEmpleado(emp);
  if (error) { toast('Error al guardar: ' + (error.message||'')); return; }
  closeModal();
  toast('Empleado guardado ✓');
  await renderEmpleados();
}

// ---- MODAL: SEMANA ----
function modalSemana() {
  const hoy = new Date();
  const lun = new Date(hoy);
  lun.setDate(hoy.getDate() - hoy.getDay() + 1);
  const sab = new Date(lun);
  sab.setDate(lun.getDate() + 5);
  const toISO = d => d.toISOString().split('T')[0];
  const body = `
    <div class="field-group"><label>Descripción (opcional)</label>
      <input type="text" id="sem-desc" placeholder="Ej: Semana del 8 al 13 de junio"/>
    </div>
    <div class="field-group"><label>Fecha inicio</label>
      <input type="date" id="sem-ini" value="${toISO(lun)}"/>
    </div>
    <div class="field-group"><label>Fecha fin</label>
      <input type="date" id="sem-fin" value="${toISO(sab)}"/>
    </div>`;
  const footer = `
    <button class="btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" id="btn-crear-sem" onclick="crearSemanaUI()">Crear semana</button>`;
  openModal('Nueva semana de liquidación', body, footer);
}

async function crearSemanaUI() {
  const descEl = document.getElementById('sem-desc');
  const iniEl = document.getElementById('sem-ini');
  const finEl = document.getElementById('sem-fin');
  const desc = descEl ? (descEl.value || '').trim() : '';
  const ini = iniEl ? iniEl.value : '';
  const fin = finEl ? finEl.value : '';
  if (!ini || !fin) { toast('Seleccioná fechas de inicio y fin.'); return; }
  const btn = document.getElementById('btn-crear-sem');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  const { data, error } = await crearSemana({ fecha_inicio: ini, fecha_fin: fin, descripcion: desc || `Semana ${ini} — ${fin}` });
  if (error) {
    console.error('Error crear semana:', error);
    toast('Error: ' + (error.message || 'No se pudo crear la semana.'));
    if (btn) { btn.disabled = false; btn.textContent = 'Crear semana'; }
    return;
  }
  closeModal();
  toast('Semana creada ✓');
  await renderSemanas();
}

// ---- MODAL: FERIADO ----
function modalFeriado(fer = null) {
  const body = `
    <div class="field-group"><label>Fecha</label>
      <input type="date" id="fer-fecha" value="${fer?.fecha || ''}"/>
    </div>
    <div class="field-group"><label>Descripción</label>
      <input type="text" id="fer-desc" value="${fer?.descripcion || ''}" placeholder="Ej: Día de la Independencia"/>
    </div>
    <div class="field-group"><label>Aplica a</label>
      <select id="fer-aplica">
        <option value="todos" ${fer?.aplica==='todos'||!fer?'selected':''}>Todos los empleados</option>
        <option value="operativos" ${fer?.aplica==='operativos'?'selected':''}>Solo operativos</option>
        <option value="no-marcan" ${fer?.aplica==='no-marcan'?'selected':''}>Solo administrativos y directivos</option>
      </select>
    </div>
    <div class="field-group">
      <label>¿Se trabajó ese día?</label>
      <div class="toggle-wrap" style="margin-top:6px">
        <button class="toggle-btn ${fer?.se_trabajo?'on':''}" id="fer-toggle" onclick="this.classList.toggle('on')" type="button"></button>
        <span class="toggle-label">Marcar si se trabajó</span>
      </div>
    </div>`;
  const footer = `
    <button class="btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarFeriadoUI(${fer?`'${fer.id}'`:'null'})">${fer?'Guardar cambios':'Agregar feriado'}</button>`;
  openModal(fer ? 'Editar feriado' : 'Nuevo feriado', body, footer);
}

async function guardarFeriadoUI(id) {
  const fecha = (document.getElementById('fer-fecha').value || '');
  const desc = (document.getElementById('fer-desc').value || '').trim();
  const aplica = document.getElementById('fer-aplica').value;
  const trabajado = document.getElementById('fer-toggle').classList.contains('on');
  if (!fecha || !desc) { toast('Completá fecha y descripción.'); return; }
  const fer = { fecha, descripcion: desc, aplica, se_trabajo: trabajado };
  if (id && id !== 'null') fer.id = id;
  const error = await upsertFeriado(fer);
  if (error) { toast('Error al guardar feriado: ' + (error.message||'')); return; }
  closeModal();
  toast('Feriado guardado ✓');
  await renderFeriados();
}

// ---- MODAL: USUARIO ----
function modalUsuario() {
  const body = `
    <div class="info-box">El usuario recibirá un email para configurar su contraseña.</div>
    <div class="field-group"><label>Nombre</label>
      <input type="text" id="usr-nombre" placeholder="Nombre completo"/>
    </div>
    <div class="field-group"><label>Correo electrónico</label>
      <input type="email" id="usr-email" placeholder="usuario@empresa.com"/>
    </div>
    <div class="field-group"><label>Rol</label>
      <select id="usr-rol">
        <option value="admin">Admin (acceso total)</option>
        <option value="readonly">Solo lectura</option>
      </select>
    </div>`;
  const footer = `
    <button class="btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" onclick="crearUsuarioUI()">Enviar invitación</button>`;
  openModal('Nuevo usuario', body, footer);
}

async function crearUsuarioUI() {
  const nombre = (document.getElementById('usr-nombre').value || '').trim();
  const email = (document.getElementById('usr-email').value || '').trim();
  const rol = document.getElementById('usr-rol').value;
  if (!nombre || !email) { toast('Completá nombre y email.'); return; }
  const { error } = await invitarUsuario(email, nombre, rol);
  if (error) { toast('Error: ' + error.message); return; }
  closeModal();
  toast('Invitación enviada a ' + email + ' ✓');
  await renderUsuarios();
}

// ---- RENDERIZADO ----
async function renderSemanas() {
  const semanas = await getSemanas();
  const el = document.getElementById('semanas-list');
  if (semanas.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No hay semanas creadas. Creá la primera.</p>';
    return;
  }
  el.innerHTML = semanas.map(s => `
    <div class="semana-card ${s.cerrada?'cerrada':''}">
      <div class="semana-card-title">${s.descripcion||'Semana'} ${s.cerrada?'<span class="badge badge-warn">Cerrada</span>':'<span class="badge badge-ok">Activa</span>'}</div>
      <div class="semana-card-dates">${s.fecha_inicio} al ${s.fecha_fin}</div>
      <div class="semana-card-actions">
        <button class="btn-outline" onclick="irALiquidacion('${s.id}')">Ver liquidación</button>
        ${isAdmin()&&!s.cerrada?`<button class="btn-outline" onclick="confirmarCerrar('${s.id}')">Cerrar semana</button>`:''}
      </div>
    </div>`).join('');
  const opts = semanas.map(s => `<option value="${s.id}">${s.descripcion} (${s.fecha_inicio})</option>`).join('');
  ['sel-semana-liq','sel-semana-det','sel-semana-ips'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">Seleccionar semana...</option>' + opts;
  });
}

function irALiquidacion(semanaId) {
  showPage('liquidacion');
  document.getElementById('sel-semana-liq').value = semanaId;
  cargarLiquidacion();
}

async function confirmarCerrar(id) {
  if (!confirm('¿Cerrás esta semana? Ya no se podrá modificar.')) return;
  await cerrarSemana(id);
  toast('Semana cerrada ✓');
  renderSemanas();
}

async function renderEmpleados() {
  const empleados = await getEmpleados();
  const busq = (document.getElementById('emp-search')?.value || '').toLowerCase();
  const filtroTipo = document.getElementById('emp-filtro-tipo')?.value || '';
  const salMin = getSalMin();
  const filtrados = empleados.filter(e => e.nombre.toLowerCase().includes(busq) && (!filtroTipo || e.tipo === filtroTipo));
  document.getElementById('tbody-empleados').innerHTML = filtrados.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Sin empleados</td></tr>'
    : filtrados.map(e => `<tr>
        <td class="td-strong">${e.nombre}</td>
        <td>${tipoBadge(e.tipo)}</td>
        <td class="td-num" style="color:${e.salario_mensual&&e.salario_mensual!==salMin?'var(--blue)':'inherit'}">${fmt(e.salario_mensual||salMin)}</td>
        <td><span class="badge ${e.activo?'badge-ok':'badge-err'}">${e.activo?'Activo':'Inactivo'}</span></td>
        <td class="admin-only"><button class="btn-outline" style="padding:4px 10px;font-size:12px" onclick="modalEmpleado(${JSON.stringify(e).replace(/"/g,'&quot;')})">Editar</button></td>
      </tr>`).join('');
}

async function renderFeriados() {
  const feriados = await getFeriados();
  document.getElementById('tbody-feriados').innerHTML = feriados.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Sin feriados cargados</td></tr>'
    : feriados.map(f => `<tr>
        <td>${f.fecha}</td>
        <td class="td-strong">${f.descripcion}</td>
        <td>${f.aplica==='todos'?'Todos':f.aplica==='operativos'?'Solo operativos':'Admin y directivos'}</td>
        <td>
          <div class="toggle-wrap">
            <button class="toggle-btn ${f.se_trabajo?'on':''}" onclick="${isAdmin()?`toggleFer('${f.id}',${!f.se_trabajo})`:''}" ${!isAdmin()?'disabled':''} type="button"></button>
            <span style="font-size:12px;color:${f.se_trabajo?'var(--green)':'var(--text-hint)'}">${f.se_trabajo?'Se trabajó':'No se trabajó'}</span>
          </div>
        </td>
        <td class="admin-only">
          <button class="btn-outline" style="padding:4px 10px;font-size:12px" onclick="modalFeriado(${JSON.stringify(f).replace(/"/g,'&quot;')})">Editar</button>
          <button class="btn-danger" style="margin-left:4px" onclick="borrarFer('${f.id}')">Eliminar</button>
        </td>
      </tr>`).join('');
}

async function toggleFer(id, val) { await toggleFeriadoTrabajado(id, val); renderFeriados(); }
async function borrarFer(id) {
  if (!confirm('¿Eliminar este feriado?')) return;
  await deleteFeriado(id);
  toast('Feriado eliminado');
  renderFeriados();
}

function cargarFeriadosPY() {
  const feriadosPY2026 = [
    {fecha:'2026-01-01',descripcion:'Año Nuevo',aplica:'todos',se_trabajo:false},
    {fecha:'2026-03-01',descripcion:'Día de los Héroes',aplica:'todos',se_trabajo:false},
    {fecha:'2026-04-02',descripcion:'Jueves Santo',aplica:'todos',se_trabajo:false},
    {fecha:'2026-04-03',descripcion:'Viernes Santo',aplica:'todos',se_trabajo:false},
    {fecha:'2026-05-01',descripcion:'Día del Trabajador',aplica:'todos',se_trabajo:false},
    {fecha:'2026-05-14',descripcion:'Independencia Nacional (14 de mayo)',aplica:'todos',se_trabajo:false},
    {fecha:'2026-05-15',descripcion:'Independencia Nacional (15 de mayo)',aplica:'todos',se_trabajo:false},
    {fecha:'2026-06-12',descripcion:'Día de la Paz del Chaco',aplica:'todos',se_trabajo:false},
    {fecha:'2026-08-15',descripcion:'Fundación de Asunción',aplica:'todos',se_trabajo:false},
    {fecha:'2026-09-29',descripcion:'Victoria de Boquerón',aplica:'todos',se_trabajo:false},
    {fecha:'2026-12-08',descripcion:'Virgen de Caacupé',aplica:'todos',se_trabajo:false},
    {fecha:'2026-12-25',descripcion:'Navidad',aplica:'todos',se_trabajo:false},
  ];
  Promise.all(feriadosPY2026.map(f => upsertFeriado(f))).then(() => {
    toast('Feriados de Paraguay 2026 cargados ✓');
    renderFeriados();
  });
}

async function renderUsuarios() {
  const usuarios = await getUsuarios();
  document.getElementById('tbody-usuarios').innerHTML = usuarios.map(u => `<tr>
    <td class="td-strong">${u.nombre}</td>
    <td style="font-size:12px;color:var(--text-muted)">${u.id}</td>
    <td>${rolBadge(u.rol)}</td>
    <td><span class="badge ${u.activo?'badge-ok':'badge-err'}">${u.activo?'Activo':'Inactivo'}</span></td>
    <td>
      <select onchange="cambiarRol('${u.id}',this.value)" style="width:auto">
        <option value="admin" ${u.rol==='admin'?'selected':''}>Admin</option>
        <option value="readonly" ${u.rol==='readonly'?'selected':''}>Solo lectura</option>
      </select>
      <button class="btn-danger" style="margin-left:6px" onclick="toggleUsuarioActivo('${u.id}',${!u.activo})">${u.activo?'Desactivar':'Activar'}</button>
    </td>
  </tr>`).join('');
}

function importarMarcaciones() { document.getElementById('file-import').click(); }
