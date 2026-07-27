from flask import Flask, render_template, jsonify
import pandas as pd
import os
import glob
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

COLUMN_MAP = {
    'CICLO': 1, 'ZONA': 2, 'ANALISTA': 3, 'MUNICIPIO': 4, 'PERIODO': 5,
    # Generación del Libro (Col 7)
    'GENERACION_LIBRO': 6,
    # Lectura de medidores Anterior (Col 8)
    'LECTURA_ANTERIOR': 7,
    # Lectura de medidores Actual (Col 10)
    'LECTURA_ACTUAL': 9,
    # Días consumo (Col 12) - ya viene calculado
    'DIAS_CONSUMO': 11,
    # Análisis de consumos (Col 13)
    'ANALISIS_CONSUMOS': 12,
    # Verificados (Col 15)
    'VERIFICADOS': 14,
    # Ingreso de verificados (Col 17)
    'INGRESO_VERIFICADOS': 16,
    # Liquidación (Col 19)
    'LIQUIDACION': 18,
    # Calidad facturación (Col 21)
    'CALIDAD': 20,
    # Entrega al Impresor (Col 23)
    'ENTREGA_IMPRESOR': 22,
    # Entrega al Cliente (Col 25)
    'ENTREGA_CLIENTE': 24,
    # Pago sin recargo (Col 27)
    'PAGO': 26,
    # Pago con recargo (Col 29)
    'PAGO_RECARGO': 28,
    # Suspensión del servicio (Col 31)
    'SUSPENSION': 30,
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

def parse_excel_file(filepath):
    """Parsea Excel con soporte para múltiples hojas y formatos"""
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
        
        for sheet_idx, sheet_name in enumerate(xls.sheet_names):
            print(f"   Procesando hoja {sheet_idx + 1}: {sheet_name}")
            
            try:
                # Leer hoja
                df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None, engine=engine)
                
                # Saltar headers (filas 0-5), datos desde fila 6
                if df_raw.shape[0] < 7:
                    print(f"   ⚠️  Hoja con pocas filas, saltando")
                    continue
                
                df = df_raw.iloc[6:].reset_index(drop=True)
                
                ciclos = []
                for idx, row in df.iterrows():
                    try:
                        # Validar que hay ciclo
                        ciclo_val = row.iloc[COLUMN_MAP['CICLO']]
                        if pd.isna(ciclo_val): continue
                        
                        try: ciclo_num = int(float(ciclo_val))
                        except: continue
                        
                        # Extraer fechas
                        consumo_inicio = excel_date_to_python(row.iloc[COLUMN_MAP['LECTURA_ACTUAL']])
                        consumo_fin = excel_date_to_python(row.iloc[COLUMN_MAP['LECTURA_ACTUAL']])
                        
                        # Usar días que ya vienen calculados en el Excel
                        dias_facturados = row.iloc[COLUMN_MAP['DIAS_CONSUMO']]
                        if pd.isna(dias_facturados):
                            dias_facturados = None
                        else:
                            try: dias_facturados = int(dias_facturados)
                            except: dias_facturados = None
                        
                        ciclo = {
                            'ciclo': ciclo_num,
                            'zona': int(row.iloc[COLUMN_MAP['ZONA']]) if pd.notna(row.iloc[COLUMN_MAP['ZONA']]) else None,
                            'analista': str(row.iloc[COLUMN_MAP['ANALISTA']]).strip() if pd.notna(row.iloc[COLUMN_MAP['ANALISTA']]) else '',
                            'municipio': str(row.iloc[COLUMN_MAP['MUNICIPIO']]).strip() if pd.notna(row.iloc[COLUMN_MAP['MUNICIPIO']]) else '',
                            'periodo': str(row.iloc[COLUMN_MAP['PERIODO']]).strip() if pd.notna(row.iloc[COLUMN_MAP['PERIODO']]) else '',
                            # Consumo (de Lectura Actual)
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
                            # Mantener para backward compatibility
                            'dian_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE']]),
                            'dian_fin': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE']]),
                            'entrega_cliente_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE']]),
                            'entrega_cliente_fin': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE']]),
                            # Pagos
                            'pago_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO']]),
                            'pago_fin': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO']]),
                            'pago_recargo_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_RECARGO']]),
                            'pago_recargo_fin': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_RECARGO']]),
                            # Suspensión
                            'suspension_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION']]),
                            'suspension_fin': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION']]),
                        }
                        ciclos.append(ciclo)
                    except Exception as e:
                        continue
                
                if ciclos:
                    data_by_month[sheet_name] = ciclos
                    print(f"   ✅ {len(ciclos)} ciclos cargados")
                else:
                    print(f"   ⚠️  Sin ciclos en esta hoja")
            
            except Exception as e:
                print(f"   ❌ Error en hoja {sheet_name}: {str(e)}")
                continue
        
        return data_by_month
    
    except Exception as e:
        print(f"❌ Error abriendo archivo: {str(e)}")
        return {}

CACHED_DATA = {}

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
        data = parse_excel_file(excel_path)
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
print("🚀 DASHBOARD CICLOS - MODO AUTOMÁTICO")
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
