# DASHBOARDFACTURACION

Dashboard de agenda de facturación (EDEQ). Backend en Flask, frontend en JavaScript vanilla.

## Instalación local

```bash
python -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Configura las variables de entorno copiando la plantilla:

```bash
cp .env.example .env
```

Coloca tu archivo Excel de cronograma dentro de la carpeta `data/` (o la que definas en `DATA_FOLDER` dentro de `.env`).

Ejecuta el servidor:

```bash
python app.py
```

Por defecto queda disponible en `http://localhost:5000`.

## Variables de entorno

| Variable      | Descripción                                  | Valor por defecto |
|---------------|-----------------------------------------------|--------------------|
| `DATA_FOLDER` | Carpeta donde se busca el Excel de datos      | `data`             |
| `HOST`        | Host donde corre el servidor Flask            | `0.0.0.0`          |
| `PORT`        | Puerto del servidor Flask                     | `5000`             |
| `FLASK_DEBUG` | Modo debug (solo desarrollo, nunca producción)| `False`            |
