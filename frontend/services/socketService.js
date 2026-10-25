// =============================================================
// services/socketService.js
//
// Singleton del cliente Socket.IO.
// Toda la app usa la misma conexión a través de este módulo.
// Cuando el servidor cambie de dirección, solo se cambia SOCKET_URL.
// =============================================================

import { io } from "socket.io-client";
import { API_URL } from "../utils/api";

export const SOCKET_URL = API_URL;

let socket = null;
let socketToken = null;
const feedListeners = new Set();
const feedEvents = [
  "feed:post-creado",
  "feed:post-actualizado",
  "feed:post-eliminado",
  "feed:comentario-nuevo",
  "feed:reaccion",
];

function forwardFeedEvents(connection) {
  feedEvents.forEach((event) => {
    connection.on(event, (payload) => {
      feedListeners.forEach((listener) => listener(event, payload));
    });
  });
}

/**
 * Inicia la conexión con el servidor.
 * Si ya hay una conexión activa, la devuelve sin crear otra.
 * @returns {Socket}
 */
export function conectar(token) {
  if (!token) throw new Error("Se necesita una sesión para conectar el chat.");
  if (!SOCKET_URL) {
    throw new Error("Falta configurar EXPO_PUBLIC_API_URL con la dirección pública del backend.");
  }
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socketToken = token;
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: { token },
    });
    forwardFeedEvents(socket);

    socket.on("connect", () =>
      console.log("[socket] conectado:", socket.id)
    );
    socket.on("disconnect", (reason) =>
      console.log("[socket] desconectado:", reason)
    );
    socket.on("connect_error", (err) =>
      console.warn("[socket] error de conexión:", err.message)
    );
  }
  return socket;
}

export function suscribirFeed(listener) {
  feedListeners.add(listener);
  return () => feedListeners.delete(listener);
}

/**
 * Devuelve el socket activo (o null si no se ha conectado).
 * @returns {Socket|null}
 */
export function getSocket() {
  return socket;
}

/**
 * Cierra la conexión y limpia la instancia.
 */
export function desconectar() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}
