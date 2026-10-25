// =============================================================
// sockets/chatSocket.js
// =============================================================

const chatService = require("../services/chatService");
const pool = require("../db");

const usuariosConectados = new Map();
// ── Lista de palabras censuradas ──────────────────────────────
const PALABRAS_CENSURADAS = [
  "conchetumadre",
  "conchatumare",
  "hijo de puta",
  "malparido",
  "puta",
  "idiota",
  "basura",
  "estupido",
  "perro",
  "maricon",
  "pendejo",
  "cagon de mierda",
  "mierda",
  "puto",
  "huevon",
  "puta madre",
  "carajo",
  "cabro",
  "wueon",
  "sonzo",
  "tarado",
  "imbecil",
  "baboso",
  "mongol",
  "cojudo",
  "gil",
  "tarao",
  "atorrante",
  "me llegas al pincho",
  "desahuevate",
  "rosquete",
  "pastrulo",
  "pastelero",
  "drogo",
  "fumon",
  "fumeque",
  "marihuanero",
  "chupapinga",
  "mostro",
  "careperro",
  "caremuerto",
  "cachudo",
  "venado",
  "terruco",
];

function censurar(texto) {
  let resultado = texto;
  PALABRAS_CENSURADAS.forEach((palabra) => {
    const regex = new RegExp(palabra, "gi");
    resultado = resultado.replace(regex, "*".repeat(palabra.length));
  });
  return resultado;
}

function esUserIdValido(userId) {
  return typeof userId === "string" && /^U\d{8}$/.test(userId);
}

function esChatIdValido(chatId) {
  const id = Number(chatId);
  return Number.isSafeInteger(id) && id > 0;
}

module.exports = function registrarSocketsChat(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Inicia sesión para usar el chat."));

    try {
      const result = await pool.query(
        `SELECT u.codigo_usu, u.username
         FROM sesiones s
         JOIN usuarios u ON u.codigo_usu = s.codigo_usu
         WHERE s.token = $1
           AND s.activo = true
           AND u.estado = 'activo'
           AND (s.fecha_expiracion IS NULL OR s.fecha_expiracion > NOW())`,
        [token]
      );
      if (!result.rows.length) return next(new Error("La sesión no es válida. Inicia sesión nuevamente."));
      socket.data.userId = result.rows[0].codigo_usu;
      socket.data.nombre = result.rows[0].username;
      next();
    } catch (err) {
      console.error("[socket auth] Error validando sesión:", err.message);
      next(new Error("No se pudo validar la sesión del chat."));
    }
  });

  io.on("connection", (socket) => {
    console.log(`[socket] conectado: ${socket.id}`);

    socket.on("usuario:conectar", async () => {
      const { userId, nombre } = socket.data;
      socket.data.userId = userId;
      socket.data.nombre = nombre;
      usuariosConectados.set(socket.id, { userId, nombre });

      try {
        await chatService.actualizarPresencia(userId, true);
      } catch (err) {
        console.error(`[usuario:conectar] Error actualizando presencia:`, err.message);
      }

      socket.broadcast.emit("presencia:cambio", {
        userId,
        nombre,
        estado: "En línea",
      });

      try {
        const chats = await chatService.getChatsDeUsuario(userId);
        socket.emit("chat:listar", { chats });
      } catch (err) {
        console.error(`[usuario:conectar] Error listando chats:`, err.message);
      }

      console.log(`[socket] usuario conectado: ${nombre} (${userId})`);
    });

    socket.on("chat:unirse", async ({ chatId }) => {
      try {
        if (!esChatIdValido(chatId)
          || !esUserIdValido(socket.data.userId)
          || !await chatService.esMiembroActivoDeChat(chatId, socket.data.userId)) {
          socket.emit("chat:error", { mensaje: "No tienes acceso a esta conversación." });
          return;
        }
        const rooms = [...socket.rooms].filter(
          (r) => r !== socket.id && r.startsWith("chat_")
        );
        rooms.forEach((r) => socket.leave(r));

        socket.join(`chat_${chatId}`);
        socket.data.chatActivo = chatId;

        const mensajes = await chatService.getMensajes(chatId);
        socket.emit("mensajes:historial", { chatId, mensajes });

        console.log(`[socket] ${socket.data.nombre} unido a chat_${chatId}`);
      } catch (err) {
        console.error(`[chat:unirse] Error:`, err.message);
        socket.emit("chat:error", { mensaje: "No se pudo cargar esta conversación." });
      }
    });

    socket.on("mensaje:enviar", async ({ chatId, texto }) => {
      if (typeof texto !== "string" || !texto.trim() || !esChatIdValido(chatId)) return;

      try {
        const userId = socket.data.userId;
        if (!esUserIdValido(userId)
          || String(socket.data.chatActivo) !== String(chatId)
          || !await chatService.esMiembroActivoDeChat(chatId, userId)) {
          socket.emit("chat:error", { mensaje: "No tienes acceso a esta conversación." });
          return;
        }
        const mensaje = await chatService.guardarMensaje({
          chatId,
          texto: censurar(texto.trim()),
          remitenteId: userId,
          remitente: socket.data.nombre,
        });

        io.to(`chat_${chatId}`).emit("mensaje:nuevo", mensaje);
      } catch (err) {
        console.error(`[mensaje:enviar] Error:`, err.message);
      }
    });

    socket.on("escribiendo:inicio", ({ chatId }) => {
      if (String(socket.data.chatActivo) !== String(chatId)) return;
      socket.to(`chat_${chatId}`).emit("escribiendo", {
        chatId,
        userId: socket.data.userId,
        nombre: socket.data.nombre,
        escribiendo: true,
      });
    });

    socket.on("escribiendo:fin", ({ chatId }) => {
      if (String(socket.data.chatActivo) !== String(chatId)) return;
      socket.to(`chat_${chatId}`).emit("escribiendo", {
        chatId,
        userId: socket.data.userId,
        nombre: socket.data.nombre,
        escribiendo: false,
      });
    });

    socket.on("mensaje:marcarVisto", async ({ chatId }) => {
      const userId = socket.data.userId;
      if (!esChatIdValido(chatId) || !await chatService.esMiembroActivoDeChat(chatId, userId)) return;
      try {
        await chatService.marcarMensajeVisto({ chatId, userId });
        socket.to(`chat_${chatId}`).emit("mensaje:visto", { chatId, userId });
      } catch (err) {
        console.error("[mensaje:marcarVisto] Error:", err.message);
      }
    });

    // ── Reportar mensaje ─────────────────────────────────────
    socket.on("mensaje:reportar", async ({ msgId, chatId }) => {
      const reporterId = socket.data.userId;
      if (!esChatIdValido(chatId)
        || String(socket.data.chatActivo) !== String(chatId)
        || !await chatService.esMiembroActivoDeChat(chatId, reporterId)) return;
      try {
        const resultado = await chatService.reportarMensaje({ msgId, chatId, reporterId });

        if (resultado.eliminado) {
          io.to(`chat_${chatId}`).emit("mensaje:eliminado", {
            msgId,
            chatId,
            textoReemplazado: "⚠️ Mensaje eliminado por límite de reportes",
          });
        } else {
          socket.emit("reporte:confirmado", { msgId, reportes: resultado.reportes });
        }
      } catch (err) {
        console.error("[mensaje:reportar] Error:", err.message);
      }
    });

    // ── Eliminar mensaje ─────────────────────────────────────────
    socket.on("mensaje:eliminar", async ({ msgId, chatId, paraTodos }) => {
      const userId = socket.data.userId;
      try {
        if (!esChatIdValido(chatId)
          || String(socket.data.chatActivo) !== String(chatId)
          || !await chatService.esMiembroActivoDeChat(chatId, userId)) return;
        if (!paraTodos) {
          socket.emit("mensaje:eliminadoPorUsuario", {
            msgId,
            chatId,
            texto: "🗑️ Mensaje eliminado",
            soloYo: true,
          });
          return;
        }
        const deleted = await chatService.eliminarMensaje({ msgId, chatId, userId });
        if (!deleted) {
          socket.emit("chat:error", { mensaje: "Solo puedes eliminar tus propios mensajes para todos." });
          return;
        }
        io.to(`chat_${chatId}`).emit("mensaje:eliminadoPorUsuario", {
          msgId,
          chatId,
          texto: "🗑️ Mensaje eliminado",
        });
      } catch (err) {
        console.error("[mensaje:eliminar] Error:", err.message);
        socket.emit("chat:error", { mensaje: "No se pudo eliminar el mensaje." });
      }
    });

    // ── Reaccionar a mensaje ─────────────────────────────────────
    socket.on("mensaje:reaccionar", async ({ msgId, chatId, emoji }) => {
      try {
        const authenticatedUserId = socket.data.userId;
        if (!esChatIdValido(chatId)
          || String(socket.data.chatActivo) !== String(chatId)
          || !await chatService.esMiembroActivoDeChat(chatId, authenticatedUserId)) return;
        const { count, quitar } = await chatService.reaccionarMensaje({ msgId, userId: authenticatedUserId, emoji });
        io.to(`chat_${chatId}`).emit("mensaje:reaccion", {
          msgId, chatId, emoji, count, quitar,
        });
      } catch (err) {
        console.error("[mensaje:reaccionar] Error:", err.message);
      }
    });

    // ── Crear chat privado ────────────────────────────────────────
    socket.on("chat:crear", async ({ userId2 }) => {
      const userId1 = socket.data.userId;
      if (!esUserIdValido(userId1) || !esUserIdValido(userId2)) {
        socket.emit("chat:error", { mensaje: "No se encontró ese usuario." });
        return;
      }
      try {
        const chatId = await chatService.obtenerOCrearChatPrivado(userId1, userId2);
        socket.emit("chat:creado", { chatId });
        const chats = await chatService.getChatsDeUsuario(userId1);
        socket.emit("chat:listar", { chats });
      } catch (err) {
        console.error("[chat:crear] Error:", err.message);
        socket.emit("chat:error", { mensaje: err.message || "No se pudo crear el chat" });
      }
    });

    // ── Desconexión ───────────────────────────────────────────────
    socket.on("disconnect", async () => {
      const { userId, nombre } = socket.data;
      usuariosConectados.delete(socket.id);

      const sigueConectado = [...usuariosConectados.values()].some(
        (usuario) => String(usuario.userId) === String(userId),
      );
      if (userId && esUserIdValido(userId) && !sigueConectado) {
        try {
          await chatService.actualizarPresencia(userId, false);
          socket.broadcast.emit("presencia:cambio", {
            userId,
            nombre,
            estado: "Ausente",
          });
        } catch (err) {
          console.error(`[disconnect] Error actualizando presencia:`, err.message);
        }
      }

      console.log(`[socket] desconectado: ${socket.id}`);
    });
  });
};