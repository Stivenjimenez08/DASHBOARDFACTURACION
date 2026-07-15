# 🚀 Instalar Dashboard en Google Cloud Run

## Paso 1: Preparar los Archivos

✅ Ya tienes esta carpeta con todo lo necesario:
- `app.py` - Backend
- `requirements.txt` - Dependencias
- `Dockerfile` - Instrucciones para Cloud Run
- `templates/` - HTML
- `static/` - CSS y JavaScript

## Paso 2: Subir a GitHub (Recomendado)

### Opción A: Con GitHub Desktop (más fácil)

1. Descarga GitHub Desktop: https://desktop.github.com
2. Abre la carpeta `cloud-dashboard` en tu PC
3. En GitHub Desktop: File → Add Local Repository
4. Selecciona la carpeta
5. Click "Publish Repository"
6. Elige nombre: `dashboard-ciclos`
7. Click "Publish"

### Opción B: Desde Web

1. Abre https://github.com/new
2. Nombre: `dashboard-ciclos`
3. Crear repositorio
4. Ejecuta en tu terminal:
   ```bash
   cd cloud-dashboard
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/dashboard-ciclos.git
   git push -u origin main
   ```

## Paso 3: Desplegar en Google Cloud Run

1. Abre https://console.cloud.google.com

2. En la barra de búsqueda, escribe: **Cloud Run** y haz click

3. Click en **"Crear Servicio"**

4. En "Origen del código", selecciona: **GitHub**
   - Click en "Conectar repositorio"
   - Autoriza GitHub
   - Selecciona: `dashboard-ciclos`
   - Click "Guardar"

5. Configura:
   - **Nombre del servicio**: `dashboard-ciclos`
   - **Región**: `southamerica-east1` (Argentina) o `us-central1` (EE.UU.)
   - **CPU asignada al proceso**: `1`
   - **Memoria**: `512 MB`
   - **Número máximo de instancias**: `3`
   - ✅ Permitir tráfico sin autenticación

6. Click **"Crear"**

7. ⏳ Espera 2-3 minutos...

8. ✅ ¡Listo! Obtendrás un URL tipo:
   ```
   https://dashboard-ciclos-abc123xyz.run.app
   ```

## Paso 4: Usar Tu Dashboard

1. Abre el URL en navegador
2. Click "Cargar Excel"
3. Sube tu archivo .xls o .xlsx
4. ¡Disfruta!

## 🔄 Actualizar el Dashboard

Si necesitas cambios:
1. Edita los archivos en tu PC
2. Commit y push a GitHub:
   ```bash
   git add .
   git commit -m "Actualización"
   git push
   ```
3. Cloud Run redeploya automáticamente (2-3 min)

## ⏱️ Costos

- **Primer mes**: $300 USD gratis
- **Después**: ~$0.10 USD/mes (prácticamente gratis)
- No pagas si nadie usa el dashboard

## 🆘 Si Algo Falla

**"Deploy failed"**
→ Revisa los logs en Cloud Run (pestaña "Logs")

**"Application not found"**
→ El Dockerfile tiene un problema. Contacta.

**"Port 5000 not allowed"**
→ Ya está configurado para puerto 8080 en Cloud Run ✅

---

¡Listo! 🎉 Tu dashboard está en la nube.
