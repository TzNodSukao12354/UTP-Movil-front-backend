# 🚀 Cómo prender UTP Móvil — paso a paso

> **Contexto rápido**: Render corre tu backend en la nube (conectado a GitHub).
> Supabase es tu base de datos en la nube. El teléfono conecta a Render, no a tu PC.
> **No necesitas hacer push a GitHub cada vez** — Render ya tiene el código desplegado y corriendo.

---

## PASO 1 — Verificar Render (backend en la nube)

1. Abre en el navegador: **https://dashboard.render.com**
2. Inicia sesión si pide login.
3. En la lista de servicios busca **utpmovil-backend** → haz clic en él.
4. Arriba a la derecha verás el estado. Debe decir 🟢 **Live**.

**Si dice "Suspended" o no carga:**
- Haz clic en el botón **Resume** (aparece si está pausado por inactividad).
- Luego espera ~1–2 minutos hasta que vuelva a decir **Live**.

**Si dice algo raro en los logs:**
- Haz clic en la pestaña **Logs** (barra lateral izquierda).
- Busca errores rojos. El más común: `password authentication failed` → avisa.

> ⚠️ **Render NO necesita que hagas push a GitHub** para funcionar si ya estaba Live antes. Solo haces push cuando cambias el código.

**Verificación rápida** (abre PowerShell y pega esto):
```powershell
Invoke-WebRequest https://utpmovil-backend.onrender.com/health -TimeoutSec 90
```
Debe responder: `{"status":"ok"}` con código 200.

---

## PASO 2 — Verificar la base de datos (Supabase)

1. Abre en el navegador: **https://supabase.com/dashboard**
2. Inicia sesión → verás la lista de tus proyectos.
3. Haz clic en el proyecto (busca algo como **utpmovil** o **postgres**).
4. En la barra lateral izquierda verás el menú. El proyecto simplemente debe estar activo (no te pide activarlo manualmente como Neon).

**Verificar las 8 tablas:**
1. En la barra lateral izquierda haz clic en **SQL Editor** (ícono de terminal/código).
2. Haz clic en **+ New query**.
3. Pega esto y presiona **Run** (botón verde arriba a la derecha, o Ctrl+Enter):
```sql
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';
```
4. Debe dar **8**.

> ⚠️ **NUNCA corras** `001_ocho_tablas.sql` — borra todos los datos de la app.

---

## PASO 3 — IP local (solo si el teléfono usa backend local)

> Si el teléfono usa Render (URL `https://utpmovil-backend.onrender.com`), **salta este paso**. La URL de Render no cambia aunque cambies de WiFi.

Solo haz esto si `frontend/.env` tiene una IP local tipo `192.168.x.x`:

1. Abre **PowerShell** y ejecuta:
```powershell
ipconfig
```
2. Busca la sección de tu WiFi → copia el valor de **Dirección IPv4** (ej: `192.168.1.45`).
3. Abre el archivo `frontend/.env` en el proyecto.
4. Cambia la línea:
```
EXPO_PUBLIC_API_URL=http://192.168.1.45:8080
```
(reemplaza con tu IP nueva).

---

## PASO 4 — Backend local (OPCIONAL — normalmente no lo necesitas)

> Si Render está **Live**, **no necesitas correr el backend local**. Sáltate este paso.

Solo si quieres correr el backend en tu PC:
1. Abre una terminal en la raíz del proyecto.
2. Ejecuta:
```powershell
cd backend
npm start
```
3. Deja esa terminal abierta (no la cierres).
4. Verifica en otra terminal:
```powershell
Invoke-WebRequest http://localhost:8080/health
```
Debe responder `{"status":"ok"}`.

---

## PASO 5 — Iniciar el frontend (Expo)

1. Abre una terminal en la raíz del proyecto.
2. Ejecuta:
```powershell
cd frontend
npm run dev
```
3. Aparece un QR en la terminal.
4. Abre **Expo Go** en tu teléfono y escanea el QR.

**Si el teléfono no carga (error de red):**
- Detén con `Ctrl+C`.
- Ejecuta el túnel en su lugar:
```powershell
npm run tunnel
```
- Escanea el nuevo QR que aparece.

---

## Resumen — Lo que haces cada vez que trabajas

| # | Dónde | Qué hacer | ¿Obligatorio? |
|---|-------|-----------|---------------|
| 1 | Render (web) | Confirmar 🟢 **Live** | ✅ Sí |
| 2 | Supabase (web) | Confirmar **Active** + 8 tablas | ✅ Sí |
| 3 | `frontend/.env` | Actualizar IP si cambiaste WiFi | Solo si usas backend local |
| 4 | Terminal | `cd backend && npm start` | ❌ No (Render lo hace por ti) |
| 5 | Terminal | `cd frontend && npm run dev` | ✅ Sí |

---

## ¿Cuándo hago push a GitHub?

Solo cuando **cambiaste código** y quieres que Render lo despliegue:
1. Haz commit de tus cambios en VS Code.
2. Haz push a la rama conectada (`main` o la que configuraste).
3. Render detecta el push automáticamente y despliega solo.
4. Espera que vuelva a decir **Live** antes de probar.

> Si solo quieres **usar** la app sin cambiar código → no necesitas tocar GitHub.
