# Reinicio destructivo: esquema de ocho tablas

`001_ocho_tablas.sql` elimina todas las tablas del esquema `public` y crea exactamente ocho: usuarios, perfiles, publicaciones/shorts, relaciones, chats, mensajes, notificaciones y sesiones. Elimina cuentas, publicaciones, mensajes y cualquier otro dato que esté en esas tablas.

Los comentarios, reacciones, guardados, etiquetas y reportes de publicaciones, así como participantes, reacciones, lecturas, adjuntos y reportes de mensajes, se almacenan en columnas JSONB para respetar el límite de ocho tablas. Esto cubre las funciones principales de la aplicación; no replica todas las funciones ni la escala de Facebook, Instagram o WhatsApp.

El backend debe estar adaptado a este esquema antes de ejecutar el reinicio. La migración no se ejecuta al arrancar el servidor. Confirma que el destino sea la base correcta y conserva un respaldo antes de aplicarla.

## Publicar el backend gratis

El archivo `render.yaml` configura un servicio Node gratuito en Render con una URL fija y el endpoint `/health` como comprobación de estado. El servicio gratuito puede pausarse cuando no recibe tráfico; al volver a abrir la app puede tardar en despertar. Las conexiones Socket.IO funcionan mientras el servicio está activo.

1. Crea una base PostgreSQL gratuita en Neon y copia su cadena de conexión.
2. En el editor SQL de la base Neon recién creada, ejecuta `001_ocho_tablas.sql` una sola vez. El script borra las tablas que ya existan en `public`; no lo vuelvas a ejecutar después de comenzar a guardar datos.
3. En Render, crea un Blueprint desde este repositorio y completa `DATABASE_URL`, `BREVO_API_KEY` y `EMAIL_USER` en el panel. No guardes estos valores en Git.
4. Cuando Render asigne la URL del backend, configura `EXPO_PUBLIC_API_URL` con esa dirección en el entorno de Expo/EAS antes del siguiente build.
