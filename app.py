from flask import Flask, render_template, jsonify, request
import pandas as pd
import os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

# Mapeo de columnas Excel (índices 0-based después de limpiar headers)
COLUMN_MAP = {
    'CICLO': 1,
    'ZONA': 2,
    'ANALISTA': 3,
    'MUNICIPIO': 4,
    'PERIODO': 5,
    'CONSUMO_INICIO': 7,
    'CONSUMO_FIN': 9,
    'DIAS_FACTURADOS': 11,
    'DIAN_INICIO': 18,
    'DIAN_FIN': 20,
    'ENTREGA_CLIENTE_INICIO': 24,
    'ENTREGA_CLIENTE_FIN': 26,
    'PAGO_INICIO': 28,  # Pago sin recargo Inicio
    'PAGO_FIN': 29,  # Pago sin recargo Fin
    'SUSPENSION_INICIO': 30,
    'SUSPENSION_FIN': 32,
}

def excel_date_to_python(excel_date):
    """Convierte fecha Excel serial a datetime"""
    if pd.isna(excel_date):
        return None
    
    # Si ya es datetime.datetime o pd.Timestamp
    if isinstance(excel_date, (datetime, pd.Timestamp)):
        if isinstance(excel_date, pd.Timestamp):
            return excel_date.strftime('%Y-%m-%d')
        else:
            return excel_date.strftime('%Y-%m-%d')
    
    # Si es string, intentar parsear
    if isinstance(excel_date, str):
        try:
            return pd.to_datetime(excel_date).strftime('%Y-%m-%d')
        except:
            return None
    
    # Si es número (serial de Excel)
    try:
        num_date = float(excel_date)
        return (datetime(1900, 1, 1) + timedelta(days=num_date - 2)).strftime('%Y-%m-%d')
    except:
        return None

def parse_excel_file(filepath):
    """Parsea archivo Excel y retorna datos estructurados por mes"""
    data_by_month = {}
    
    try:
        xls = pd.ExcelFile(filepath)
        
        for sheet_name in xls.sheet_names:
            # Leer sin headers primero para ubicar correctamente
            df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
            
            # Fila 6 (índice 5) es la última fila de headers
            # Fila 7 (índice 6) es la primera fila de datos reales
            df = df_raw.iloc[6:].reset_index(drop=True)
            
            ciclos = []
            for idx, row in df.iterrows():
                try:
                    ciclo_val = row.iloc[COLUMN_MAP['CICLO']]
                    if pd.isna(ciclo_val):
                        continue
                    
                    # Intentar convertir a int
                    try:
                        ciclo_num = int(float(ciclo_val))
                    except (ValueError, TypeError):
                        continue
                    
                    consumo_inicio = excel_date_to_python(row.iloc[COLUMN_MAP['CONSUMO_INICIO']])
                    consumo_fin = excel_date_to_python(row.iloc[COLUMN_MAP['CONSUMO_FIN']])
                    
                    # Calcular días facturados
                    dias_facturados = None
                    if consumo_inicio and consumo_fin:
                        try:
                            d_inicio = pd.to_datetime(consumo_inicio)
                            d_fin = pd.to_datetime(consumo_fin)
                            dias_facturados = (d_fin - d_inicio).days
                        except:
                            pass
                    
                    ciclo = {
                        'ciclo': ciclo_num,
                        'zona': int(row.iloc[COLUMN_MAP['ZONA']]) if pd.notna(row.iloc[COLUMN_MAP['ZONA']]) else None,
                        'analista': str(row.iloc[COLUMN_MAP['ANALISTA']]).strip() if pd.notna(row.iloc[COLUMN_MAP['ANALISTA']]) else '',
                        'municipio': str(row.iloc[COLUMN_MAP['MUNICIPIO']]).strip() if pd.notna(row.iloc[COLUMN_MAP['MUNICIPIO']]) else '',
                        'periodo': str(row.iloc[COLUMN_MAP['PERIODO']]).strip() if pd.notna(row.iloc[COLUMN_MAP['PERIODO']]) else '',
                        'consumo_inicio': consumo_inicio,
                        'consumo_fin': consumo_fin,
                        'dias_facturados': dias_facturados,
                        'dian_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['DIAN_INICIO']]),
                        'dian_fin': excel_date_to_python(row.iloc[COLUMN_MAP['DIAN_FIN']]),
                        'entrega_cliente_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE_INICIO']]),
                        'entrega_cliente_fin': excel_date_to_python(row.iloc[COLUMN_MAP['ENTREGA_CLIENTE_FIN']]),
                        'pago_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_INICIO']]),
                        'pago_fin': excel_date_to_python(row.iloc[COLUMN_MAP['PAGO_FIN']]),
                        'suspension_inicio': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION_INICIO']]),
                        'suspension_fin': excel_date_to_python(row.iloc[COLUMN_MAP['SUSPENSION_FIN']]),
                    }
                    
                    ciclos.append(ciclo)
                except Exception as e:
                    continue
            
            if ciclos:
                data_by_month[sheet_name] = ciclos
        
        return data_by_month
    
    except Exception as e:
        print(f"Error parsing Excel: {str(e)}")
        return {}

# Cache global para datos
CACHED_DATA = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Carga y parsea archivo Excel"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith(('.xls', '.xlsx')):
        return jsonify({'error': 'Only Excel files allowed'}), 400
    
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        data = parse_excel_file(filepath)
        CACHED_DATA.clear()
        CACHED_DATA.update(data)
        
        months = list(data.keys())
        return jsonify({'success': True, 'months': months})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/months')
def get_months():
    """Retorna lista de meses disponibles"""
    months = list(CACHED_DATA.keys())
    return jsonify({'months': months})

@app.route('/api/mes/<month>')
def get_month_data(month):
    """Retorna todos los ciclos de un mes"""
    if month not in CACHED_DATA:
        return jsonify({'error': 'Month not found'}), 404
    
    ciclos = CACHED_DATA[month]
    return jsonify({'month': month, 'ciclos': ciclos, 'total': len(ciclos)})

@app.route('/api/ciclo/<month>/<int:ciclo>')
def get_ciclo_detail(month, ciclo):
    """Retorna detalle de un ciclo específico"""
    if month not in CACHED_DATA:
        return jsonify({'error': 'Month not found'}), 404
    
    ciclo_data = next((c for c in CACHED_DATA[month] if c['ciclo'] == ciclo), None)
    if not ciclo_data:
        return jsonify({'error': 'Ciclo not found'}), 404
    
    return jsonify(ciclo_data)

@app.route('/api/timeline/<month>/<int:ciclo>')
def get_timeline(month, ciclo):
    """Retorna hitos clave para timeline"""
    ciclo_data = get_ciclo_detail(month, ciclo)
    if ciclo_data.status_code == 404:
        return ciclo_data
    
    data = ciclo_data.get_json()
    
    timeline = [
        {
            'name': 'Consumo',
            'icon': 'leaf',
            'start': data['consumo_inicio'],
            'end': data['consumo_fin'],
            'color': '#4CAF50'
        },
        {
            'name': 'Transmisión DIAN',
            'icon': 'file-text',
            'start': data['dian_inicio'],
            'end': data['dian_fin'],
            'color': '#FF9800'
        },
        {
            'name': 'Entrega Factura',
            'icon': 'envelope',
            'start': data['entrega_cliente_inicio'],
            'end': data['entrega_cliente_fin'],
            'color': '#2196F3'
        },
        {
            'name': 'Pago sin Recargo',
            'icon': 'calendar',
            'start': data['pago_inicio'],
            'end': data['pago_fin'],
            'color': '#9C27B0'
        },
        {
            'name': 'Suspensión',
            'icon': 'ban',
            'start': data['suspension_inicio'],
            'end': data['suspension_fin'],
            'color': '#F44336'
        }
    ]
    
    return jsonify({'ciclo': ciclo, 'timeline': timeline})

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
