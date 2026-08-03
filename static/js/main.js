// Variables globales
let allData = {};
let currentMonth = null;
let currentCiclo = null;
let currentActivity = '';
let currentSelectedDay = null;

// ============================================================================
// FUNCIONES PARA MANEJO DE FECHAS
// ============================================================================

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('monthSelect').addEventListener('change', handleMonthChange);
    
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pageNum = this.dataset.page;
            switchPage(pageNum);
        });
    });
    
    loadMonths();
});

// ============================================================================
// CARGAR MESES
// ============================================================================

async function loadMonths() {
    try {
        const response = await fetch('/api/months');
        const data = await response.json();

        const select = document.getElementById('monthSelect');
        select.innerHTML = '<option value="">-- Seleccionar mes --</option>';

        // Ordenar meses cronológicamente
        const monthOrder = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
            'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        };
        
        const sortedMonths = [...data.months].sort((a, b) => {
            const [monthA, yearA] = a.split(' ');
            const [monthB, yearB] = b.split(' ');
            const yearDiff = parseInt(yearA) - parseInt(yearB);
            if (yearDiff !== 0) return yearDiff;
            return (monthOrder[monthA.toLowerCase()] || 0) - (monthOrder[monthB.toLowerCase()] || 0);
        });

        sortedMonths.forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = month;
            select.appendChild(option);
        });
        
        // Ocultar selectores por defecto
        const cicloSelectorGroup = document.getElementById('cicloSelect').closest('.selector-group');
        cicloSelectorGroup.style.display = 'none';
        const activitySelectorGroup = document.getElementById('activitySelectorGroup');
        if (activitySelectorGroup) {
            activitySelectorGroup.style.display = 'none';
        }
        
        // Cargar todos los meses en memoria
        for (const month of sortedMonths) {
            try {
                const res = await fetch(`/api/mes/${month}`);
                const monthData = await res.json();
                allData[month] = monthData.ciclos;
            } catch (e) {
                console.error(`Error loading month ${month}:`, e);
            }
        }
        
    } catch (error) {
        console.error('Error loading months:', error);
    }
}

// ============================================================================
// CAMBIAR MES
// ============================================================================

async function handleMonthChange() {
    const month = document.getElementById('monthSelect').value;
    if (!month) {
        document.getElementById('cicloSelect').innerHTML = '<option value="">-- Seleccionar ciclo --</option>';
        clearAllPages();
        return;
    }

    currentMonth = month;
    currentCiclo = null;

    try {
        // Cargar datos del mes seleccionado
        if (!allData[month]) {
            const response = await fetch(`/api/mes/${month}`);
            const data = await response.json();
            allData[month] = data.ciclos;
        }

        // Llenar selector de ciclos
        const cicloSelect = document.getElementById('cicloSelect');
        cicloSelect.innerHTML = '<option value="">-- Seleccionar ciclo --</option>';
        
        // Deduplicar ciclos
        const ciclosSeen = new Set();
        const uniqueCiclos = [];
        
        allData[month].forEach(ciclo => {
            if (!ciclosSeen.has(ciclo.ciclo)) {
                ciclosSeen.add(ciclo.ciclo);
                uniqueCiclos.push(ciclo);
            }
        });
        
        // Ordenar ciclos
        uniqueCiclos.sort((a, b) => parseInt(a.ciclo) - parseInt(b.ciclo));
        
        // Agregar opciones
        uniqueCiclos.forEach(ciclo => {
            const option = document.createElement('option');
            option.value = ciclo.ciclo;
            option.textContent = ciclo.ciclo;
            cicloSelect.appendChild(option);
        });

        // Agregar listener
        cicloSelect.removeEventListener('change', handleCicloChange);
        cicloSelect.addEventListener('change', handleCicloChange);

        // Auto-seleccionar primer ciclo
        if (uniqueCiclos.length > 0) {
            cicloSelect.value = String(uniqueCiclos[0].ciclo);
            currentCiclo = String(uniqueCiclos[0].ciclo);
            displayCicloDetail();
        }

        // Actualizar página 1 (Resumen)
        displayMonthData(allData[month]);
        
        // Actualizar página 3 (Calendario)
        displayCalendarMonth(month);
        
        // Setup selector de actividades
        const activitySelect = document.getElementById('activitySelect');
        if (activitySelect) {
            activitySelect.removeEventListener('change', handleActivityChange);
            activitySelect.addEventListener('change', handleActivityChange);
        }

    } catch (error) {
        console.error('Error loading month data:', error);
    }
}

function handleActivityChange() {
    const activitySelect = document.getElementById('activitySelect');
    if (activitySelect) {
        currentActivity = activitySelect.value;
        displayCalendarMonth(currentMonth);
        if (currentSelectedDay) {
            showDayDetails(currentSelectedDay, allData[currentMonth]);
        }
    }
}

function handleCicloChange() {
    const ciclo = document.getElementById('cicloSelect').value;
    if (!ciclo) return;
    if (!currentMonth) return;

    currentCiclo = ciclo;
    displayCicloDetail();
}

// ============================================================================
// PÁGINA 1: RESUMEN DEL MES
// ============================================================================

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

function displayMonthTable(ciclos) {
    const tbody = document.getElementById('monthTableBody');
    if (!tbody) {
        console.error('monthTableBody no encontrado');
        return;
    }
    
    tbody.innerHTML = '';

    const ciclosEspeciales = [94, 87, 91, 75, 76, 92, 93, 89, 81, 79, 95, 77, 58];

    // Deduplicar ciclos
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
        
        if (ciclosEspeciales.includes(parseInt(ciclo.ciclo))) {
            row.classList.add('ciclo-especial');
        }
        
        row.innerHTML = `
            <td>${ciclo.ciclo}</td>
            <td>${ciclo.municipio}</td>
            <td>${ciclo.analista}</td>
            <td><strong>${ciclo.dias_facturados || '-'}</strong></td>
            <td>${formatDateDisplay(ciclo.consumo_fin)}</td>
            <td>${formatDateDisplay(ciclo.analisis_consumos)}</td>
            <td>${formatDateDisplay(ciclo.liquidacion)}</td>
            <td>${formatDateDisplay(ciclo.entrega_cliente_inicio)}</td>
            <td>${formatDateDisplay(ciclo.pago_inicio)}</td>
            <td>${formatDateDisplay(ciclo.suspension_inicio)}</td>
        `;
        tbody.appendChild(row);
    });

    const totalEl = document.getElementById('totalCiclos');
    if (totalEl) {
        totalEl.innerHTML = `<strong>Total ciclos en el mes: ${uniqueCiclos.length}</strong>`;
    }
}

// ============================================================================
// PÁGINA 2: DETALLE DEL CICLO
// ============================================================================

function displayCicloDetail() {
    if (!currentMonth || !currentCiclo) return;

    const ciclos = allData[currentMonth] || [];
    const cicloData = ciclos.find(c => String(c.ciclo) === String(currentCiclo));

    if (!cicloData) {
        console.error('Ciclo no encontrado:', currentCiclo);
        return;
    }

    const detailContainer = document.getElementById('cicloDetailContainer');
    if (!detailContainer) {
        console.error('cicloDetailContainer no encontrado');
        return;
    }

    let html = '<div class="detail-section">';
    
    // INFO CARDS
    html += '<h2 class="section-title">INFORMACIÓN GENERAL DEL CICLO</h2>';
    html += '<div class="info-cards">';
    
    html += '<div class="info-card"><i class="fas fa-list-check"></i><div>';
    html += '<div class="label">Ciclo</div><div class="value">' + cicloData.ciclo + '</div></div></div>';
    
    html += '<div class="info-card"><i class="fas fa-map-marker-alt"></i><div>';
    html += '<div class="label">Municipios</div><div class="value">' + (cicloData.municipio || '-') + '</div></div></div>';
    
    html += '<div class="info-card"><i class="fas fa-user-tie"></i><div>';
    html += '<div class="label">Responsable</div><div class="value">' + (cicloData.analista || '-') + '</div></div></div>';
    
    html += '<div class="info-card"><i class="fas fa-calendar-days"></i><div>';
    html += '<div class="label">Días Facturados</div><div class="value">' + (cicloData.dias_facturados || '-') + '</div></div></div>';
    
    html += '<div class="info-card"><i class="fas fa-hourglass-end"></i><div>';
    html += '<div class="label">Período</div><div class="value">' + (cicloData.periodo || '-') + '</div></div></div>';
    
    html += '</div>';

    // TIMELINE
    html += '<h2 class="section-title">LÍNEA DE TIEMPO DEL CICLO SELECCIONADO</h2>';
    html += '<div id="cicloTimeline" class="timeline-container"></div>';

    // CALENDARIO
    html += '<h2 class="section-title">DÍAS FACTURADOS (CONSUMO)</h2>';
    html += '<div id="cicloCalendar" class="calendar-container"></div>';
    
    html += '</div>';

    detailContainer.innerHTML = html;
    
    // Actualizar timeline y calendario después de renderizar
    updatePage2Timeline();
    displayCicloCalendar();
}

function updatePage2Timeline() {
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
            icon: 'fa-credit-card',
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
        const isComplete = step.start && step.end;
        const startDate = step.start ? formatDateDisplay(step.start) : '-';
        const endDate = step.end ? formatDateDisplay(step.end) : '-';

        html += `
            <div class="timeline-step ${isComplete ? 'complete' : 'incomplete'}">
                <div class="timeline-marker" style="background-color: ${step.color};">
                    <i class="fas ${step.icon}"></i>
                </div>
                <div class="timeline-content">
                    <h4>${step.name}</h4>
                    <p>${startDate} → ${endDate}</p>
                </div>
            </div>
        `;
    });

    const timelineEl = document.getElementById('cicloTimeline');
    if (timelineEl) {
        timelineEl.innerHTML = html;
    }
}

function displayCicloCalendar() {
    if (!currentMonth || !currentCiclo) return;

    const ciclos = allData[currentMonth] || [];
    const cicloData = ciclos.find(c => String(c.ciclo) === String(currentCiclo));

    if (!cicloData || !cicloData.consumo_inicio || !cicloData.consumo_fin) return;

    const minDate = parseLocalDate(cicloData.consumo_inicio);
    const maxDate = parseLocalDate(cicloData.consumo_fin);

    if (!minDate || !maxDate) return;

    const html = generateCicloCalendar(minDate, maxDate, cicloData);
    const calendarContainer = document.getElementById('cicloCalendar');
    if (calendarContainer) {
        calendarContainer.innerHTML = html;
    }
}

function generateCicloCalendar(minDate, maxDate, cicloData) {
    const current = new Date(minDate);
    let html = '<div class="calendar-grid">';
    
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        html += `<div class="calendar-header">${day}</div>`;
    });

    const startDay = new Date(minDate);
    startDay.setDate(1);
    for (let i = 0; i < startDay.getDay(); i++) {
        html += '<div class="calendar-empty"></div>';
    }

    while (current <= maxDate) {
        const dateStr = formatDate(current);
        const isInRange = isDateInRange(dateStr, cicloData.consumo_inicio, cicloData.consumo_fin);
        
        html += `
            <div class="calendar-day-clickable ${isInRange ? 'has-events' : ''}" 
                 title="${isInRange ? 'Día de consumo' : 'Fuera del rango'}">
                <div class="day-number">${current.getDate()}</div>
            </div>
        `;

        current.setDate(current.getDate() + 1);
    }

    html += '</div>';
    return html;
}

// ============================================================================
// PÁGINA 3: CALENDARIO DE ACTIVIDADES
// ============================================================================

function displayCalendarMonth(month) {
    const ciclos = allData[month] || [];
    
    if (ciclos.length === 0) {
        document.getElementById('calendarView').innerHTML = '<p style="color: #999;">Sin ciclos en este mes</p>';
        return;
    }

    const monthParts = month.match(/(\w+)\s+(\d{4})/);
    if (!monthParts) {
        document.getElementById('calendarView').innerHTML = '<p style="color: #999;">Formato de mes inválido</p>';
        return;
    }
    
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const monthIndex = monthNames.indexOf(monthParts[1].toLowerCase());
    const year = parseInt(monthParts[2]);
    
    if (monthIndex === -1) {
        document.getElementById('calendarView').innerHTML = '<p style="color: #999;">Mes no reconocido</p>';
        return;
    }
    
    const minDate = new Date(year, monthIndex, 1);
    const maxDate = new Date(year, monthIndex + 1, 0);

    const html = generateInteractiveCalendar(minDate, maxDate, ciclos);
    document.getElementById('calendarView').innerHTML = html;

    document.querySelectorAll('.calendar-day-clickable').forEach(day => {
        day.addEventListener('click', function() {
            const dateStr = this.dataset.date;
            showDayDetails(dateStr, ciclos);
        });
    });
    
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
    
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        html += `<div class="calendar-header">${day}</div>`;
    });

    const startDay = new Date(minDate);
    startDay.setDate(1);
    for (let i = 0; i < startDay.getDay(); i++) {
        html += '<div class="calendar-empty"></div>';
    }

    while (current <= maxDate) {
        const dateStr = formatDate(current);
        const ciclosEnDia = getCiclosForDate(dateStr, ciclos);
        const hasEvents = ciclosEnDia.length > 0;

        html += `
            <div class="calendar-day-clickable ${hasEvents ? 'has-events' : ''} ${dateStr === currentSelectedDay ? 'selected' : ''}" 
                 data-date="${dateStr}"
                 title="${hasEvents ? ciclosEnDia.length + ' ciclos' : 'Sin eventos'}">
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
               dateStr === ciclo.pago ||
               dateStr === ciclo.pago_recargo ||
               dateStr === ciclo.suspension;
    });
    
    if (currentActivity && currentActivity !== '') {
        ciclosEnDia = ciclosEnDia.filter(ciclo => {
            return dateStr === ciclo[currentActivity];
        });
    }
    
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

function getStateForDate(dateStr, ciclo) {
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
    if (dateStr === ciclo.pago) {
        return { state: 'Pago sin Recargo', icon: 'fa-credit-card', color: '#9C27B0' };
    }
    if (dateStr === ciclo.pago_recargo) {
        return { state: 'Pago con Recargo', icon: 'fa-credit-card', color: '#673AB7' };
    }
    if (dateStr === ciclo.suspension) {
        return { state: 'Suspensión', icon: 'fa-ban', color: '#F44336' };
    }
    return { state: 'Desconocido', icon: 'fa-question', color: '#999' };
}

function showDayDetails(dateStr, ciclos) {
    currentSelectedDay = dateStr;
    
    document.querySelectorAll('.calendar-day-clickable.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    const selectedDayEl = document.querySelector(`[data-date="${dateStr}"]`);
    if (selectedDayEl) {
        selectedDayEl.classList.add('selected');
    }
    
    const ciclosEnDia = getCiclosForDate(dateStr, ciclos);
    const date = parseLocalDate(dateStr);
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][date.getDay()];
    
    let html = `<h3>${dayName}, ${date.getDate()} - ${ciclosEnDia.length} ciclos en este día</h3>`;
    
    if (ciclosEnDia.length === 0) {
        html += '<p style="color: #999;">Sin ciclos programados</p>';
    } else {
        html += '<div class="events-list">';
        ciclosEnDia.forEach(ciclo => {
            const stateInfo = getStateForDate(dateStr, ciclo);
            html += `
                <div class="event-item">
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

// ============================================================================
// SWITCH PAGES
// ============================================================================

function switchPage(pageNum) {
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    const selectedPage = document.getElementById('page' + pageNum);
    if (selectedPage) {
        selectedPage.style.display = 'block';
    }

    document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-page="${pageNum}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Mostrar/ocultar selectores según página
    const monthSelect = document.getElementById('monthSelect');
    const cicloSelect = document.getElementById('cicloSelect');
    const activitySelectorGroup = document.getElementById('activitySelectorGroup');
    
    if (pageNum === '1') {
        cicloSelect.closest('.selector-group').style.display = 'none';
        if (activitySelectorGroup) activitySelectorGroup.style.display = 'none';
    } else if (pageNum === '2') {
        cicloSelect.closest('.selector-group').style.display = 'block';
        if (activitySelectorGroup) activitySelectorGroup.style.display = 'none';
    } else if (pageNum === '3') {
        cicloSelect.closest('.selector-group').style.display = 'none';
        if (activitySelectorGroup) activitySelectorGroup.style.display = 'block';
    }
}

function clearAllPages() {
    const tbody = document.getElementById('monthTableBody');
    if (tbody) tbody.innerHTML = '';
    
    const detailContainer = document.getElementById('cicloDetailContainer');
    if (detailContainer) detailContainer.innerHTML = '';
    
    const calendarView = document.getElementById('calendarView');
    if (calendarView) calendarView.innerHTML = '';
}
