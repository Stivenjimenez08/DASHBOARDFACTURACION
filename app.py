from flask import Flask, render_template, jsonify
import pandas as pd
import os
import glob
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# Mapeo de columnas para el formato consolidado (una hoja con todo)
COLUMN_MAP = {
    'CICLO': 1, 'ZONA': 2, 'ANALISTA': 3, 'MUNICIPIO': 4, 'PERIODO': 5,
    # Consumo
    'CONSUMO_INICIO': 7, 'CONSUMO_FIN': 9,
    # Actividades (solo fecha de inicio)
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
    # Backward compatibility
    'DIAN_INICIO': 24, 'DIAN_FIN': 26,
    'ENTREGA_CLIENTE_INICIO': 24, 'ENTREGA_CLIENTE_FIN': 26,
    'PAGO_INICIO': 26, 'PAGO_FIN': 27,
    'SUSPENSION_INICIO': 30, 'SUSPENSION_FIN': 31,
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

def extract_month_from_date(date_obj):
    """Extrae mes/año de una fecha (de GENERACION_LIBRO) formato: 'marzo 2026'"""
    month_names = {
        1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril', 5: 'mayo', 6: 'junio',
        7: 'julio', 8: 'agosto', 9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
    }
    try:
        if pd.isna(date_obj):
            return None
        
        parsed_date = None
        if isinstance(date_obj, pd.Timestamp):
            parsed_date = date_obj
        elif isinstance(date_obj, datetime):
            parsed_date = date_obj
        elif isinstance(date_obj, str):
            parsed_date = pd.to_datetime(date_obj)
        
        if parsed_date:
            month_name = month_names[parsed_date.month]
            year = parsed_date.year
            return f"{month_name} {year}"
        return None
    except:
        return None

def parse_excel_file_consolidated(filepath):
    """Parsea Excel consolidado (una única hoja, ciclos de múltiples meses)"""
    data_by_month = {}
    
    try:
        if filepath.endswith('.xls'):
            engine = 'xlrd'
        else:
            engine = 'openpyxl'
        
        xls = pd.ExcelFile(filepath, engine=engine)
        print(f"📂 Hojas encontradas: {len(xls.sheet_names)}")
        
        for sheet_name in xls.sheet_names:
            print(f"   Procesando: {sheet_name}")
            
            try:
                df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None, engine=engine)
                
                if df_raw.shape[0] < 7:
                    print(f"   ⚠️  Pocas filas, saltando")
                    continue
                
                # Datos desde fila 6
                df = df_raw.iloc[6:].reset_index(drop=True)
                
                ciclos_total = 0
                for idx, row in df.iterrows():
                    try:
                        ciclo_val = row.iloc[COLUMN_MAP['CICLO']]
                        if pd.isna(ciclo_val): continue
                        
                        try: ciclo_num = int(float(ciclo_val))
                        except: continue
                        
                        # Extraer mes de GENERACION_LIBRO
                        gen_libro_date = row.iloc[COLUMN_MAP['GENERACION_LIBRO']]
                        month_key = extract_month_from_date(gen_libro_date)
                        
                        if not month_key:
                            continue
                        
                        # Inicializar mes si no existe
                        if month_key not in data_by_month:
                            data_by_month[month_key] = []
                        
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
                            # Actividades
                            'generacion_libro': excel_date_to_python(gen_libro_date),
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
                            # Backward compatibility
                            'dian_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['DIAN_INICIO']]),
                            'dian_fin': excel_date_to_python(row.iloc[COLUMN_MAP['DIAN_FIN']]),
                            'entrega_cliente_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE_INICIO']]),
                            'entrega_cliente_fin': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE_FIN']]),
                            'pago_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_INICIO']]),
                            'pago_fin': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_FIN']]),
                            'suspension_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION_INICIO']]),
                            'suspension_fin': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION_FIN']]),
                        }
                        data_by_month[month_key].append(ciclo)
                        ciclos_total += 1
                    except Exception as e:
                        continue
                
                if ciclos_total > 0:
                    print(f"   ✅ {ciclos_total} ciclos cargados")
                    for month in sorted(data_by_month.keys()):
                        print(f"     • {month}: {len(data_by_month[month])} ciclos")
                else:
                    print(f"   ⚠️  Sin ciclos detectados")
            
            except Exception as e:
                print(f"   ❌ Error: {str(e)}")
                continue
        
        return data_by_month
    
    except Exception as e:
        print(f"❌ Error abriendo archivo: {str(e)}")
        return {}

CACHED_DATA = {}

def load_excel_from_file():
    """Carga Excel desde data/"""
    data_folder = 'data'
    
    if not os.path.exists(data_folder):
        print(f"⚠️  Carpeta '{data_folder}/' no existe")
        return False
    
    excel_files = glob.glob(f'{data_folder}/*.xls*')
    
    if not excel_files:
        print(f"⚠️  No hay archivos Excel en '{data_folder}/'")
        return False
    
    excel_path = excel_files[0]
    filename = os.path.basename(excel_path)
    print(f"\n📂 Cargando: {filename}")
    
    try:
        data = parse_excel_file_consolidated(excel_path)
        CACHED_DATA.clear()
        CACHED_DATA.update(data)
        
        months = list(data.keys())
        total_ciclos = sum(len(data[m]) for m in months)
        
        print(f"\n✅ Carga exitosa:")
        print(f"   - {len(months)} mes(es)")
        print(f"   - {total_ciclos} ciclos totales")
        
        for month in months:
            print(f"     • {month}: {len(data[month])} ciclos")
        
        return True
    except Exception as e:
        print(f"❌ Error: {str(e)}")
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
    return jsonify({'months': list(CACHED_DATA.keys()), 'total': len(CACHED_DATA)})

@app.route('/api/mes/<month>')
def get_month_data(month):
    if month not in CACHED_DATA:
        return jsonify({'error': 'No encontrado'}), 404
    ciclos = CACHED_DATA[month]
    return jsonify({'month': month, 'ciclos': ciclos, 'total': len(ciclos)})

@app.route('/api/ciclo/<month>/<int:ciclo>')
def get_ciclo_detail(month, ciclo):
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
