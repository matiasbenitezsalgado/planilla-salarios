// ============================================================
// APP PRINCIPAL
// ============================================================

// ---- INICIO ----
function iniciarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  // Datos del usuario en sidebar
  document.getElementById('user-name').textContent = currentPerfil.nombre;
  document.getElementById('user-rol').textContent = currentPerfil.rol === 'admin' ? 'Administrador' : 'Solo lectura';
  document.getElementById('user-avatar').textContent = currentPerfil.nombre.charAt(0).toUpperCase();

  // Ocultar elementos de admin si es readonly
  if (isReadonly()) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.getElementById('readonly-badge').style.display = 'block';
  }

  // Cargar datos iniciales
  recargarConfig().then(() => {
    renderSemanas();
    renderEmpleados();
    renderFeriados();
    if (isAdmin()) renderConfigForm();
    if (isAdmin()) renderUsuarios();
  });
}

// ---- LIQUIDACIÓN ----
async function cargarLiquidacion() {
  const semanaId = document.getElementById('sel-semana-liq').value;
  if (!semanaId) return;

  const liq = await getLiquidacionSemana(semanaId);
  renderTablaLiquidacion(liq);
}

async function calcularLiquidacion() {
  const semanaId = document.getElementById('sel-semana-liq').value;
  if (!semanaId) { toast('Seleccioná una semana.'); return; }

  const btn = document.getElementById('btn-calcular');
  btn.disabled = true;
  btn.textContent = 'Calculando...';

  try {
    await recargarConfig();

    const semanas = await getSemanas();
    const semana = semanas.find(s => s.id === semanaId);
    if (!semana) { toast('Semana no encontrada.'); return; }

    const empleados = await getEmpleados();
    const feriados = await getFeriados();
    const resultados = [];

    for (const emp of empleados) {
      let resultado;
      if (emp.tipo === 'operativo') {
        const marcaciones = await getMarcacionesSemana(semanaId);
        const marcEmp = marcaciones.filter(m => m.empleado_id === emp.id);
        resultado = calcularEmpleado({ empleado: emp, marcaciones: marcEmp, feriados, semana });
      } else {
        resultado = calcularNoMarca({ empleado: emp, feriados, semana });
      }
      resultados.push({ semana_id: semanaId, ...resultado });
    }

    // Eliminar liquidación anterior y guardar nueva
    await deleteLiquidacionSemana(semanaId);
    const error = await upsertLiquidacion(resultados);
    if (error) { toast('Error al guardar liquidación.'); return; }

    const liq = await getLiquidacionSemana(semanaId);
    renderTablaLiquidacion(liq);
    toast(`Liquidación calculada para ${resultados.length} empleados ✓`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Calcular semana';
  }
}

function renderTablaLiquidacion(liq) {
  if (!liq || liq.length === 0) {
    document.getElementById('tbody-liq').innerHTML =
      '<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--text-muted)">Calculá la semana para ver la liquidación</td></tr>';
    ['m-emp','m-bruto','m-desc','m-neto'].forEach(id => document.getElementById(id).textContent = '—');
    return;
  }

  const totBruto = liq.reduce((a,l) => a + (l.salario_bruto || 0), 0);
  const totDesc = liq.reduce((a,l) => a + (l.ips_obrero || 0), 0);
  const totNeto = liq.reduce((a,l) => a + (l.salario_neto || 0), 0);

  document.getElementById('m-emp').textContent = liq.length;
  document.getElementById('m-bruto').textContent = fmt(totBruto);
  document.getElementById('m-desc').textContent = fmt(totDesc);
  document.getElementById('m-neto').textContent = fmt(totNeto);

  document.getElementById('tbody-liq').innerHTML = liq.map(l => {
    const tipo = l.empleados?.tipo || 'operativo';
    return `<tr>
      <td class="td-strong">${l.empleados?.nombre || '—'}</td>
      <td>${tipoBadge(tipo)}</td>
      <td class="td-num">${fmt(l.salario_semanal)}</td>
      <td class="td-num" style="color:${l.monto_extra_diurno > 0 ? 'var(--green)' : 'var(--text-hint)'}">
        ${l.monto_extra_diurno > 0 ? fmt(l.monto_extra_diurno) : '—'}
      </td>
      <td class="td-num" style="color:${l.monto_extra_nocturno > 0 ? 'var(--green)' : 'var(--text-hint)'}">
        ${l.monto_extra_nocturno > 0 ? fmt(l.monto_extra_nocturno) : '—'}
      </td>
      <td class="td-num" style="color:${l.monto_feriados > 0 ? 'var(--blue)' : 'var(--text-hint)'}">
        ${l.monto_feriados > 0 ? fmt(l.monto_feriados) : '—'}
      </td>
      <td class="td-num" style="color:${l.descuento_faltas > 0 ? 'var(--red)' : 'var(--text-hint)'}">
        ${l.descuento_faltas > 0 ? '−' + fmt(l.descuento_faltas) : '—'}
      </td>
      <td class="td-num" style="color:${l.presentismo > 0 ? 'var(--green)' : 'var(--text-hint)'}">
        ${l.presentismo > 0 ? fmt(l.presentismo) : '—'}
      </td>
      <td class="td-num td-strong">${fmt(l.salario_bruto)}</td>
      <td class="td-num" style="color:var(--red)">−${fmt(l.ips_obrero)}</td>
      <td class="td-num td-strong" style="color:var(--green)">${fmt(l.salario_neto)}</td>
    </tr>`;
  }).join('');
}

// ---- DETALLE EXTRAS ----
async function cargarDetalle() {
  const semanaId = document.getElementById('sel-semana-det').value;
  if (!semanaId) return;

  const liq = await getLiquidacionSemana(semanaId);
  const wrap = document.getElementById('detalle-list');

  const conExtras = liq.filter(l => {
    const extras = Array.isArray(l.detalle_extras) ? l.detalle_extras : JSON.parse(l.detalle_extras || '[]');
    return extras.some(d => d.tipo !== 'ips');
  });

  if (conExtras.length === 0) {
    wrap.innerHTML = '<div class="info-box">Sin conceptos extra esta semana. Todos cobran salario base.</div>';
    return;
  }

  wrap.innerHTML = conExtras.map((l, idx) => {
    const nombre = l.empleados?.nombre || '—';
    const tipo = l.empleados?.tipo || 'operativo';
    const extras = Array.isArray(l.detalle_extras) ? l.detalle_extras : JSON.parse(l.detalle_extras || '[]');
    const totalExtras = (l.monto_extra_diurno||0) + (l.monto_extra_nocturno||0) + (l.monto_feriados||0) + (l.presentismo||0) - (l.descuento_faltas||0);

    return `<div class="det-emp">
      <div class="det-header" onclick="document.getElementById('db-${idx}').classList.toggle('open')">
        <div class="det-nombre">${nombre} ${tipoBadge(tipo)}</div>
        <div class="det-summary">
          <span>Base: <strong>${fmt(l.salario_semanal)}</strong></span>
          <span style="color:${totalExtras >= 0 ? 'var(--green)' : 'var(--red)'}">
            Extras: ${totalExtras >= 0 ? '+' : ''}${fmt(totalExtras)}
          </span>
          <span>Neto: <strong style="color:var(--green)">${fmt(l.salario_neto)}</strong></span>
          <span style="color:var(--text-hint)">▼</span>
        </div>
      </div>
      <div class="det-body" id="db-${idx}">
        <div class="det-col-head">
          <span>Concepto</span><span>Cant. / base</span><span>Valor unitario</span><span style="text-align:right">Monto</span>
        </div>
        <div class="det-concepto">
          <span>Salario base semanal</span><span></span><span></span>
          <span class="td-num">${fmt(l.salario_semanal)}</span>
        </div>
        ${extras.map(d => `
          <div class="det-concepto" style="color:${
            d.tipo === 'descuento_falta' || d.tipo === 'ips' ? 'var(--red)' :
            d.tipo === 'feriado' ? 'var(--blue)' :
            d.tipo === 'presentismo' ? 'var(--green)' :
            d.tipo === 'extra_diurna' || d.tipo === 'extra_nocturna' ? 'var(--green)' : 'inherit'
          }">
            <span style="font-weight:500">${d.concepto}</span>
            <span>${d.cantidad || '—'}</span>
            <span>${d.valor_unitario || '—'}</span>
            <span class="td-num">${typeof d.total === 'number' ? (d.total < 0 ? '−' + fmt(Math.abs(d.total)) : fmt(d.total)) : d.total}</span>
          </div>`).join('')}
        <div class="det-concepto total-row">
          <span>Total neto a cobrar</span><span></span><span></span>
          <span class="td-num" style="color:var(--green);font-size:14px">${fmt(l.salario_neto)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ---- IPS ----
async function cargarIPS() {
  const semanaId = document.getElementById('sel-semana-ips').value;
  if (!semanaId) return;

  const liq = await getLiquidacionSemana(semanaId);
  const totBruto = liq.reduce((a,l) => a + (l.salario_bruto || 0), 0);
  const totObr = liq.reduce((a,l) => a + (l.ips_obrero || 0), 0);
  const totPat = liq.reduce((a,l) => a + (l.ips_patronal || 0), 0);

  document.getElementById('i-masa').textContent = fmt(totBruto);
  document.getElementById('i-obr').textContent = fmt(totObr);
  document.getElementById('i-pat').textContent = fmt(totPat);
  document.getElementById('i-tot').textContent = fmt(totObr + totPat);

  document.getElementById('tbody-ips').innerHTML = liq.map(l => {
    const tipo = l.empleados?.tipo || 'operativo';
    const extras = (l.monto_extra_diurno||0)+(l.monto_extra_nocturno||0)+(l.monto_feriados||0)+(l.presentismo||0)-(l.descuento_faltas||0);
    return `<tr>
      <td class="td-strong">${l.empleados?.nombre || '—'}</td>
      <td>${tipoBadge(tipo)}</td>
      <td class="td-num">${fmt(l.salario_semanal)}</td>
      <td class="td-num" style="color:${extras > 0 ? 'var(--green)' : extras < 0 ? 'var(--red)' : 'var(--text-hint)'}">
        ${extras !== 0 ? (extras > 0 ? '+' : '') + fmt(extras) : '—'}
      </td>
      <td class="td-num td-strong">${fmt(l.salario_bruto)}</td>
      <td class="td-num" style="color:var(--red)">${fmt(l.ips_obrero)}</td>
      <td class="td-num" style="color:var(--red)">${fmt(l.ips_patronal)}</td>
      <td class="td-num td-strong">${fmt(l.ips_obrero + l.ips_patronal)}</td>
    </tr>`;
  }).join('');
}

// ---- EXPORTAR CSV ----
async function exportarLiqCSV() {
  const semanaId = document.getElementById('sel-semana-liq').value;
  if (!semanaId) { toast('Seleccioná una semana.'); return; }
  const liq = await getLiquidacionSemana(semanaId);
  if (!liq.length) { toast('Sin datos para exportar.'); return; }
  const headers = ['Empleado','Tipo','Sal. semanal','H. trabajadas','H. ext. diurnas','Monto ext. diurnas','H. ext. noct.','Monto ext. noct.','Monto feriados','Faltas','Desc. faltas','Presentismo','Bruto','IPS obrero 9%','IPS patronal 14%','Neto'];
  const rows = liq.map(l => [
    l.empleados?.nombre, l.empleados?.tipo,
    Math.round(l.salario_semanal), l.horas_trabajadas?.toFixed(2),
    l.horas_extra_diurnas?.toFixed(2), Math.round(l.monto_extra_diurno),
    l.horas_extra_nocturnas?.toFixed(2), Math.round(l.monto_extra_nocturno),
    Math.round(l.monto_feriados), l.faltas,
    Math.round(l.descuento_faltas), Math.round(l.presentismo),
    Math.round(l.salario_bruto), Math.round(l.ips_obrero),
    Math.round(l.ips_patronal), Math.round(l.salario_neto)
  ]);
  descargarCSV('liquidacion_semanal.csv', headers, rows);
}

async function exportarIPSCSV() {
  const semanaId = document.getElementById('sel-semana-ips').value;
  if (!semanaId) { toast('Seleccioná una semana.'); return; }
  const liq = await getLiquidacionSemana(semanaId);
  const headers = ['Empleado','Tipo','Sal. semanal base','Extras','Bruto','IPS obrero 9%','IPS patronal 14%','Total IPS'];
  const rows = liq.map(l => {
    const extras = (l.monto_extra_diurno||0)+(l.monto_extra_nocturno||0)+(l.monto_feriados||0)+(l.presentismo||0)-(l.descuento_faltas||0);
    return [l.empleados?.nombre, l.empleados?.tipo, Math.round(l.salario_semanal), Math.round(extras), Math.round(l.salario_bruto), Math.round(l.ips_obrero), Math.round(l.ips_patronal), Math.round(l.ips_obrero+l.ips_patronal)];
  });
  descargarCSV('ips_semanal.csv', headers, rows);
}

function descargarCSV(nombre, headers, rows) {
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
}

// ---- CONFIGURACIÓN ----
const CONFIG_LABELS = {
  salario_minimo: 'Salario mínimo mensual (Gs.)',
  horas_diarias: 'Horas diarias jornada normal',
  dias_habiles_mes: 'Días hábiles del mes (divisor)',
  presentismo_pct: 'Presentismo (%)',
  recargo_diurno_pct: 'Recargo hora extra diurna (%)',
  recargo_nocturno_pct: 'Recargo hora extra nocturna (%)',
  recargo_feriado_pct: 'Recargo feriado / domingo trabajado (%)'
};

async function renderConfigForm() {
  const cfg = await getConfig();
  document.getElementById('config-form').innerHTML = Object.entries(CONFIG_LABELS).map(([k, label]) => `
    <div class="field-group">
      <label>${label}</label>
      <input type="number" id="cfg-${k}" value="${cfg[k] || ''}"/>
    </div>`).join('');
}

async function guardarConfig() {
  for (const clave of Object.keys(CONFIG_LABELS)) {
    const val = document.getElementById('cfg-' + clave)?.value;
    if (val) await saveConfig(clave, val);
  }
  await recargarConfig();
  toast('Configuración guardada ✓');
}

// ---- IMPORTAR MARCACIONES XLS ----
async function procesarArchivoImport(input) {
  const file = input.files[0];
  if (!file) return;

  const semanaId = prompt('ID de la semana (copiá de la URL o dejá vacío para crear nueva):');
  if (!semanaId) return;

  // Usar SheetJS para leer el XLS
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  script.onload = async () => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Mapear columnas del marcador a nuestro formato
      const empleados = await getEmpleados();
      const marcaciones = [];

      for (const row of rows) {
        const nombreOrig = (row['Nombre'] || row['nombre'] || '').toString().trim().toUpperCase();
        const fecha = row['Dia'] || row['Fecha'] || row['dia'] || row['fecha'] || '';
        const entrada = row['Marc-Ent'] || row['Entrada'] || row['entrada'] || '';
        const salida = row['Marc-Sal'] || row['Salida'] || row['salida'] || '';
        const tiemAsist = row['TiemAsist'] || row['TiempoAsist'] || '';
        const horario = row['Horario'] || row['horario'] || '';

        if (!nombreOrig || !fecha) continue;

        const emp = empleados.find(e => e.nombre === nombreOrig || e.nombre.includes(nombreOrig));
        if (!emp) continue;

        // Convertir fecha DD/MM/YYYY a YYYY-MM-DD
        let fechaISO = fecha;
        const mFecha = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (mFecha) fechaISO = `${mFecha[3]}-${mFecha[2]}-${mFecha[1]}`;

        const { horasCalc, estado } = parsearHorasMarcador(
          entrada?.toString(), salida?.toString(),
          horario?.toString(), tiemAsist?.toString()
        );

        marcaciones.push({
          semana_id: semanaId,
          empleado_id: emp.id,
          fecha: fechaISO,
          entrada: entrada?.toString() || null,
          salida: salida?.toString() || null,
          horas_calculadas: horasCalc,
          estado
        });
      }

      if (marcaciones.length === 0) {
        toast('No se encontraron marcaciones válidas. Verificá el archivo.');
        return;
      }

      await deleteMarcacionesSemana(semanaId);
      const error = await upsertMarcaciones(marcaciones);
      if (error) { toast('Error al guardar marcaciones: ' + error.message); return; }
      toast(`${marcaciones.length} marcaciones importadas ✓`);
    };
    reader.readAsArrayBuffer(file);
  };
  document.head.appendChild(script);
  input.value = '';
}

// ---- INICIO ----
window.addEventListener('DOMContentLoaded', () => {
  checkSession();
  // Enter en login
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
});
