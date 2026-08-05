// Variables globales
let allData = {};
let currentMonth = null;
let currentCiclo = null;
let currentActivity = '';  // ← Variable para actividad seleccionada
let currentSelectedDay = null;  // ← Variable para recordar el día seleccionado
let currentCalendarMonth = null;

// ============================================================================
// FUNCIONES PARA MANEJO DE FECHAS (sin problemas de zona horaria)
// ============================================================================

// Parsear fecha string "YYYY-MM-DD" sin problemas de zona horaria
function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// Convertir Date a string "YYYY-MM-DD"
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Convertir fecha YYYY-MM-DD a formato DD-MM-YYYY para mostrar
function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
}

// Función para navegar a página 1 sin cambiar botones seleccionados
function navigateToPage1() {
    // Activar el botón Resumen Mes
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.toggle-btn[data-page="1"]').classList.add('active');
    
    // Cambiar la página visible
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById('page1').classList.add('active');
    
    // Mostrar selectores según página 1
    const monthSelect = document.getElementById('monthSelect');
    const cicloSelect = document.getElementById('cicloSelect');
    const activitySelectorGroup = document.getElementById('activitySelectorGroup');
    const monthSelectorGroup = monthSelect.closest('.selector-group');
    const cicloSelectorGroup = cicloSelect.closest('.selector-group');
    const selectors = monthSelectorGroup.closest('.selectors');
    
    selectors.style.display = 'flex';
    cicloSelectorGroup.style.display = 'none';
    activitySelectorGroup.style.display = 'none';
}

// EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('monthSelect').addEventListener('change', handleMonthChange);
    
    // Listener para el botón logo - navega a página 1 y selecciona el botón Resumen Mes
    document.getElementById('logoBtn').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage1();
    });
    
    // El listener para cicloSelect se agrega dinámicamente en handleMonthChange
    
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pageNum = this.dataset.page;
            switchPage(pageNum);
        });
    });
    
    loadMonths();
});

// FUNCIONES DE CARGA
// Los datos se cargan automáticamente desde el servidor

async function loadMonths() {
    try {
        const response = await fetch('/api/months');
        const data = await response.json();

        const select = document.getElementById('monthSelect');
        select.innerHTML = '<option value="">-- Seleccionar mes --</option>';

        data.months.forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = month;
            select.appendChild(option);
        });
        
        // Ocultar selector de ciclo por defecto
        const cicloSelectorGroup = document.getElementById('cicloSelect').closest('.selector-group');
        cicloSelectorGroup.style.display = 'none';
        
        // IMPORTANTE: Cargar TODOS los meses en allData para que Página 3 funcione
        for (const month of data.months) {
            try {
                const res = await fetch(`/api/mes/${month}`);
                const monthData = await res.json();
                allData[month] = monthData.ciclos;
            } catch (e) {
                console.error(`Error loading month ${month}:`, e);
            }
        }
        
        // Página 3 ahora usa el mes del filtro principal
        // fillCalendarMonthSelector();
        // setupCalendarPage();
    } catch (error) {
        console.error('Error loading months:', error);
    }
}

async function handleMonthChange() {
    const month = document.getElementById('monthSelect').value;
    if (!month) {
        document.getElementById('cicloSelect').innerHTML = '<option value="">-- Seleccionar ciclo --</option>';
        clearPage1();
        return;
    }

    currentMonth = month;
    currentCiclo = null;

    try {
        const response = await fetch(`/api/mes/${month}`);
        const data = await response.json();
        allData[month] = data.ciclos;

        // Cargar ciclos en select
        const cicloSelect = document.getElementById('cicloSelect');
        cicloSelect.innerHTML = '<option value="">-- Seleccionar ciclo --</option>';
        
        // Deduplicar ciclos (mostrar cada número solo una vez)
        const ciclosSeen = new Set();
        const uniqueCiclos = [];
        
        data.ciclos.forEach(ciclo => {
            if (!ciclosSeen.has(ciclo.ciclo)) {
                ciclosSeen.add(ciclo.ciclo);
                uniqueCiclos.push(ciclo);
            }
        });
        
        // Ordenar ciclos numéricamente
        uniqueCiclos.sort((a, b) => parseInt(a.ciclo) - parseInt(b.ciclo));
        
        // Llenar el select con ciclos ordenados y sin duplicados
        uniqueCiclos.forEach(ciclo => {
            const option = document.createElement('option');
            option.value = ciclo.ciclo;
            option.textContent = ciclo.ciclo;
            cicloSelect.appendChild(option);
        });

        // Agregar listener al select después de regenerarlo
        cicloSelect.addEventListener('change', handleCicloChange);

        // Auto-seleccionar el primer ciclo
        if (uniqueCiclos.length > 0) {
            cicloSelect.value = String(uniqueCiclos[0].ciclo);
            currentCiclo = String(uniqueCiclos[0].ciclo);
            displayCicloDetail();
        }

        // Actualizar página 1
        displayMonthData(data.ciclos);
        
        // ✨ Actualizar Página 3 (Calendario) con el mes seleccionado
        displayCalendarMonth(month);
        
        // ✨ Agregar listener al selector de actividad (Página 3)
        const activitySelect = document.getElementById('activitySelect');
        activitySelect.addEventListener('change', () => {
            currentActivity = activitySelect.value;
            displayCalendarMonth(currentMonth);  // ← Redibujar calendario con nuevo filtro
            
            // Si hay un día seleccionado, actualizar su detalle también
            if (currentSelectedDay) {
                showDayDetails(currentSelectedDay, allData[currentMonth]);
            }
        });
    } catch (error) {
        console.error('Error loading month data:', error);
    }
}

function handleCicloChange() {
    const ciclo = document.getElementById('cicloSelect').value;
    console.log('=== handleCicloChange ===');
    console.log('Ciclo seleccionado:', ciclo);
    console.log('currentMonth:', currentMonth);
    console.log('allData keys:', Object.keys(allData));
    
    if (!ciclo) {
        console.log('No hay ciclo seleccionado');
        return;
    }

    if (!currentMonth) {
        console.log('No hay mes actual, intentando obtener del selector');
        const monthSelect = document.getElementById('monthSelect').value;
        if (!monthSelect) {
            console.log('Tampoco hay mes en el selector');
            return;
        }
        currentMonth = monthSelect;
    }

    currentCiclo = ciclo;
    console.log('Actualizando a ciclo:', currentCiclo, 'mes:', currentMonth);
    
    displayCicloDetail();
}

function updatePage1Timeline() {
    if (!currentMonth || !currentCiclo) return;

    const ciclos = allData[currentMonth] || [];
    const cicloData = ciclos.find(c => String(c.ciclo) === String(currentCiclo));

    if (!cicloData) return;

    const steps = [
        {
            name: 'Consumo',
            icon: 'fa-leaf',
            start: cicloData.consumo_inicio,
            end: cicloData.consumo_fin,
            color: '#4CAF50'
        },
        {
            name: 'Transmisión DIAN',
            icon: 'fa-file-text',
            start: cicloData.dian_inicio,
            end: cicloData.dian_inicio,
            color: '#FF9800'
        },
        {
            name: 'Entrega Factura',
            icon: 'fa-envelope',
            start: cicloData.entrega_cliente_inicio,
            end: cicloData.entrega_cliente_inicio,
            color: '#2196F3'
        },
        {
            name: 'Vencimiento',
            icon: 'fa-calendar',
            start: cicloData.pago_inicio,
            end: cicloData.pago_inicio,
            color: '#9C27B0'
        },
        {
            name: 'Suspensión',
            icon: 'fa-ban',
            start: cicloData.suspension_inicio,
            end: cicloData.suspension_fin,
            color: '#F44336'
        }
    ];

    let html = '';
    steps.forEach((step, idx) => {
        const dateText = formatDateRange(step.start, step.end);
        html += `
            <div class="timeline-step">
                <i class="fas ${step.icon}" style="background: ${step.color}"></i>
                <p>${step.name}</p>
                <small>${dateText}</small>
            </div>
        `;
        if (idx < steps.length - 1) {
            html += '<div class="timeline-arrow"></div>';
        }
    });

    const timelineEl = document.getElementById('monthTimeline');
    if (timelineEl) {
        timelineEl.innerHTML = html;
    }
}

function switchPage(pageNum) {
    // Toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.toggle-btn').classList.add('active');

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    document.getElementById(`page${pageNum}`).classList.add('active');
    
    // Mostrar/ocultar selectores según la página
    const monthSelect = document.getElementById('monthSelect');
    const cicloSelect = document.getElementById('cicloSelect');
    const activitySelectorGroup = document.getElementById('activitySelectorGroup');
    const monthSelectorGroup = monthSelect.closest('.selector-group');
    const cicloSelectorGroup = cicloSelect.closest('.selector-group');
    const selectors = monthSelectorGroup.closest('.selectors');
    
    if (pageNum === '1') {
        selectors.style.display = 'flex';
        cicloSelectorGroup.style.display = 'none';
        activitySelectorGroup.style.display = 'none';
    } else if (pageNum === '2') {
        selectors.style.display = 'flex';
        cicloSelectorGroup.style.display = 'block';
        activitySelectorGroup.style.display = 'none';
    } else if (pageNum === '3') {
        // En Página 3, mostrar filtro de mes y actividad
        selectors.style.display = 'flex';
        monthSelectorGroup.style.display = 'block';
        cicloSelectorGroup.style.display = 'none';
        activitySelectorGroup.style.display = 'block';  /* ← Mostrar selector de actividad */
    }
}

// PÁGINA 1: RESUMEN DEL MES
function displayMonthData(ciclos) {
    updateMonthNameDisplay(currentMonth);
    displayMonthTable(ciclos);
}

function updateMonthNameDisplay(month) {
    const monthNameSpan = document.getElementById('selectedMonthName');
    if (monthNameSpan && month) {
        monthNameSpan.textContent = month;
    }
}

function displayMonthTimeline(ciclos) {
    // Mostrar hitos principales del mes
    const steps = [
        { name: 'Consumo', icon: 'fa-leaf', color: '#4CAF50' },
        { name: 'Transmisión DIAN', icon: 'fa-file-text', color: '#FF9800' },
        { name: 'Entrega Factura', icon: 'fa-envelope', color: '#2196F3' },
        { name: 'Vencimiento', icon: 'fa-calendar', color: '#9C27B0' },
        { name: 'Suspensión', icon: 'fa-ban', color: '#F44336' }
    ];

    let html = '';
    steps.forEach((step, idx) => {
        html += `
            <div class="timeline-step">
                <i class="fas ${step.icon}" style="background: ${step.color}"></i>
                <p>${step.name}</p>
                <small>${getDateRangeForMonth(ciclos, step.name)}</small>
            </div>
        `;
        if (idx < steps.length - 1) {
            html += '<div class="timeline-arrow"></div>';
        }
    });

    const timelineEl = document.getElementById('monthTimeline');
    if (timelineEl) {
        timelineEl.innerHTML = html;
    }
}

function displayMonthTable(ciclos) {
    const tbody = document.getElementById('monthTableBody');
    tbody.innerHTML = '';

    // Ciclos especiales que deben resaltarse
    const ciclosEspeciales = [94, 87, 91, 75, 76, 92, 93, 89, 81, 79, 95, 77, 58];

    // Deduplicar ciclos (mostrar solo una línea por ciclo único)
    const uniqueCiclos = [];
    const ciclosSeen = new Set();
    
    ciclos.forEach(ciclo => {
        if (!ciclosSeen.has(ciclo.ciclo)) {
            ciclosSeen.add(ciclo.ciclo);
            uniqueCiclos.push(ciclo);
        }
    });

    uniqueCiclos.forEach(ciclo => {
        const row = document.createElement('tr');
        
        // Agregar clase si es un ciclo especial
        if (ciclosEspeciales.includes(parseInt(ciclo.ciclo))) {
            row.classList.add('ciclo-especial');
            console.log(`✅ Ciclo ${ciclo.ciclo} marcado como ESPECIAL`);
        }
        
        row.innerHTML = `
            <td>${ciclo.ciclo}</td>
            <td>${ciclo.municipio}</td>
            <td>${ciclo.analista}</td>
            <td><strong>${ciclo.dias_facturados || '-'}</strong></td>
            <td>${formatDateDisplay(ciclo.generacion_libro)}</td>
            <td>${formatDateDisplay(ciclo.consumo_fin)}</td>
            <td>${formatDateDisplay(ciclo.analisis_consumos)}</td>
            <td>${formatDateDisplay(ciclo.liquidacion)}</td>
            <td>${formatDateDisplay(ciclo.entrega_cliente_inicio)}</td>
            <td>${formatDateDisplay(ciclo.pago_inicio)}</td>
            <td>${formatDateDisplay(ciclo.suspension_inicio)}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('totalCiclos').innerHTML = `<strong>Total ciclos en el mes: ${uniqueCiclos.length}</strong>`;
}

function getDateRangeForMonth(ciclos, stepName) {
    const dateFields = {
        'Consumo': ['consumo_inicio', 'consumo_fin'],
        'Transmisión DIAN': ['dian_inicio', 'dian_fin'],
        'Entrega Factura': ['entrega_cliente_inicio', 'entrega_cliente_fin'],
        'Vencimiento': ['pago_inicio', 'pago_fin'],
        'Suspensión': ['suspension_inicio', 'suspension_fin']
    };

    const [startField, endField] = dateFields[stepName] || ['', ''];
    const startDates = ciclos
        .map(c => c[startField])
        .filter(d => d)
        .sort();

    if (startDates.length === 0) return '-';

    // Solo Consumo muestra rango, el resto solo fecha inicial
    if (stepName === 'Consumo') {
        const endDates = ciclos
            .map(c => c[endField])
            .filter(d => d)
            .sort();
        if (endDates.length > 0) {
            return `${startDates[0]} a ${endDates[endDates.length - 1]}`;
        }
    }
    // DIAN, Entrega, Pago, Suspensión: solo fecha inicial
    return startDates[0];
}

function formatDateRange(start, end) {
    if (!start && !end) return '-';
    if (!start) return `hasta ${formatDateDisplay(end)}`;
    if (!end) return `desde ${formatDateDisplay(start)}`;
    if (start === end) return formatDateDisplay(start);
    return `${formatDateDisplay(start)} a ${formatDateDisplay(end)}`;
}

function formatCondensedDate(start, end) {
    if (!start && !end) return '-';
    if (!start) return `hasta ${formatDateDisplay(end)}`;
    if (!end) return `desde ${formatDateDisplay(start)}`;
    if (start === end) return formatDateDisplay(start);
    return `${formatDateDisplay(start)} a ${formatDateDisplay(end)}`;
}

function clearPage1() {
    const timelineEl = document.getElementById('monthTimeline');
    if (timelineEl) {
        timelineEl.innerHTML = '<div class="timeline-placeholder">Selecciona un mes para ver la línea de tiempo</div>';
    }
    document.getElementById('monthTableBody').innerHTML = '<tr><td colspan="9" class="empty">Carga un archivo y selecciona un mes</td></tr>';
    document.getElementById('totalCiclos').innerHTML = '';
}

// PÁGINA 2: DETALLE CICLO
function displayCicloDetail() {
    console.log('displayCicloDetail ejecutando. currentMonth:', currentMonth, 'currentCiclo:', currentCiclo);
    
    if (!currentMonth || !currentCiclo) {
        console.log('Sin mes o ciclo para mostrar');
        return;
    }

    const ciclos = allData[currentMonth] || [];
    console.log('Ciclos disponibles en', currentMonth, ':', ciclos.length);
    
    const cicloData = ciclos.find(c => String(c.ciclo) === String(currentCiclo));
    console.log('Ciclo encontrado:', cicloData);

    if (!cicloData) return;

    const template = document.getElementById('cicloDetailTemplate');
    const clone = template.content.cloneNode(true);

    // Rellenar información general
    clone.querySelector('#detail-ciclo').textContent = cicloData.ciclo;
    clone.querySelector('#detail-municipio').textContent = cicloData.municipio;
    clone.querySelector('#detail-analista').textContent = cicloData.analista;
    clone.querySelector('#detail-dias').textContent = `${cicloData.dias_facturados || '-'} días`;
    clone.querySelector('#detail-periodo').textContent = formatDateRange(
        cicloData.consumo_inicio,
        cicloData.consumo_fin
    );

    // Timeline del ciclo
    const timelineHtml = buildCicloTimeline(cicloData);
    clone.querySelector('#cicloTimeline').innerHTML = timelineHtml;
    
    // Actualizar títulos dinámicamente
    clone.querySelector('#cicloTimelineTitle').textContent = `LÍNEA DE TIEMPO DEL CICLO ${cicloData.ciclo}`;
    clone.querySelector('#cicloCalendarTitle').textContent = `CALENDARIO CICLO ${cicloData.ciclo}`;

    // Calendario - generar rango completo del mes
    // Usar lectura_actual como referencia (siempre está en el mes del ciclo)
    const referenceDate = cicloData.lectura_actual || cicloData.generacion_libro || cicloData.consumo_inicio;
    const monthStart = parseLocalDate(referenceDate);
    monthStart.setDate(1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const monthStartStr = formatDate(monthStart);
    const monthEndStr = formatDate(monthEnd);
    
    console.log('Calendario - Mes del ciclo:', monthStartStr, 'a', monthEndStr);
    
    const calendarHtml = buildCalendar(monthStartStr, monthEndStr, cicloData);
    clone.querySelector('#cicloCalendar').innerHTML = calendarHtml;

    const container = document.getElementById('cicloDetailContainer');
    container.innerHTML = '';
    container.appendChild(clone);
}

function buildCicloTimeline(cicloData) {
    const steps = [
        {
            name: 'Generación del Libro',
            icon: 'fa-file-alt',
            start: cicloData.generacion_libro,
            end: cicloData.generacion_libro,
            color: '#99841D'
        },
        {
            name: 'Lectura',
            icon: 'fa-leaf',
            start: null,
            end: cicloData.consumo_fin,
            color: '#4CAF50',
            formatType: 'onlyDate'  // Indicador especial
        },
        {
            name: 'Período Crítica',
            icon: 'fa-magnifying-glass-chart',
            start: cicloData.analisis_consumos,
            end: cicloData.analisis_consumos,
            color: '#FFA500'
        },
        {
            name: 'Liquidación',
            icon: 'fa-money-bill',
            start: cicloData.liquidacion,
            end: cicloData.liquidacion,
            color: '#34991D'
        },
        {
            name: 'Entrega Factura',
            icon: 'fa-envelope',
            start: cicloData.entrega_cliente_inicio,
            end: cicloData.entrega_cliente_inicio,
            color: '#2196F3'
        },
        {
            name: 'Vencimiento',
            icon: 'fa-credit-card',
            start: cicloData.pago_inicio,
            end: cicloData.pago_inicio,
            color: '#9C27B0'
        },
        {
            name: 'Suspensión',
            icon: 'fa-ban',
            start: cicloData.suspension_inicio,
            end: cicloData.suspension_fin,
            color: '#F44336'
        }
    ];

    let html = '';
    steps.forEach((step, idx) => {
        let dateText = formatDateRange(step.start, step.end);
        // Si es Lectura, solo mostrar la fecha sin "hasta"
        if (step.formatType === 'onlyDate' && step.end) {
            dateText = formatDateDisplay(step.end);
        }
        html += `
            <div class="timeline-step">
                <i class="fas ${step.icon}" style="background: ${step.color}"></i>
                <p>${step.name}</p>
                <small class="timeline-date">${dateText}</small>
            </div>
        `;
        if (idx < steps.length - 1) {
            html += '<div class="timeline-arrow"></div>';
        }
    });

    return html;
}

function buildDetailTable(cicloData) {
    const rows = [
        ['Ciclo', cicloData.ciclo],
        ['Municipio', cicloData.municipio],
        ['Responsable', cicloData.analista],
        ['Período Facturación', cicloData.periodo],
        ['Inicio de Consumo', formatDateDisplay(cicloData.consumo_inicio)],
        ['Fin de Consumo', formatDateDisplay(cicloData.consumo_fin)],
        ['Días Facturados', cicloData.dias_facturados || '-'],
        ['Liquidación', formatDateDisplay(cicloData.liquidacion)],
        ['Entrega Factura', formatDateDisplay(cicloData.entrega_cliente_inicio)],
        ['Vencimiento', formatDateDisplay(cicloData.pago_inicio)],
        ['Suspensión', formatDateDisplay(cicloData.suspension_inicio)]
    ];

    return rows.map(([key, val]) => `<tr><td>${key}</td><td>${val}</td></tr>`).join('');
}

function buildCalendar(startDate, endDate, cicloData) {
    console.log('buildCalendar - startDate:', startDate, 'endDate:', endDate);
    console.log('buildCalendar - cicloData fields:');
    console.log('  generacion_libro:', cicloData?.generacion_libro);
    console.log('  lectura_actual:', cicloData?.lectura_actual);
    console.log('  analisis_consumos:', cicloData?.analisis_consumos);
    console.log('  verificados:', cicloData?.verificados);
    console.log('  pago:', cicloData?.pago);
    console.log('  suspension:', cicloData?.suspension);
    
    if (!startDate || !endDate) {
        return '<p style="grid-column: 1/-1; text-align: center; color: #999;">Fechas no disponibles</p>';
    }

    // Usar parseLocalDate para evitar problemas de zona horaria
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const current = new Date(start);

    let html = '';

    // Headers día de semana
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day header">${day}</div>`;
    });

    // Agregar días vacíos al inicio del mes para alinear correctamente
    const firstDayOfWeek = start.getDay(); // 0 = domingo, 1 = lunes, etc.
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }

    // Definir todas las actividades del ciclo con colores
    const activitiesMap = {
        'Generación': { color: '#99841D', label: 'Generación del Libro' },
        'Lectura': { color: '#45B7D1', label: 'Lectura Medidores' },
        'Análisis': { color: '#FFA500', label: 'Crítica' },
        'Verificado': { color: '#7C991D', label: 'Verificados' },
        'Ingreso Verif': { color: '#6E851E', label: 'Ingreso Verificados' },
        'Liquidación': { color: '#34991D', label: 'Liquidación' },
        'Calidad': { color: '#00BCD4', label: 'Calidad Facturación' },
        'Entrega Impr': { color: '#795548', label: 'Entrega al Impresor' },
        'Entrega': { color: '#2196F3', label: 'Entrega al Cliente' },
        'Pago': { color: '#9C27B0', label: 'Vencimiento' },
        'Suspensión': { color: '#F44336', label: 'Suspensión' }
    };

    // Días del rango
    let activitiesFound = 0;
    while (current <= end) {
        // Usar formatDate en lugar de toISOString para evitar problemas de zona horaria
        const dateStr = formatDate(current);
        
        // Buscar todas las actividades que comienzan este día
        let dayActivities = [];
        
        // Para cada actividad, verificar si su fecha es HOY
        if (cicloData?.generacion_libro === dateStr) {
            dayActivities.push({ key: 'Generación', ...activitiesMap['Generación'] });
            activitiesFound++;
        }
        if (cicloData?.lectura_actual === dateStr) {
            dayActivities.push({ key: 'Lectura', ...activitiesMap['Lectura'] });
            activitiesFound++;
        }
        if (cicloData?.analisis_consumos === dateStr) {
            dayActivities.push({ key: 'Análisis', ...activitiesMap['Análisis'] });
            activitiesFound++;
        }
        if (cicloData?.verificados === dateStr) {
            dayActivities.push({ key: 'Verificado', ...activitiesMap['Verificado'] });
            activitiesFound++;
        }
        if (cicloData?.ingreso_verificados === dateStr) {
            dayActivities.push({ key: 'Ingreso Verif', ...activitiesMap['Ingreso Verif'] });
            activitiesFound++;
        }
        if (cicloData?.liquidacion === dateStr) {
            dayActivities.push({ key: 'Liquidación', ...activitiesMap['Liquidación'] });
            activitiesFound++;
        }
        if (cicloData?.calidad === dateStr) {
            dayActivities.push({ key: 'Calidad', ...activitiesMap['Calidad'] });
            activitiesFound++;
        }
        if (cicloData?.entrega_impresor === dateStr) {
            dayActivities.push({ key: 'Entrega Impr', ...activitiesMap['Entrega Impr'] });
            activitiesFound++;
        }
        if (cicloData?.entrega_cliente === dateStr) {
            dayActivities.push({ key: 'Entrega', ...activitiesMap['Entrega'] });
            activitiesFound++;
        }
        if (cicloData?.pago === dateStr) {
            dayActivities.push({ key: 'Pago', ...activitiesMap['Pago'] });
            activitiesFound++;
        }
        if (cicloData?.suspension === dateStr) {
            dayActivities.push({ key: 'Suspensión', ...activitiesMap['Suspensión'] });
            activitiesFound++;
        }

        // Construir badges de actividades
        let badgesHtml = '';
        dayActivities.forEach(activity => {
            badgesHtml += `
                <span class="activity-badge" style="background: ${activity.color}; color: white; font-size: 0.95em; padding: 4px 7px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;" title="${activity.label}">
                    ${activity.label}
                </span>
            `;
        });

        html += `
            <div class="calendar-day in-range">
                <div style="font-weight: 700; font-size: 1.4em;">${current.getDate()}</div>
                <div style="display: flex; flex-direction: column; gap: 2px; width: 100%;">
                    ${badgesHtml}
                </div>
            </div>
        `;
        current.setDate(current.getDate() + 1);
    }

    console.log('buildCalendar - Total actividades encontradas:', activitiesFound);
    return html;
}

// ============================================================================
// PÁGINA 3: CALENDARIO
// ============================================================================

// fillCalendarMonthSelector ya no es necesaria - la Página 3 usa el mes del filtro principal

function setupCalendarPage() {
    // La Página 3 usa el mes del filtro principal (monthSelect)
    // Se actualiza cuando cambia monthSelect en handleMonthChange()
}

// handleCalendarMonthChange ya no es necesaria - se usa handleMonthChange() en su lugar

function displayCalendarMonth(month) {
    const ciclos = allData[month] || [];
    
    if (ciclos.length === 0) {
        document.getElementById('calendarView').innerHTML = '<p style="color: #999;">Sin actividades en este mes</p>';
        return;
    }

    // Generar rango solo del mes seleccionado (no bimestral)
    const monthParts = month.match(/(\w+)\s+(\d{4})/);
    if (!monthParts) {
        document.getElementById('calendarView').innerHTML = '<p style="color: #999;">Formato de mes inválido</p>';
        return;
    }
    
    // Encontrar el número del mes
    const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                       'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const monthIndex = monthNames.indexOf(monthParts[1].toUpperCase());
    const year = parseInt(monthParts[2]);
    
    if (monthIndex === -1) {
        document.getElementById('calendarView').innerHTML = '<p style="color: #999;">Mes no reconocido</p>';
        return;
    }
    
    // Primer y último día del mes seleccionado
    const minDate = new Date(year, monthIndex, 1);
    const maxDate = new Date(year, monthIndex + 1, 0);

    // Generar calendario clicable
    const html = generateInteractiveCalendar(minDate, maxDate, ciclos);
    document.getElementById('calendarView').innerHTML = html;

    // Agregar listeners a los días
    document.querySelectorAll('.calendar-day-clickable').forEach(day => {
        day.addEventListener('click', function() {
            const dateStr = this.dataset.date;
            showDayDetails(dateStr, ciclos);
        });
    });
    
    // Volver a aplicar clase 'selected' si hay un día previamente seleccionado
    if (currentSelectedDay) {
        const selectedDayEl = document.querySelector(`[data-date="${currentSelectedDay}"]`);
        if (selectedDayEl) {
            selectedDayEl.classList.add('selected');
        }
    }
}

function generateInteractiveCalendar(minDate, maxDate, ciclos) {
    const current = new Date(minDate);
    let html = '<div class="calendar-grid">';
    
    // Headers de días
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        html += `<div class="calendar-header">${day}</div>`;
    });

    // Espacios vacíos al inicio
    const startDay = new Date(minDate);
    startDay.setDate(1);
    for (let i = 0; i < startDay.getDay(); i++) {
        html += '<div class="calendar-empty"></div>';
    }

    // Días del mes
    while (current <= maxDate) {
        const dateStr = formatDate(current);  // ← Usar formatDate en lugar de toISOString
        const ciclosEnDia = getCiclosForDate(dateStr, ciclos);
        const hasEvents = ciclosEnDia.length > 0;
        const isHoliday = isColombianHoliday(dateStr); // Usar función dinámica

        html += `
            <div class="calendar-day-clickable ${hasEvents ? 'has-events' : ''} ${isHoliday ? 'holiday' : ''} ${dateStr === currentSelectedDay ? 'selected' : ''}" 
                 data-date="${dateStr}"
                 title="${hasEvents ? ciclosEnDia.length + ' ciclos' : 'Sin eventos'}${isHoliday ? ' (Festivo)' : ''}">
                <div class="day-number">${current.getDate()}</div>
                ${hasEvents ? `<div class="event-count">${ciclosEnDia.length}</div>` : ''}
            </div>
        `;

        current.setDate(current.getDate() + 1);
    }

    html += '</div>';
    return html;
}

function getCiclosForDate(dateStr, ciclos) {
    // Filtrar solo ciclos que tienen una actividad específica en ese día exacto
    let ciclosEnDia = ciclos.filter(ciclo => {
        return dateStr === ciclo.generacion_libro ||
               dateStr === ciclo.lectura_anterior ||
               dateStr === ciclo.lectura_actual ||
               dateStr === ciclo.analisis_consumos ||
               dateStr === ciclo.verificados ||
               dateStr === ciclo.ingreso_verificados ||
               dateStr === ciclo.liquidacion ||
               dateStr === ciclo.calidad ||
               dateStr === ciclo.entrega_impresor ||
               dateStr === ciclo.entrega_cliente ||
               dateStr === ciclo.pago_inicio ||
               dateStr === ciclo.pago_recargo ||
               dateStr === ciclo.suspension_inicio;
    });
    
    // Filtrar por actividad seleccionada (si no es "Todos")
    if (currentActivity && currentActivity !== '') {
        ciclosEnDia = ciclosEnDia.filter(ciclo => {
            return dateStr === ciclo[currentActivity];  // ← Filtrar por actividad específica
        });
    }
    
    // Deduplicar: mostrar solo 1 vez por número de ciclo
    const ciclosUnicos = [];
    const ciclosSeen = new Set();
    
    ciclosEnDia.forEach(ciclo => {
        if (!ciclosSeen.has(ciclo.ciclo)) {
            ciclosSeen.add(ciclo.ciclo);
            ciclosUnicos.push(ciclo);
        }
    });
    
    return ciclosUnicos;
}

function isDateInRange(dateStr, startStr, endStr) {
    if (!startStr || !endStr) return false;
    const date = parseLocalDate(dateStr);
    const start = parseLocalDate(startStr);
    const end = parseLocalDate(endStr);
    return date >= start && date <= end;
}

function getStateForDate(dateStr, ciclo, filtroActividad = '') {
    // Si hay un filtro de actividad, intentar usar ese primero
    if (filtroActividad && filtroActividad !== '') {
        if (dateStr === ciclo[filtroActividad]) {
            // Devolver el estado basado en el campo filtrado
            const estadosMap = {
                'generacion_libro': { state: 'Generación del Libro', icon: 'fa-file-alt', color: '#99841D' },
                'lectura_actual': { state: 'Lectura Medidores', icon: 'fa-eye', color: '#45B7D1' },
                'lectura_anterior': { state: 'Lectura Medidores (Ant)', icon: 'fa-eye', color: '#45B7D1' },
                'analisis_consumos': { state: 'Período Crítica', icon: 'fa-magnifying-glass-chart', color: '#FFA500' },
                'verificados': { state: 'Verificados', icon: 'fa-check', color: '#7C991D' },
                'ingreso_verificados': { state: 'Ingreso Verificados', icon: 'fa-arrow-right', color: '#6E851E' },
                'liquidacion': { state: 'Liquidación', icon: 'fa-money-bill', color: '#34991D' },
                'calidad': { state: 'Calidad Facturación', icon: 'fa-check-circle', color: '#00BCD4' },
                'entrega_impresor': { state: 'Entrega al Impresor', icon: 'fa-truck', color: '#795548' },
                'entrega_cliente': { state: 'Entrega al Cliente', icon: 'fa-envelope', color: '#2196F3' },
                'pago_inicio': { state: 'Vencimiento', icon: 'fa-credit-card', color: '#9C27B0' },
                'pago_recargo': { state: 'Pago con Recargo', icon: 'fa-credit-card', color: '#673AB7' },
                'suspension_inicio': { state: 'Suspensión', icon: 'fa-ban', color: '#F44336' }
            };
            if (estadosMap[filtroActividad]) {
                return estadosMap[filtroActividad];
            }
        }
    }
    
    // Si no hay filtro o no coincide, buscar la actividad como antes
    if (dateStr === ciclo.generacion_libro) {
        return { state: 'Generación del Libro', icon: 'fa-file-alt', color: '#99841D' };
    }
    if (dateStr === ciclo.lectura_anterior) {
        return { state: 'Lectura Medidores (Ant)', icon: 'fa-eye', color: '#45B7D1' };
    }
    if (dateStr === ciclo.lectura_actual) {
        return { state: 'Lectura Medidores', icon: 'fa-eye', color: '#45B7D1' };
    }
    if (dateStr === ciclo.analisis_consumos) {
        return { state: 'Período Crítica', icon: 'fa-magnifying-glass-chart', color: '#FFA500' };
    }
    if (dateStr === ciclo.verificados) {
        return { state: 'Verificados', icon: 'fa-check', color: '#7C991D' };
    }
    if (dateStr === ciclo.ingreso_verificados) {
        return { state: 'Ingreso Verificados', icon: 'fa-arrow-right', color: '#6E851E' };
    }
    if (dateStr === ciclo.liquidacion) {
        return { state: 'Liquidación', icon: 'fa-money-bill', color: '#34991D' };
    }
    if (dateStr === ciclo.calidad) {
        return { state: 'Calidad Facturación', icon: 'fa-check-circle', color: '#00BCD4' };
    }
    if (dateStr === ciclo.entrega_impresor) {
        return { state: 'Entrega al Impresor', icon: 'fa-truck', color: '#795548' };
    }
    if (dateStr === ciclo.entrega_cliente) {
        return { state: 'Entrega al Cliente', icon: 'fa-envelope', color: '#2196F3' };
    }
    if (dateStr === ciclo.pago_inicio) {
        return { state: 'Vencimiento', icon: 'fa-credit-card', color: '#9C27B0' };
    }
    if (dateStr === ciclo.pago_recargo) {
        return { state: 'Pago con Recargo', icon: 'fa-credit-card', color: '#673AB7' };
    }
    if (dateStr === ciclo.suspension_inicio) {
        return { state: 'Suspensión', icon: 'fa-ban', color: '#F44336' };
    }
    return { state: 'Desconocido', icon: 'fa-question', color: '#999' };
}

function showDayDetails(dateStr, ciclos) {
    currentSelectedDay = dateStr;  // ← Guardar día seleccionado
    
    // Remover clase 'selected' de todos los días
    document.querySelectorAll('.calendar-day-clickable.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Agregar clase 'selected' al día clickeado
    const selectedDayEl = document.querySelector(`[data-date="${dateStr}"]`);
    if (selectedDayEl) {
        selectedDayEl.classList.add('selected');
    }
    
    // Ciclos especiales que deben resaltarse
    const ciclosEspeciales = [94, 87, 91, 75, 76, 92, 93, 89, 81, 79, 95, 77, 58];
    
    // Orden de importancia de estados (de mayor a menor)
    const estadoPrioridad = {
        'Generación del Libro': 1,
        'Lectura Medidores': 2,
        'Lectura Medidores (Ant)': 2,
        'Período Crítica': 3,
        'Análisis de Consumos': 3,
        'Verificados': 4,
        'Ingreso Verificados': 5,
        'Liquidación': 6,
        'Calidad Facturación': 7,
        'Entrega al Impresor': 8,
        'Entrega al Cliente': 9,
        'Vencimiento': 10,
        'Pago con Recargo': 11,
        'Suspensión': 12,
        'Desconocido': 13
    };
    
    let ciclosEnDia = getCiclosForDate(dateStr, ciclos);
    
    // Ordenar por importancia del estado
    ciclosEnDia.sort((a, b) => {
        const stateA = getStateForDate(dateStr, a, currentActivity).state;
        const stateB = getStateForDate(dateStr, b, currentActivity).state;
        const prioridadA = estadoPrioridad[stateA] || 99;
        const prioridadB = estadoPrioridad[stateB] || 99;
        return prioridadA - prioridadB;
    });
    
    const date = parseLocalDate(dateStr);  // ← Usar parseLocalDate en lugar de new Date
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][date.getDay()];
    
    let html = `<h3>${dayName}, ${date.getDate()} - ${ciclosEnDia.length} actividades en este día</h3>`;
    
    if (ciclosEnDia.length === 0) {
        html += '<p style="color: #999;">Sin ciclos programados</p>';
    } else {
        html += '<div class="events-list">';
        ciclosEnDia.forEach(ciclo => {
            const stateInfo = getStateForDate(dateStr, ciclo, currentActivity);
            const isEspecial = ciclosEspeciales.includes(parseInt(ciclo.ciclo));
            const styleClass = isEspecial ? 'event-item event-item-especial' : 'event-item';
            
            html += `
                <div class="${styleClass}">
                    <div class="event-header">
                        <strong>Ciclo ${ciclo.ciclo}</strong> - ${ciclo.municipio}
                    </div>
                    <div class="event-state">
                        <i class="fas ${stateInfo.icon}" style="color: ${stateInfo.color}"></i>
                        <span style="color: ${stateInfo.color}; font-weight: 600;">${stateInfo.state}</span>
                    </div>
                    <div class="event-details">
                        <small>Responsable: ${ciclo.analista}</small>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    document.getElementById('dayDetailsContainer').innerHTML = html;
}

// Función para detectar si una fecha es festivo en Colombia
function isColombianHoliday(dateStr) {
    const date = parseLocalDate(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();
    
    // Festivos fijos en Colombia
    const festivosFijos = [
        { mes: 1, dia: 1 },      // Año Nuevo
        { mes: 5, dia: 1 },      // Día del Trabajo
        { mes: 7, dia: 1 },      // San Pedro y San Pablo
        { mes: 8, dia: 7 },      // Independencia
        { mes: 8, dia: 15 },     // Asunción de María
        { mes: 10, dia: 12 },    // Descubrimiento de América
        { mes: 11, dia: 1 },     // Todos los Santos
        { mes: 11, dia: 11 },    // Independencia de Cartagena
        { mes: 12, dia: 8 },     // Inmaculada Concepción
        { mes: 12, dia: 25 }     // Navidad
    ];
    
    // Festivos que varían por año (Semana Santa, Corpus Christi, etc)
    // Se calculan basándose en la Pascua
    const festivosVariables = getEasterDependentHolidays(year);
    
    // Verificar festivos fijos
    const isFestivo = festivosFijos.some(f => f.mes === month && f.dia === day);
    
    // Verificar festivos variables
    const isFestivoVariable = festivosVariables.some(f => f.mes === month && f.dia === day);
    
    return isFestivo || isFestivoVariable;
}

// Función para calcular festivos que dependen de Pascua
function getEasterDependentHolidays(year) {
    // Cálculo simplificado de Pascua (Algoritmo de Gauss)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    // Basado en la fecha de Pascua
    const easter = new Date(year, month - 1, day);
    
    // Festivos relacionados a Pascua
    const holidays = [];
    
    // Jueves Santo (3 días antes)
    const juevesSanto = new Date(easter);
    juevesSanto.setDate(easter.getDate() - 3);
    holidays.push({ mes: juevesSanto.getMonth() + 1, dia: juevesSanto.getDate() });
    
    // Viernes Santo (2 días antes)
    const viernesSanto = new Date(easter);
    viernesSanto.setDate(easter.getDate() - 2);
    holidays.push({ mes: viernesSanto.getMonth() + 1, dia: viernesSanto.getDate() });
    
    // Lunes de Pascua (1 día después)
    const lunesPascua = new Date(easter);
    lunesPascua.setDate(easter.getDate() + 1);
    holidays.push({ mes: lunesPascua.getMonth() + 1, dia: lunesPascua.getDate() });
    
    // Ascensión (39 días después de Pascua)
    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    holidays.push({ mes: ascension.getMonth() + 1, dia: ascension.getDate() });
    
    // Corpus Christi (60 días después de Pascua)
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);
    holidays.push({ mes: corpusChristi.getMonth() + 1, dia: corpusChristi.getDate() });
    
    // Sagrado Corazón (68 días después de Pascua)
    const sagradoCorazon = new Date(easter);
    sagradoCorazon.setDate(easter.getDate() + 68);
    holidays.push({ mes: sagradoCorazon.getMonth() + 1, dia: sagradoCorazon.getDate() });
    
    return holidays;
}
    console.log('Dashboard iniciado. Cargando datos...');
});
