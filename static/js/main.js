// Variables globales
let allData = {};
let currentMonth = null;
let currentCiclo = null;

// EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('monthSelect').addEventListener('change', handleMonthChange);
    document.getElementById('cicloSelect').addEventListener('change', handleCicloChange);
    
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
        
        data.ciclos.forEach(ciclo => {
            const option = document.createElement('option');
            option.value = ciclo.ciclo;
            option.textContent = `Ciclo ${ciclo.ciclo} - ${ciclo.municipio}`;
            cicloSelect.appendChild(option);
        });

        // Actualizar página 1
        displayMonthData(data.ciclos);
    } catch (error) {
        console.error('Error loading month data:', error);
    }
}

function handleCicloChange() {
    const ciclo = parseInt(document.getElementById('cicloSelect').value);
    if (!ciclo || !currentMonth) return;

    currentCiclo = ciclo;
    updatePage1Timeline();
    displayCicloDetail();
}

function updatePage1Timeline() {
    if (!currentMonth || !currentCiclo) return;

    const ciclos = allData[currentMonth] || [];
    const cicloData = ciclos.find(c => c.ciclo === currentCiclo);

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
            end: cicloData.dian_fin,
            color: '#FF9800'
        },
        {
            name: 'Entrega Factura',
            icon: 'fa-envelope',
            start: cicloData.entrega_cliente_inicio,
            end: cicloData.entrega_cliente_fin,
            color: '#2196F3'
        },
        {
            name: 'Pago sin Recargo',
            icon: 'fa-calendar',
            start: cicloData.pago_inicio,
            end: cicloData.pago_fin,
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

    document.getElementById('monthTimeline').innerHTML = html;
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
}

// PÁGINA 1: RESUMEN DEL MES
function displayMonthData(ciclos) {
    displayMonthTimeline(ciclos);
    displayMonthTable(ciclos);
}

function displayMonthTimeline(ciclos) {
    // Mostrar hitos principales del mes
    const steps = [
        { name: 'Consumo', icon: 'fa-leaf', color: '#4CAF50' },
        { name: 'Transmisión DIAN', icon: 'fa-file-text', color: '#FF9800' },
        { name: 'Entrega Factura', icon: 'fa-envelope', color: '#2196F3' },
        { name: 'Pago sin Recargo', icon: 'fa-calendar', color: '#9C27B0' },
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

    document.getElementById('monthTimeline').innerHTML = html;
}

function displayMonthTable(ciclos) {
    const tbody = document.getElementById('monthTableBody');
    tbody.innerHTML = '';

    ciclos.forEach(ciclo => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${ciclo.ciclo}</td>
            <td>${ciclo.municipio}</td>
            <td>${ciclo.analista}</td>
            <td><strong>${ciclo.dias_facturados || '-'}</strong></td>
            <td>${formatDateRange(ciclo.consumo_inicio, ciclo.consumo_fin)}</td>
            <td>${formatDateRange(ciclo.dian_inicio, ciclo.dian_fin)}</td>
            <td>${formatDateRange(ciclo.entrega_cliente_inicio, ciclo.entrega_cliente_fin)}</td>
            <td>${formatDateRange(ciclo.pago_inicio, ciclo.pago_fin)}</td>
            <td>${formatDateRange(ciclo.suspension_inicio, ciclo.suspension_fin)}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('totalCiclos').innerHTML = `<strong>Total ciclos en el mes: ${ciclos.length}</strong>`;
}

function getDateRangeForMonth(ciclos, stepName) {
    const dateFields = {
        'Consumo': ['consumo_inicio', 'consumo_fin'],
        'Transmisión DIAN': ['dian_inicio', 'dian_fin'],
        'Entrega Factura': ['entrega_cliente_inicio', 'entrega_cliente_fin'],
        'Pago sin Recargo': ['pago_inicio', 'pago_fin'],
        'Suspensión': ['suspension_inicio', 'suspension_fin']
    };

    const [startField, endField] = dateFields[stepName] || ['', ''];
    const dates = ciclos
        .map(c => c[startField])
        .filter(d => d)
        .sort();

    if (dates.length === 0) return '-';
    return `${dates[0]} - ${dates[dates.length - 1]}`;
}

function formatDateRange(start, end) {
    if (!start && !end) return '-';
    if (!start) return `hasta ${end}`;
    if (!end) return `desde ${start}`;
    return `${start} a ${end}`;
}

function formatCondensedDate(start, end) {
    if (!start && !end) return '-';
    if (!start) return `hasta ${end}`;
    if (!end) return `desde ${start}`;
    // Si son iguales, mostrar solo una
    if (start === end) return start;
    // Si son diferentes, mostrar rango
    return `${start} a ${end}`;
}

function clearPage1() {
    document.getElementById('monthTimeline').innerHTML = '<div class="timeline-placeholder">Selecciona un mes para ver la línea de tiempo</div>';
    document.getElementById('monthTableBody').innerHTML = '<tr><td colspan="9" class="empty">Carga un archivo y selecciona un mes</td></tr>';
    document.getElementById('totalCiclos').innerHTML = '';
}

// PÁGINA 2: DETALLE CICLO
async function displayCicloDetail() {
    if (!currentMonth || !currentCiclo) return;

    const ciclos = allData[currentMonth] || [];
    const cicloData = ciclos.find(c => c.ciclo === currentCiclo);

    if (!cicloData) return;

    const template = document.getElementById('cicloDetailTemplate');
    const clone = template.content.cloneNode(true);

    // Rellenar información general
    clone.getElementById('detail-ciclo').textContent = cicloData.ciclo;
    clone.getElementById('detail-municipio').textContent = cicloData.municipio;
    clone.getElementById('detail-analista').textContent = cicloData.analista;
    clone.getElementById('detail-dias').textContent = `${cicloData.dias_facturados || '-'} días`;
    clone.getElementById('detail-periodo').textContent = formatDateRange(
        cicloData.consumo_inicio,
        cicloData.consumo_fin
    );

    // Timeline del ciclo
    const timelineHtml = buildCicloTimeline(cicloData);
    clone.getElementById('cicloTimeline').innerHTML = timelineHtml;

    // Tabla de detalles
    const detailTableHtml = buildDetailTable(cicloData);
    clone.getElementById('detailTable').innerHTML = detailTableHtml;

    // Calendario
    const calendarHtml = buildCalendar(cicloData.consumo_inicio, cicloData.consumo_fin);
    clone.getElementById('cicloCalendar').innerHTML = calendarHtml;

    const container = document.getElementById('cicloDetailContainer');
    container.innerHTML = '';
    container.appendChild(clone);
}

function buildCicloTimeline(cicloData) {
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
            end: cicloData.dian_fin,
            color: '#FF9800'
        },
        {
            name: 'Entrega Factura',
            icon: 'fa-envelope',
            start: cicloData.entrega_cliente_inicio,
            end: cicloData.entrega_cliente_fin,
            color: '#2196F3'
        },
        {
            name: 'Pago sin Recargo',
            icon: 'fa-calendar',
            start: cicloData.pago_inicio,
            end: cicloData.pago_fin,
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
        html += `
            <div class="timeline-step">
                <i class="fas ${step.icon}" style="background: ${step.color}"></i>
                <p>${step.name}</p>
                <small>${formatDateRange(step.start, step.end)}</small>
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
        ['Zona', cicloData.zona || '-'],
        ['Municipio', cicloData.municipio],
        ['Responsable', cicloData.analista],
        ['Período Facturación', cicloData.periodo],
        ['Inicio de Consumo', cicloData.consumo_inicio],
        ['Fin de Consumo', cicloData.consumo_fin],
        ['Días Facturados', cicloData.dias_facturados || '-'],
        ['Transmisión DIAN', formatCondensedDate(cicloData.dian_inicio, cicloData.dian_fin)],
        ['Entrega Factura', formatCondensedDate(cicloData.entrega_cliente_inicio, cicloData.entrega_cliente_fin)],
        ['Pago sin Recargo', formatCondensedDate(cicloData.pago_inicio, cicloData.pago_fin)],
        ['Suspensión', formatCondensedDate(cicloData.suspension_inicio, cicloData.suspension_fin)]
    ];

    return rows.map(([key, val]) => `<tr><td>${key}</td><td>${val}</td></tr>`).join('');
}

function buildCalendar(startDate, endDate) {
    if (!startDate || !endDate) {
        return '<p style="grid-column: 1/-1; text-align: center; color: #999;">Fechas no disponibles</p>';
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    let html = '';

    // Headers día de semana
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day header">${day}</div>`;
    });

    // Días del rango
    while (current <= end) {
        html += `
            <div class="calendar-day in-range">
                ${current.getDate()}
            </div>
        `;
        current.setDate(current.getDate() + 1);
    }

    return html;
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard iniciado. Cargando datos...');
    loadMonths();
});
