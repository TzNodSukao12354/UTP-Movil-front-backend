# 🧠 Guía Práctica del Proyecto: ¿Qué hace cada carpeta y archivo?
*(Explicado de compa a compa, en lenguaje claro y sin rodeos)*

---

## 💡 1. ¿De qué trata este proyecto?

Imagínate juntar **Facebook, TikTok y WhatsApp** en una sola app, pero **exclusiva para estudiantes de la UTP**.

- No entra cualquiera: para crearte cuenta tienes que tener correo institucional `@utp.edu.pe`.
- Tienes tu muro de publicaciones para enterarte de cosas de la universidad (estilo Facebook).
- Tienes tus Shorts para ver videos grabados por otros alumnos (estilo TikTok).
- Tienes tus chats directos para hablar con compañeros (estilo WhatsApp).
- Tienes tu perfil universitario con tu carrera, ciclo, bio y foto.

El proyecto se divide en dos mundos:
1. **El Backend:** El servidor que vive en internet (en Render), conectado a la base de datos (PostgreSQL en Neon). Es el cerebro que guarda usuarios, contraseñas, mensajes y fotos.
2. **El Frontend:** La aplicación que instalas y ves en la pantalla del celular (hecha con React Native y Expo). Es la cara bonita con la que interactúas.

---

## 📂 2. Estructura General del Proyecto

```text
UTP-Movil-front-backend/
├── backend/          <- El servidor (Node.js + Express + Base de Datos)
├── frontend/         <- La app del celular (React Native + Expo Router)
├── GUIA_EJECUCION.md <- Pasos para prender el sistema
├── SEMANAS.md        <- Bitácora de qué se hizo semana por semana
└── render.yaml       <- Configuración para subir el backend a la nube (Render)
```

---

## 🏢 3. La Carpeta `backend/` (El Servidor)

Aquí no hay botones ni colores. Solo hay código que recibe datos, los valida y los guarda en la base de datos.

### Archivos y carpetas dentro de `backend/`:

* **`index.js` (El Jefe del Backend):**  
  Es el archivo más importante de esta carpeta. Levanta el servidor Express, escucha las peticiones de los celulares y contiene las rutas principales:
  - Validar si un correo UTP existe.
  - Enviar códigos de verificación OTP de 6 dígitos.
  - Registrar nuevos alumnos y encriptar contraseñas con bcrypt.
  - Iniciar sesión y entregar tokens.
  - Guardar y leer publicaciones, comentarios y likes.

* **`db.js` (El Puente con la Base de Datos):**  
  Se encarga de conectar el servidor con PostgreSQL (Neon Tech) usando la variable `DATABASE_URL`. Cada vez que el backend necesita leer o guardar algo, pasa por aquí.

* **`migrations/` (Los Planos de la Base de Datos):**  
  Contiene los scripts SQL originales.
  - `001_ocho_tablas.sql`: El plano donde se crearon las 8 tablas de la base de datos (`usuarios`, `publicaciones`, `reacciones`, `comentarios`, `mensajes`, `conversaciones`, etc.).

* **`controllers/`, `routes/`, `middleware/`, `services/`:**  
  Módulos organizados para separar la lógica por áreas (autenticación, publicaciones, control de accesos y seguridad).

* **`sockets/` (El Chat en Vivo):**  
  Usa **Socket.io** para que los mensajes entre dos alumnos lleguen al instante sin necesidad de que recarguen la pantalla.

* **`.env` (El Guardián de Secretos):**  
  Guarda las contraseñas de la base de datos, llaves de correo y puertos. Este archivo **nunca** se sube a GitHub para proteger la seguridad.

---

## 📱 4. La Carpeta `frontend/` (La Aplicación Móvil)

Aquí está todo lo que se toca y se ve en la pantalla de tu iPhone o Android.

### 📁 `frontend/app/` (Las Pantallas de la App)
Expo Router funciona por archivos: cada archivo dentro de esta carpeta se convierte automáticamente en una pantalla.

* **`_layout.jsx` (El Esqueleto Raíz):**  
  Es el contenedor maestro de toda la app. Aquí definimos que el fondo sea negro puro (`#050505`), que la barra de estado de arriba se vea clara y que la transición entre pantallas sea suave (`fade_from_bottom`). También revisa si ya tienes sesión iniciada para no mandarte al login otra vez.

* **Pantallas de Registro y Autenticación:**
  - `login.jsx`: Pantalla inicial para poner usuario/correo y contraseña.
  - `verificar-correo.jsx`: Pide tu correo `@utp.edu.pe` y te manda el código.
  - `verificar-codigo.jsx`: Pantalla con 6 casillas para poner el código recibido.
  - `carrera.jsx`: Lista para elegir qué carrera estudias en la UTP.
  - `genero.jsx`: Elección de género del estudiante.
  - `intereses.jsx`: Etiquetas con tus intereses académicos y gustos.
  - `crear-cuenta.jsx`: Paso final donde defines tu contraseña.

* **`inicio/inicio.jsx` (El Centro de Mando):**  
  Es la pantalla principal que ves al entrar. Tiene un menú inferior con 5 iconos y te permite deslizar horizontalmente entre las secciones:
  1. **Inicio:** El muro de publicaciones universitarias (`InicioFeed.jsx`).
  2. **Shorts:** Pantalla completa de videos cortos (`shorts.jsx`).
  3. **Chat:** Mensajería estilo WhatsApp (`chat/chat.jsx`).
  4. **Notificaciones:** Avisos de la app (`funciones/[seccion].jsx`).
  5. **Perfil:** Tu perfil universitario (`perfil/perfil.jsx`).

* **`shorts.jsx` (Módulo de Videos Cortos):**  
  Usa `expo-video` para reproducir videos en bucle vertical. Incluye una barra de progreso que avanza con el video, botón de opciones y pausa inteligente cuando te vas a otra pestaña.

* **`perfil/perfil.jsx` y `perfil/EditarPerfil.jsx`:**  
  Muestra tu información personal, foto de perfil, estado de ánimo actual, publicaciones y comunidades a las que perteneces. Te permite editar tu biografía y cambiar tu avatar.

---

### 📁 Otras Carpetas Clave de `frontend/`:

* **`components/` (Piezas Reutilizables):**  
  Cosas que se usan en varios lugares para no repetir código: botones, tarjetas de publicaciones, avatares y modales.

* **`context/` (La Memoria Compartida):**  
  Guarda información global que varias pantallas necesitan a la vez:
  - `ThemeContext.jsx`: Controla el tema oscuro (negro `#050505`).
  - `FeedContext.jsx`: Guarda las publicaciones cargadas para no pedirlas a cada rato al servidor.
  - `ChatContext.jsx`: Maneja el socket activo y los mensajes nuevos del chat.

* **`utils/api.js` (El Mensajero del Frontend):**  
  Función centralizada para hacer peticiones (`fetch`) hacia el backend en Render. Se encarga de poner la URL correcta y adjuntar el token de sesión.

* **`scripts/start-lan.js` (El Arrancador Inteligente):**  
  Script que corre cuando pones `npm run dev`. Detecta automáticamente la IP Wi-Fi de tu computadora para que tu celular pueda conectarse sin configurar nada a mano.

* **`app.json` (El DNI de la App):**  
  Contiene el nombre de la app (`UTPMovilApp`), iconos, versión, permisos de Android e iOS, y el ID del proyecto en Expo (`dbc32970-1799-4534-af0a-5eaa6e5296b6`).

---

## 🔄 5. ¿Cómo funciona todo junto? (Un Ejemplo Real)

1. Abres la app en tu celular y pones tu correo `u12345678@utp.edu.pe`.
2. El celular le manda esa petición por internet al **Backend en Render**.
3. El backend le pregunta a la **Base de Datos en Neon**: *"¿Este correo ya existe?"*.
4. Si no existe, genera un código (ej. `482910`), te lo envía y la app te manda a la pantalla de validación.
5. Pones el código, la app lo valida y te permite completar tu perfil.
6. Una vez dentro de `inicio.jsx`, puedes deslizar a los Shorts o al Chat, y todo se mantiene rápido, fluido y con diseño oscuro.
