# Carpeta de Datos

Coloca aquí tu archivo Excel mensual.

**Nombre recomendado:**
- `Ciclos_2026.xls`
- `Facturacion_Julio.xls`
- O cualquier nombre con extensión `.xls` o `.xlsx`

El dashboard cargará automáticamente el primer archivo encontrado.

## ¿Cómo actualizar cada mes?

1. Descarga/prepara tu Excel mensual
2. Coloca el archivo aquí en carpeta `data/`
3. Haz commit y push a GitHub:
   ```bash
   git add data/*.xls*
   git commit -m "Actualización mes XX"
   git push
   ```
4. Cloud Run se redeploya automáticamente (2-3 minutos)
5. ¡El dashboard muestra los datos nuevos!

