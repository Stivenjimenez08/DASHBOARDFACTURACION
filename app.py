from flask import Flask, render_template, jsonify
import pandas as pd
import os
import glob
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

COLUMN_MAP = {
    'CICLO': 1, 'ZONA': 2, 'ANALISTA': 3, 'MUNICIPIO': 4, 'PERIODO': 5,
    # Consumo (fechas de lectura)
    'CONSUMO_INICIO': 7, 'CONSUMO_FIN': 9, 'DIAS_FACTURADOS': 11,
    # Nuevas actividades (solo fecha de inicio = columna "Día")
    'GENERACION_LIBRO': 6,
    'LECTURA_ANTERIOR': 7,
    'LECTURA_ACTUAL': 9,
    'ANALISIS_CONSUMOS': 12,
    'VERIFICADOS': 14,
    'INGRESO_VERIFICADOS': 16,
    'LIQUIDACION': 18,
    'CALIDAD': 20,
    'ENTREGA_IMPRESOR': 22,
    'ENTREGA_CLIENTE': 24,
    'PAGO': 26,
    'PAGO_RECARGO': 28,
    'SUSPENSION': 30,
    # Mantener para backward compatibility (timeline)
    'DIAN_INICIO': 24, 'DIAN_FIN': 26,
    'ENTREGA_CLIENTE_INICIO': 24, 'ENTREGA_CLIENTE_FIN': 26,
    'PAGO_INICIO': 26, 'PAGO_FIN': 27,
    'SUSPENSION_INICIO': 30, 'SUSPENSION_FIN': 31,
    'MES_REFERENCIA': 31,  # ← Columna 32 (índice 31) con la fecha/mes
}

def excel_date_to_python(excel_date):
    if pd.isna(excel_date): return None
    if isinstance(excel_date, (datetime, pd.Timestamp)):
        return excel_date.strftime('%Y-%m-%d') if isinstance(excel_date, pd.Timestamp) else excel_date.strftime('%Y-%m-%d')
    if isinstance(excel_date, str):
        try: return pd.to_datetime(excel_date).strftime('%Y-%m-%d')
        except: return None
    try: return (datetime(1900, 1, 1) + timedelta(days=float(excel_date) - 2)).strftime('%Y-%m-%d')
    except: return None

def get_month_from_date(date_str):
    """Extrae formato MES YYYY de una fecha (ej: '2026-02-05' -> 'FEBRERO 2026')"""
    if not date_str:
        return None
    try:
        date_obj = pd.to_datetime(date_str)
        months_es = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                     'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
        return f"{months_es[date_obj.month - 1]} {date_obj.year}"
    except:
        return None

def parse_excel_file(filepath):
    """Parsea Excel consolidado - UNA SOLA HOJA con todos los meses"""
    data_by_month = {}
    
    try:
        # Detectar engine basado en extensión
        if filepath.endswith('.xls'):
            engine = 'xlrd'
        else:
            engine = 'openpyxl'
        
        # Leer archivo
        xls = pd.ExcelFile(filepath, engine=engine)
        print(f"📂 Hojas encontradas: {len(xls.sheet_names)}")
        
        # Procesar SOLO la hoja "CONSOLIDADO CRONOGRAMA"
        sheet_name = 'CONSOLIDADO CRONOGRAMA'
        
        if sheet_name not in xls.sheet_names:
            print(f"❌ No se encontró la hoja '{sheet_name}'")
            print(f"   Hojas disponibles: {xls.sheet_names}")
            return {}
        
        print(f"   Procesando hoja: {sheet_name}")
        
        try:
            # Leer hoja
            df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None, engine=engine)
            
            # Saltar headers (filas 0-5), datos desde fila 6
            if df_raw.shape[0] < 7:
                print(f"   ⚠️  Hoja con pocas filas, saltando")
                return {}
            
            df = df_raw.iloc[6:].reset_index(drop=True)
            
            ciclos_por_mes = {}  # ← Agrupado por MES_REFERENCIA (Vista 3)
            ciclos_por_generacion = {}  # ← Agrupado por GENERACIÓN (Vista 1)
            ciclos_por_actividad_mes = {}  # ← Agrupado por mes de CADA ACTIVIDAD (Vista 3 REAL)
            ciclos_vistos_por_mes = {}  # ← Para evitar duplicados por mes
            
            for idx, row in df.iterrows():
                try:
                    # Validar que hay ciclo
                    ciclo_val = row.iloc[COLUMN_MAP['CICLO']]
                    if pd.isna(ciclo_val): continue
                    
                    try: ciclo_num = int(float(ciclo_val))
                    except: continue
                    
                    # ✨ EXTRAER MES DE LA COLUMNA 32 (índice 31) - para Vista 3
                    mes_fecha = excel_date_to_python(row.iloc[COLUMN_MAP['MES_REFERENCIA']])
                    mes_referencia = get_month_from_date(mes_fecha)
                    
                    # ✨ EXTRAER MES DE GENERACIÓN - para Vista 1
                    generacion_fecha = excel_date_to_python(row.iloc[COLUMN_MAP['GENERACION_LIBRO']])
                    mes_generacion = get_month_from_date(generacion_fecha)
                    
                    if not mes_referencia:
                        print(f"   ⚠️  Ciclo {ciclo_num} sin fecha de referencia, saltando")
                        continue
                    
                    if not mes_generacion:
                        print(f"   ⚠️  Ciclo {ciclo_num} sin fecha de generación, saltando")
                        continue
                    
                    # Extraer fechas
                    consumo_inicio = excel_date_to_python(row.iloc[COLUMN_MAP['CONSUMO_INICIO']])
                    consumo_fin = excel_date_to_python(row.iloc[COLUMN_MAP['CONSUMO_FIN']])
                    
                    # Calcular días
                    dias_facturados = None
                    if consumo_inicio and consumo_fin:
                        try: dias_facturados = (pd.to_datetime(consumo_fin) - pd.to_datetime(consumo_inicio)).days
                        except: pass
                    
                    ciclo = {
                        'ciclo': ciclo_num,
                        'zona': int(row.iloc[COLUMN_MAP['ZONA']]) if pd.notna(row.iloc[COLUMN_MAP['ZONA']]) else None,
                        'analista': str(row.iloc[COLUMN_MAP['ANALISTA']]).strip() if pd.notna(row.iloc[COLUMN_MAP['ANALISTA']]) else '',
                        'municipio': str(row.iloc[COLUMN_MAP['MUNICIPIO']]).strip() if pd.notna(row.iloc[COLUMN_MAP['MUNICIPIO']]) else '',
                        'periodo': str(row.iloc[COLUMN_MAP['PERIODO']]).strip() if pd.notna(row.iloc[COLUMN_MAP['PERIODO']]) else '',
                        'consumo_inicio': consumo_inicio,
                        'consumo_fin': consumo_fin,
                        'dias_facturados': dias_facturados,
                        # Todas las actividades (solo fecha de inicio)
                        'generacion_libro': excel_date_to_python(row.iloc[COLUMN_MAP['GENERACION_LIBRO']]),
                        'lectura_anterior': excel_date_to_python(row.iloc[COLUMN_MAP['LECTURA_ANTERIOR']]),
                        'lectura_actual': excel_date_to_python(row.iloc[COLUMN_MAP['LECTURA_ACTUAL']]),
                        'analisis_consumos': excel_date_to_python(row.iloc[COLUMN_MAP['ANALISIS_CONSUMOS']]),
                        'verificados': excel_date_to_python(row.iloc[COLUMN_MAP['VERIFICADOS']]),
                        'ingreso_verificados': excel_date_to_python(row.iloc[COLUMN_MAP['INGRESO_VERIFICADOS']]),
                        'liquidacion': excel_date_to_python(row.iloc[COLUMN_MAP['LIQUIDACION']]),
                        'calidad': excel_date_to_python(row.iloc[COLUMN_MAP['CALIDAD']]),
                        'entrega_impresor': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_IMPRESOR']]),
                        'entrega_cliente': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE']]),
                        'pago': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO']]),
                        'pago_recargo': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_RECARGO']]),
                        'suspension': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION']]),
                        # Backward compatibility (para timeline y otros)
                        'dian_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['DIAN_INICIO']]),
                        'dian_fin': excel_date_to_python(row.iloc[COLUMN_MAP['DIAN_FIN']]),
                        'entrega_cliente_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE_INICIO']]),
                        'entrega_cliente_fin': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE_FIN']]),
                        'pago_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_INICIO']]),
                        'pago_fin': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_FIN']]),
                        'suspension_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION_INICIO']]),
                        'suspension_fin': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION_FIN']]),
                    }
                    
                    # ✨ AGRUPAR POR MES REFERENCIA (Vista 3 - Calendario)
                    if mes_referencia not in ciclos_por_mes:
                        ciclos_por_mes[mes_referencia] = []
                    ciclos_por_mes[mes_referencia].append(ciclo)
                    
                    # ✨ AGRUPAR POR MES GENERACIÓN (Vista 1 - Resumen Mes)
                    if mes_generacion not in ciclos_por_generacion:
                        ciclos_por_generacion[mes_generacion] = []
                    ciclos_por_generacion[mes_generacion].append(ciclo)
                    
                    # ✨ AGRUPAR POR MES DE CADA ACTIVIDAD (Vista 3 - Calendario REAL)
                    # Para cada actividad que tenga fecha, agregar ciclo a ese mes
                    actividades = {
                        'generacion_libro', 'lectura_anterior', 'lectura_actual',
                        'analisis_consumos', 'verificados', 'ingreso_verificados',
                        'liquidacion', 'calidad', 'entrega_impresor', 'entrega_cliente',
                        'pago', 'pago_recargo', 'suspension'
                    }
                    
                    for actividad in actividades:
                        fecha_actividad = ciclo.get(actividad)
                        if fecha_actividad:
                            mes_actividad = get_month_from_date(fecha_actividad)
                            if mes_actividad:
                                # Inicializar mes si no existe
                                if mes_actividad not in ciclos_por_actividad_mes:
                                    ciclos_por_actividad_mes[mes_actividad] = []
                                
                                # Evitar duplicados del mismo ciclo en el mismo mes
                                key = (mes_actividad, ciclo_num)
                                if key not in ciclos_vistos_por_mes:
                                    ciclos_por_actividad_mes[mes_actividad].append(ciclo)
                                    ciclos_vistos_por_mes[key] = True
                    
                except Exception as e:
                    continue
            
            # ✨ RETORNAR LAS 3 AGRUPACIONES
            return ciclos_por_mes, ciclos_por_generacion, ciclos_por_actividad_mes
        
        except Exception as e:
            print(f"   ❌ Error procesando hoja {sheet_name}: {str(e)}")
            import traceback
            traceback.print_exc()
            return {}
    
    except Exception as e:
        print(f"❌ Error abriendo archivo: {str(e)}")
        import traceback
        traceback.print_exc()
        return {}

CACHED_DATA = {}  # ← Por MES_REFERENCIA (Vista 3 - Calendario)
CACHED_DATA_GENERACION = {}  # ← Por GENERACIÓN del ciclo (Vista 1 - Resumen Mes)
CACHED_DATA_BY_ACTIVITY_MONTH = {}  # ← Por mes de CADA actividad (Vista 3 - Calendario REAL)

def load_excel_from_file():
    """Carga automáticamente Excel desde carpeta data/"""
    data_folder = 'data'
    
    if not os.path.exists(data_folder):
        print(f"⚠️  Carpeta '{data_folder}/' no existe")
        return False
    
    # Buscar archivos .xls o .xlsx
    excel_files = glob.glob(f'{data_folder}/*.xls*')
    
    if not excel_files:
        print(f"⚠️  No hay archivos Excel en '{data_folder}/'")
        return False
    
    # Tomar el primer archivo
    excel_path = excel_files[0]
    filename = os.path.basename(excel_path)
    print(f"\n📂 Cargando: {filename}")
    
    try:
        data_mes_ref, data_generacion, data_por_actividad = parse_excel_file(excel_path)
        CACHED_DATA.clear()
        CACHED_DATA_GENERACION.clear()
        CACHED_DATA_BY_ACTIVITY_MONTH.clear()
        CACHED_DATA_GENERACION.update(data_generacion)
        CACHED_DATA_BY_ACTIVITY_MONTH.update(data_por_actividad)  # ← Usar esta para Vista 3
        
        months_gen = list(data_generacion.keys())
        months_activity = list(data_por_actividad.keys())
        total_ciclos = sum(len(data_por_actividad[m]) for m in months_activity)
        
        print(f"\n✅ Carga exitosa:")
        print(f"   📊 Por Actividad (Vista 3): {len(months_activity)} mes(es)")
        for mes, ciclos in sorted(data_por_actividad.items()):
            print(f"      • {mes}: {len(ciclos)} ciclos")
        
        print(f"\n   📊 Por Generación (Vista 1): {len(months_gen)} mes(es)")
        for mes, ciclos in sorted(data_generacion.items()):
            print(f"      • {mes}: {len(ciclos)} ciclos")
        
        print(f"\n   📈 Total ciclos: {total_ciclos}")
        
        return True
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# Cargar al iniciar
print("="*60)
print("🚀 DASHBOARD CICLOS - MODO CONSOLIDADO")
print("="*60)
load_excel_from_file()

# ============================================================================
# RUTAS API
# ============================================================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/months')
def get_months():
    # Para Vista 1, retornar meses por generación
    return jsonify({'months': list(CACHED_DATA_GENERACION.keys()), 'total': len(CACHED_DATA_GENERACION)})

@app.route('/api/mes/<month>')
def get_month_data(month):
    # ✨ Vista 1 - Resumen Mes: Filtra por GENERACIÓN del ciclo
    if month not in CACHED_DATA_GENERACION:
        return jsonify({'error': 'No encontrado'}), 404
    ciclos = CACHED_DATA_GENERACION[month]
    return jsonify({'month': month, 'ciclos': ciclos, 'total': len(ciclos)})

@app.route('/api/mes-all/<month>')
def get_month_data_all(month):
    # ✨ Vista 3 - Calendario: Retorna ciclos agrupados por mes de CADA ACTIVIDAD
    if month not in CACHED_DATA_BY_ACTIVITY_MONTH:
        return jsonify({'error': 'No encontrado'}), 404
    ciclos = CACHED_DATA_BY_ACTIVITY_MONTH[month]
    return jsonify({'month': month, 'ciclos': ciclos, 'total': len(ciclos)})

@app.route('/api/ciclo/<month>/<int:ciclo>')
def get_ciclo_detail(month, ciclo):
    # Vista 2 y 3: Busca en datos de MES_REFERENCIA
    if month not in CACHED_DATA:
        return jsonify({'error': 'No encontrado'}), 404
    ciclo_data = next((c for c in CACHED_DATA[month] if c['ciclo'] == ciclo), None)
    if not ciclo_data:
        return jsonify({'error': 'No encontrado'}), 404
    return jsonify(ciclo_data)

@app.route('/api/timeline/<month>/<int:ciclo>')
def get_timeline(month, ciclo):
    result = get_ciclo_detail(month, ciclo)
    if result.status_code == 404:
        return result
    data = result.get_json()
    timeline = [
        {'name': 'Consumo', 'icon': 'leaf', 'start': data['consumo_inicio'], 'end': data['consumo_fin'], 'color': '#4CAF50'},
        {'name': 'Transmisión DIAN', 'icon': 'file-text', 'start': data['dian_inicio'], 'end': data['dian_fin'], 'color': '#FF9800'},
        {'name': 'Entrega Factura', 'icon': 'envelope', 'start': data['entrega_cliente_inicio'], 'end': data['entrega_cliente_fin'], 'color': '#2196F3'},
        {'name': 'Pago sin Recargo', 'icon': 'calendar', 'start': data['pago_inicio'], 'end': data['pago_fin'], 'color': '#9C27B0'},
        {'name': 'Suspensión', 'icon': 'ban', 'start': data['suspension_inicio'], 'end': data['suspension_fin'], 'color': '#F44336'}
    ]
    return jsonify({'ciclo': ciclo, 'timeline': timeline})

@app.route('/api/status')
def status():
    months = list(CACHED_DATA.keys())
    total = sum(len(CACHED_DATA[m]) for m in months) if months else 0
    return jsonify({'status': 'ok' if months else 'sin_datos', 'meses': months, 'total_ciclos': total})

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
