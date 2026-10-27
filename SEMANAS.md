# 📅 Bitácora del Proyecto UTP Móvil (Por Semanas)

Este documento resume paso a paso el avance del proyecto, semana por semana, para que tengas claro qué se construyó, qué problemas se resolvieron y cómo defender el desarrollo ante cualquier revisión o sustentación académica.

---

## 📌 Resumen General del Proyecto
**UTP Móvil** es una red social móvil orientada a la comunidad universitaria de la UTP (estudiantes y docentes), compuesta por:
- **Backend:** Node.js con Express, Socket.io (chat en tiempo real) y base de datos relacional PostgreSQL (Neon Tech), desplegado en Render.
- **Frontend Móvil:** React Native con Expo Router, arquitectura moderna, soporte para Android e iOS (iPhone) con diseño oscuro.

---

## 🗓️ SEMANA 1 — Fundamentos, Base de Datos y Arquitectura Base

### 🎯 Objetivo
Definir la arquitectura del sistema, inicializar los repositorios, diseñar la base de datos relacional y levantar el entorno de desarrollo.

### 🛠️ Lo que se hizo:
1. **Modelado de Datos (PostgreSQL):**
   - Se diseñó el esquema relacional con las 8 tablas esenciales: `usuarios`, `publicaciones`, `comentarios`, `reacciones`, `seguidores`, `mensajes`, `conversaciones` y `sesiones`.
   - Se configuró la base de datos en la nube usando **Neon Tech (PostgreSQL serverless)**.
2. **Estructura del Proyecto (Monorepo simple):**
   - Separación estricta entre `/backend` (servidor API REST) y `/frontend` (aplicación móvil Expo).
3. **Puesta en marcha del Backend:**
   - Creación del servidor Express (`index.js`).
   - Configuración de variables de entorno (`.env`) para no quemar contraseñas en el código.
   - Endpoint de salud (`/health`) para comprobar que el servidor responde.

---

## 🗓️ SEMANA 2 — Autenticación Universitaria y Seguridad

### 🎯 Objetivo
Garantizar que solo alumnos con correo institucional de la UTP (`uXXXXXXXX@utp.edu.pe`) puedan registrarse y acceder a la plataforma.

### 🛠️ Lo que se hizo:
1. **Filtro Estricto de Correo Institucional:**
   - Validación mediante expresiones regulares (`^u\d{8}@utp\.edu\.pe$`) tanto en frontend como en backend.
2. **Flujo OTP (Código de Verificación):**
   - Pantalla de solicitud de código (`/verificar-correo`).
   - Generación de código temporal aleatorio de 6 dígitos que expira en 5 minutos.
   - Conexión con servicio de envío de correos y respaldo académico (`123456`) para pruebas rápidas sin depender de demoras externas.
3. **Registro por Pasos (Onboarding):**
   - Pantallas modulares de elección: Selección de carrera (`/carrera`), género (`/genero`), intereses académicos/hobbies (`/intereses`) y creación de contraseña con encriptación **bcrypt**.
4. **Inicio de Sesión y Manejo de Tokens:**
   - Endpoint `/api/auth/login` con generación de sesiones persistentes guardadas localmente en `AsyncStorage`.

---

## 🗓️ SEMANA 3 — Feed de Inicio (Estilo Facebook) y Módulo Multimedia

### 🎯 Objetivo
Construir el muro principal universitario donde los estudiantes comparten contenido académico, avisos y novedades.

### 🛠️ Lo que se hizo:
1. **Feed Universitario (`InicioFeed.jsx`):**
   - Lista dinámica de publicaciones con scroll infinito y pull-to-refresh.
   - Soporte para tarjetas con texto, imágenes y etiquetas.
2. **Interacciones Sociales:**
   - Sistema de reacciones/likes conectado a la tabla `reacciones` de PostgreSQL.
   - Sección de comentarios por publicación (`comentar.jsx`) en tiempo real.
3. **Subida de Archivos Multimedia:**
   - Integración con almacenamiento en la nube (Supabase Storage / Cloudinary) para alojar fotos y avatares sin sobrecargar la base de datos.

---

## 🗓️ SEMANA 4 — Shorts (Videos Cortos) y Chat en Vivo (Estilo WhatsApp)

### 🎯 Objetivo
Añadir formatos modernos de video vertical e interacción directa entre estudiantes.

### 🛠️ Lo que se hizo:
1. **Módulo de Shorts (`shorts.jsx`):**
   - Reproductor de video vertical a pantalla completa con `expo-video`.
   - Control de reproducción inteligente: bucle automático, barra de progreso y pausa automática al cambiar de pestaña.
2. **Chat en Tiempo Real (`chat.jsx`):**
   - Conexión persistente mediante WebSockets (`Socket.io`).
   - Mensajería instantánea uno a uno: envío, recepción y guardado en la base de datos.
   - Pantalla de búsqueda de alumnos y contactos por nombre o código.
3. **Paginador Horizontal Principal (`inicio.jsx`):**
   - Contenedor con `ScrollView` horizontal y `pagingEnabled` con barra deslizante animada para alternar entre Inicio, Shorts, Chat, Notificaciones y Perfil.

---

## 🗓️ SEMANA 5 — Estabilización, Soporte iOS (iPhone), Tema Oscuro y Despliegue

### 🎯 Objetivo
Resolver incompatibilidades de plataforma móvil, perfeccionar la interfaz gráfica y asegurar el despliegue en producción.

### 🛠️ Lo que se hizo:
1. **Despliegue del Backend en la Nube:**
   - Backend configurado en **Render** (`https://utpmovil-backend.onrender.com`), activo 24/7 y enlazado con Neon PostgreSQL.
2. **Compatibilidad y Solución para iPhone (iOS):**
   - Vinculación del proyecto con EAS y cuenta Expo (`tznodsuko` / Project ID `dbc32970-1799-4534-af0a-5eaa6e5296b6`).
   - Corrección de script de arranque local ([start-lan.js](file:///c:/Users/samir/Visual%20Studio/JS%20AVANZADA/copilot-worktrees/UTP-Movil-front-backend/tznodsukao12354-urban-couscous/frontend/scripts/start-lan.js)) con inyección automática de credenciales seguras.
3. **Solución del Crash de Navegación en Shorts:**
   - Creación del hook `useSafeIsFocused` para evitar el error `Couldn't find a navigation object` cuando `ShortsScreen` corre incrustado como tab.
4. **Diseño Visual Premium y Corrección de Destellos Blancos:**
   - Unificación de fondo oscuro (`#050505`) en todo el ciclo de vida de la app.
   - Corrección de [ThemeContext.jsx](file:///c:/Users/samir/Visual%20Studio/JS%20AVANZADA/copilot-worktrees/UTP-Movil-front-backend/tznodsukao12354-urban-couscous/frontend/context/ThemeContext.jsx) para iniciar en modo oscuro por defecto.
   - Animación de transición suave (`fade_from_bottom`) en el navegador raíz ([app/_layout.jsx](file:///c:/Users/samir/Visual%20Studio/JS%20AVANZADA/copilot-worktrees/UTP-Movil-front-backend/tznodsukao12354-urban-couscous/frontend/app/_layout.jsx)).
