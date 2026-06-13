// ============================================================
// LÓGICA DE CÁLCULO DE SALARIOS
// ============================================================

let configGlobal = {};

async function recargarConfig() {
  configGlobal = await getConfig();
}

function getSalMin() {
  return parseFloat(configGlobal.salario_minimo) || 2899046;
}
function getHsDia() {
  return parseFloat(configGlobal.horas_diarias) || 9;
}
function getDiasHabMes() {
  return parseFloat(configGlobal.dias_habiles_mes) || 26;
}
function getPresentismoPct() {
  return (parseFloat(configGlobal.presentismo_pct) || 5) / 100;
}
function getRecargoDiurno() {
  return (parseFloat(configGlobal.recargo_diurno_pct) || 50) / 100;
}
function getRecargoNocturno() {
  return (parseFloat(configGlobal.recargo_nocturno_pct) || 100) / 100;
}
function getRecargoFeriado() {
  return (parseFloat(configGlobal.recargo_feriado_pct) || 100) / 100;
}

// Valor de 1 hora según salario mensual
function valorHora(salMensual) {
  return salMensual / (getDiasHabMes() * getHsDia());
}

// Salario proporcional a los días hábiles de la semana
function salarioSemanal(salMensual, diasHabilesSemana) {
  return salMensual / getDiasHabMes() * diasHabilesSemana;
}

// Días hábiles (lun-sab, sin domingo) entre dos fechas
function calcDiasHabiles(fechaIni, fechaFin) {
  const inicio = new Date(fechaIni + 'T00:00:00');
  const fin = new Date(fechaFin + 'T00:00:00');
  let count = 0;
  const dias = [];
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) { // 0 = domingo
      count++;
      dias.push(d.toISOString().split('T')[0]);
    }
  }
  return { count, dias };
}

// Calcular liquidación completa de UN empleado en una semana
function calcularEmpleado({ empleado, marcaciones, feriados, semana }) {
  const salMens = empleado.salario_mensual || getSalMin();
  const vh = valorHora(salMens);
  const { count: diasHab, dias: diasHabiles } = calcDiasHabiles(semana.fecha_inicio, semana.fecha_fin);
  const salSem = salarioSemanal(salMens, diasHab);
  const horasNormales = getHsDia() * diasHab;

  // Horas totales trabajadas (de marcaciones)
  let horasTrabajadas = 0;
  let faltas = 0;
  const detalleDias = [];

  diasHabiles.forEach(fechaStr => {
    const marc = marcaciones.find(m => m.fecha === fechaStr);
    let hsEsteHia = 0;
    let estadoDia = 'falta';

    if (marc) {
      hsEsteHia = parseFloat(marc.horas_calculadas) || 0;
      estadoDia = marc.estado;
    }

    if (estadoDia === 'falta' || hsEsteHia === 0) {
      faltas++;
    } else {
      horasTrabajadas += hsEsteHia;
    }
  });

  // Horas extra (por encima de la jornada normal de la semana)
  const hsExtra = Math.max(0, horasTrabajadas - horasNormales);

  // Por simplicidad todas las extras se tratan como diurnas
  // (para nocturnas necesitamos datos de hora de entrada/salida exacta)
  const hsExtraDiurnas = hsExtra;
  const hsExtaNoct = 0;

  const montoExtraDiurno = hsExtraDiurnas * vh * (1 + getRecargoDiurno());
  const montoExtraNoct = hsExtaNoct * vh * (1 + getRecargoNocturno());

  // Feriados trabajados que aplican a este empleado
  const feriadosAplicables = feriados.filter(f => {
    if (!f.se_trabajo) return false;
    if (f.aplica === 'todos') return true;
    if (f.aplica === 'operativos' && empleado.tipo === 'operativo') return true;
    if (f.aplica === 'no-marcan' && empleado.tipo !== 'operativo') return true;
    return false;
  });

  let montoFeriados = 0;
  const detalleExtras = [];

  if (hsExtraDiurnas > 0) {
    detalleExtras.push({
      concepto: `Horas extra diurnas (06:00–20:00)`,
      cantidad: `${hsExtraDiurnas.toFixed(2)} h`,
      valor_unitario: fmt(vh * (1 + getRecargoDiurno())),
      total: montoExtraDiurno,
      tipo: 'extra_diurna'
    });
  }

  if (hsExtaNoct > 0) {
    detalleExtras.push({
      concepto: `Horas extra nocturnas (20:00–06:00)`,
      cantidad: `${hsExtaNoct.toFixed(2)} h`,
      valor_unitario: fmt(vh * (1 + getRecargoNocturno())),
      total: montoExtraNoct,
      tipo: 'extra_nocturna'
    });
  }

  feriadosAplicables.forEach(f => {
    const monto = getHsDia() * vh * (1 + getRecargoFeriado());
    montoFeriados += monto;
    detalleExtras.push({
      concepto: `Feriado trabajado: ${f.descripcion}`,
      cantidad: `${getHsDia()} h × ${Math.round(getRecargoFeriado() * 100 + 100)}%`,
      valor_unitario: fmt(vh * (1 + getRecargoFeriado())),
      total: monto,
      tipo: 'feriado',
      fecha: f.fecha
    });
  });

  // Descuento por faltas
  const valorDia = salMens / getDiasHabMes();
  const descFaltas = faltas * valorDia;
  if (faltas > 0) {
    detalleExtras.push({
      concepto: `Descuento por ${faltas} falta(s)`,
      cantidad: `${faltas} día(s) × ${fmt(valorDia)}`,
      valor_unitario: fmt(valorDia),
      total: -descFaltas,
      tipo: 'descuento_falta'
    });
  }

  // Presentismo
  const tienePresentismo = faltas === 0;
  const montoPresent = tienePresentismo ? salSem * getPresentismoPct() : 0;
  if (montoPresent > 0) {
    detalleExtras.push({
      concepto: 'Presentismo (asistencia perfecta)',
      cantidad: `${Math.round(getPresentismoPct() * 100)}% del salario semanal`,
      valor_unitario: '',
      total: montoPresent,
      tipo: 'presentismo'
    });
  }

  const bruto = salSem + montoExtraDiurno + montoExtraNoct + montoFeriados + montoPresent - descFaltas;
  const ipsObrero = bruto * IPS_OBRERO;
  const ipsPatronal = bruto * IPS_PATRONAL;
  const neto = bruto - ipsObrero;

  detalleExtras.push({
    concepto: 'IPS obrero (9%)',
    cantidad: '9% del bruto',
    valor_unitario: '',
    total: -ipsObrero,
    tipo: 'ips'
  });

  return {
    empleado_id: empleado.id,
    salario_mensual: salMens,
    salario_semanal: salSem,
    horas_trabajadas: horasTrabajadas,
    horas_extra_diurnas: hsExtraDiurnas,
    horas_extra_nocturnas: hsExtaNoct,
    monto_extra_diurno: montoExtraDiurno,
    monto_extra_nocturno: montoExtraNoct,
    monto_feriados: montoFeriados,
    faltas,
    descuento_faltas: descFaltas,
    presentismo: montoPresent,
    salario_bruto: bruto,
    ips_obrero: ipsObrero,
    ips_patronal: ipsPatronal,
    salario_neto: neto,
    detalle_extras: detalleExtras
  };
}

// Calcular para empleados que NO marcan (admin/directivos)
function calcularNoMarca({ empleado, feriados, semana }) {
  const salMens = empleado.salario_mensual || getSalMin();
  const vh = valorHora(salMens);
  const { count: diasHab } = calcDiasHabiles(semana.fecha_inicio, semana.fecha_fin);
  const salSem = salarioSemanal(salMens, diasHab);

  const feriadosAplicables = feriados.filter(f => {
    if (!f.se_trabajo) return false;
    if (f.aplica === 'todos') return true;
    if (f.aplica === 'no-marcan') return true;
    return false;
  });

  let montoFeriados = 0;
  const detalleExtras = [];

  feriadosAplicables.forEach(f => {
    const monto = getHsDia() * vh * (1 + getRecargoFeriado());
    montoFeriados += monto;
    detalleExtras.push({
      concepto: `Feriado trabajado: ${f.descripcion}`,
      cantidad: `${getHsDia()} h × ${Math.round(getRecargoFeriado() * 100 + 100)}%`,
      valor_unitario: fmt(vh * (1 + getRecargoFeriado())),
      total: monto,
      tipo: 'feriado',
      fecha: f.fecha
    });
  });

  const montoPresent = salSem * getPresentismoPct();
  detalleExtras.push({
    concepto: 'Presentismo (asistencia perfecta)',
    cantidad: `${Math.round(getPresentismoPct() * 100)}% del salario semanal`,
    valor_unitario: '',
    total: montoPresent,
    tipo: 'presentismo'
  });

  const bruto = salSem + montoFeriados + montoPresent;
  const ipsObrero = bruto * IPS_OBRERO;
  const ipsPatronal = bruto * IPS_PATRONAL;
  const neto = bruto - ipsObrero;

  detalleExtras.push({
    concepto: 'IPS obrero (9%)',
    cantidad: '9% del bruto',
    valor_unitario: '',
    total: -ipsObrero,
    tipo: 'ips'
  });

  return {
    empleado_id: empleado.id,
    salario_mensual: salMens,
    salario_semanal: salSem,
    horas_trabajadas: getHsDia() * diasHab,
    horas_extra_diurnas: 0,
    horas_extra_nocturnas: 0,
    monto_extra_diurno: 0,
    monto_extra_nocturno: 0,
    monto_feriados: montoFeriados,
    faltas: 0,
    descuento_faltas: 0,
    presentismo: montoPresent,
    salario_bruto: bruto,
    ips_obrero: ipsObrero,
    ips_patronal: ipsPatronal,
    salario_neto: neto,
    detalle_extras: detalleExtras
  };
}

// Parsear horas del archivo XLS/CSV del marcador
function parsearHorasMarcador(entrada, salida, horarioStr, tiemAsist) {
  const toMin = t => {
    if (!t || t === 'NaN' || t === '') return null;
    const p = String(t).trim().match(/(\d+):(\d+)/);
    if (!p) return null;
    return parseInt(p[1]) * 60 + parseInt(p[2]);
  };

  const entMin = toMin(entrada);
  const salMin = toMin(salida);
  const tiemMin = toMin(tiemAsist);

  // Parsear horario estándar del campo "07:00 A 16:00"
  let horNorm = 9 * 60; // 9 horas por defecto
  if (horarioStr) {
    const m = horarioStr.match(/(\d+:\d+)\s+A\s+(\d+:\d+)/);
    if (m) {
      const ini = toMin(m[1]);
      const fin = toMin(m[2]);
      if (ini !== null && fin !== null) horNorm = fin - ini;
    }
  }

  let horasCalc = 0;
  let estado = 'falta';

  if (entMin !== null && salMin !== null) {
    horasCalc = (salMin - entMin) / 60;
    estado = 'completo';
  } else if (entMin !== null && tiemMin !== null) {
    // Solo entrada: TiemAsist ya tiene la duración calculada por el marcador
    horasCalc = tiemMin / 60;
    estado = 'solo_entrada';
  } else if (salMin !== null && tiemMin !== null) {
    horasCalc = tiemMin / 60;
    estado = 'solo_salida';
  } else if (entMin !== null) {
    // Solo entrada sin TiemAsist: usar horario estándar
    horasCalc = horNorm / 60;
    estado = 'estimado';
  } else if (salMin !== null) {
    horasCalc = horNorm / 60;
    estado = 'estimado';
  }

  return { horasCalc: Math.max(0, horasCalc), estado };
}

// Formato moneda
function fmt(n) {
  return 'Gs. ' + Math.round(n).toLocaleString('es-PY');
}
function fmtNum(n) {
  return Math.round(n).toLocaleString('es-PY');
}
