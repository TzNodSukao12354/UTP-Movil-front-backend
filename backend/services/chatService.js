const crypto = require("crypto");
const path = require("path");
const pool = require("../db");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeUserId(value) {
  const userId = String(value || "").trim().toUpperCase();
  if (!/^U\d{8}$/.test(userId)) throw fail("Código de usuario inválido");
  return userId;
}

function participant(userId, role = "miembro") {
  return {
    codigo_usu: userId,
    rol: role,
    estado: "activo",
    fecha_union: new Date().toISOString(),
  };
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}

function getReactionCounts(reactions) {
  return Object.fromEntries(
    Object.entries(reactions || {}).map(([emoji, userIds]) => [emoji, userIds.length]),
  );
}

async function reportarMensaje({ msgId, chatId, reporterId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT reportes FROM mensajes
        WHERE id_mensaje = $1 AND id_chat = $2
        FOR UPDATE`,
      [msgId, chatId],
    );
    if (!rows.length) throw fail("No se encontró el mensaje", 404);
    const reports = rows[0].reportes || [];
    if (!reports.includes(reporterId)) reports.push(reporterId);
    const removed = reports.length >= 5;
    await client.query(
      `UPDATE mensajes SET reportes = $1::jsonb, eliminado = $2 WHERE id_mensaje = $3`,
      [JSON.stringify(reports), removed, msgId],
    );
    await client.query("COMMIT");
    return { eliminado: removed, reportes: reports.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reaccionarMensaje({ msgId, chatId, userId, emoji }) {
  if (typeof emoji !== "string" || !emoji.trim() || emoji.length > 16) {
    throw fail("La reacción no es válida");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT reacciones FROM mensajes
        WHERE id_mensaje = $1 AND id_chat = $2 AND eliminado = false
        FOR UPDATE`,
      [msgId, chatId],
    );
    if (!rows.length) throw fail("No se encontró el mensaje", 404);
    const reactions = rows[0].reacciones || {};
    const userIds = reactions[emoji] || [];
    const existingIndex = userIds.indexOf(userId);
    const quitar = existingIndex !== -1;
    if (quitar) userIds.splice(existingIndex, 1);
    else userIds.push(userId);
    if (userIds.length) reactions[emoji] = userIds;
    else delete reactions[emoji];
    await client.query(
      `UPDATE mensajes SET reacciones = $1::jsonb WHERE id_mensaje = $2`,
      [JSON.stringify(reactions), msgId],
    );
    await client.query("COMMIT");
    return { count: userIds.length, quitar };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getChatsDeUsuario(userId) {
  const id = normalizeUserId(userId);
  const { rows } = await pool.query(
    `SELECT c.id_chat AS id,
            CASE WHEN c.tipo_chat = 'privado' THEN otro.username ELSE c.nombre END AS nombre,
            CASE WHEN c.tipo_chat = 'privado' THEN 'amigo' ELSE 'grupo' END AS tipo,
            CASE
              WHEN otro.ultima_conexion > NOW() - INTERVAL '2 minutes' THEN 'En línea'
              ELSE 'Ausente'
            END AS estado,
            0 AS "mensajesNoLeidos"
       FROM chats c
       LEFT JOIN LATERAL (
         SELECT u.username, u.ultima_conexion
           FROM jsonb_array_elements(c.participantes) p
           JOIN usuarios u ON u.codigo_usu = p->>'codigo_usu'
          WHERE p->>'codigo_usu' <> $1 AND p->>'estado' = 'activo'
          LIMIT 1
       ) otro ON TRUE
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(c.participantes) p
         WHERE p->>'codigo_usu' = $1 AND p->>'estado' = 'activo'
      )
      ORDER BY c.ultimo_mensaje_en DESC NULLS LAST, c.id_chat DESC`,
    [id],
  );
  return rows;
}

async function obtenerOCrearChatPrivado(userId1, userId2) {
  const first = normalizeUserId(userId1);
  const second = normalizeUserId(userId2);
  if (first === second) throw fail("No puedes iniciar una conversación contigo mismo.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [[first, second].sort().join(":")]);
    const existing = await client.query(
      `SELECT id_chat FROM chats
        WHERE tipo_chat = 'privado'
          AND participantes @> $1::jsonb
          AND participantes @> $2::jsonb
        LIMIT 1`,
      [
        JSON.stringify([{ codigo_usu: first, estado: "activo" }]),
        JSON.stringify([{ codigo_usu: second, estado: "activo" }]),
      ],
    );
    if (existing.rows.length) {
      await client.query("COMMIT");
      return existing.rows[0].id_chat;
    }

    const { rows } = await client.query(
      `INSERT INTO chats (nombre, tipo_chat, participantes, creado_por)
       VALUES ('Chat privado', 'privado', $1::jsonb, $2)
       RETURNING id_chat`,
      [JSON.stringify([participant(first), participant(second)]), first],
    );
    await client.query("COMMIT");
    return rows[0].id_chat;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function crearGrupo({ nombre, descripcion, creadorId }) {
  const creator = normalizeUserId(creadorId);
  const cleanName = typeof nombre === "string" ? nombre.trim().slice(0, 80) : "";
  if (!cleanName) throw fail("El nombre del grupo es obligatorio");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO chats
           (nombre, descripcion, tipo_chat, participantes, creado_por, codigo_invitacion)
         VALUES ($1, $2, 'grupo', $3::jsonb, $4, $5)
         RETURNING id_chat, codigo_invitacion`,
        [
          cleanName,
          typeof descripcion === "string" ? descripcion.trim().slice(0, 500) || null : null,
          JSON.stringify([participant(creator, "admin")]),
          creator,
          generateInviteCode(),
        ],
      );
      return { idChat: rows[0].id_chat, codigo: rows[0].codigo_invitacion, nombre: cleanName };
    } catch (error) {
      if (error.code !== "23505" || attempt === 4) throw error;
    }
  }
  throw fail("No se pudo generar un código de invitación", 500);
}

async function unirseGrupoConCodigo({ codigo, userId }) {
  const id = normalizeUserId(userId);
  const inviteCode = String(codigo || "").trim().toUpperCase();
  if (!inviteCode) throw fail("Código de invitación inválido", 404);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id_chat, nombre, participantes FROM chats
        WHERE codigo_invitacion = $1 AND tipo_chat = 'grupo'
        FOR UPDATE`,
      [inviteCode],
    );
    if (!rows.length) throw fail("Código de invitación inválido", 404);
    const chat = rows[0];
    const members = chat.participantes || [];
    if (!members.some((entry) => entry.codigo_usu === id && entry.estado === "activo")) {
      members.push(participant(id));
      await client.query(
        `UPDATE chats SET participantes = $1::jsonb, actualizado_en = NOW() WHERE id_chat = $2`,
        [JSON.stringify(members), chat.id_chat],
      );
    }
    await client.query("COMMIT");
    return { idChat: chat.id_chat, nombre: chat.nombre };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getMensajes(chatId) {
  const { rows } = await pool.query(
    `SELECT m.id_mensaje AS id,
            m.id_chat AS "chatId",
            m.contenido AS texto,
            to_char(m.creado_en, 'HH12:MI AM') AS hora,
            m.codigo_usu AS "remitenteId",
            u.username AS remitente,
            m.eliminado,
            m.reacciones,
            m.adjuntos
       FROM mensajes m
       JOIN usuarios u ON u.codigo_usu = m.codigo_usu
      WHERE m.id_chat = $1 AND m.eliminado = false
      ORDER BY m.creado_en ASC
      LIMIT 100`,
    [chatId],
  );
  return rows.map((row) => ({ ...row, reacciones: getReactionCounts(row.reacciones) }));
}

async function guardarMensaje({ chatId, texto, remitenteId }) {
  const userId = normalizeUserId(remitenteId);
  const content = typeof texto === "string" ? texto.trim().slice(0, 4000) : "";
  if (!content) throw fail("El mensaje no puede estar vacío");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const membership = await client.query(
      `SELECT 1 FROM chats
        WHERE id_chat = $1 AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(participantes) p
           WHERE p->>'codigo_usu' = $2 AND p->>'estado' = 'activo'
        )
        FOR UPDATE`,
      [chatId, userId],
    );
    if (!membership.rows.length) throw fail("No tienes acceso a esta conversación.", 403);
    const { rows } = await client.query(
      `INSERT INTO mensajes (id_chat, codigo_usu, contenido)
       VALUES ($1, $2, $3)
       RETURNING id_mensaje AS id,
                 id_chat AS "chatId",
                 contenido AS texto,
                 to_char(creado_en, 'HH12:MI AM') AS hora,
                 codigo_usu AS "remitenteId",
                 creado_en`,
      [chatId, userId, content],
    );
    const message = rows[0];
    const user = await client.query(`SELECT username FROM usuarios WHERE codigo_usu = $1`, [userId]);
    await client.query(`UPDATE chats SET ultimo_mensaje_en = NOW() WHERE id_chat = $1`, [chatId]);
    await client.query("COMMIT");
    return {
      ...message,
      remitente: user.rows[0]?.username || "Usuario",
      mio: false,
      eliminado: false,
      reacciones: {},
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function marcarMensajeVisto({ chatId, userId }) {
  const id = normalizeUserId(userId);
  const { rowCount } = await pool.query(
    `UPDATE mensajes
        SET leido_por = CASE
          WHEN leido_por ? $2 THEN leido_por
          ELSE leido_por || to_jsonb(ARRAY[$2]::text[])
        END
      WHERE id_chat = $1 AND eliminado = false`,
    [chatId, id],
  );
  return rowCount;
}

async function eliminarMensaje({ msgId, chatId, userId }) {
  const id = normalizeUserId(userId);
  const { rowCount } = await pool.query(
    `UPDATE mensajes SET eliminado = true
      WHERE id_mensaje = $1 AND id_chat = $2 AND codigo_usu = $3`,
    [msgId, chatId, id],
  );
  return rowCount > 0;
}

async function buscarUsuarios(query) {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return [];
  const { rows } = await pool.query(
    `SELECT codigo_usu AS id, username
       FROM usuarios
      WHERE estado = 'activo' AND LOWER(username) LIKE $1
      ORDER BY username
      LIMIT 20`,
    [`%${term}%`],
  );
  return rows;
}

async function actualizarPresencia(userId, online = true) {
  const id = normalizeUserId(userId);
  await pool.query(
    `UPDATE usuarios SET ultima_conexion = CASE WHEN $2 THEN NOW() ELSE NULL END
      WHERE codigo_usu = $1`,
    [id, online],
  );
}

async function esMiembroActivoDeChat(chatId, userId) {
  const id = normalizeUserId(userId);
  const { rows } = await pool.query(
    `SELECT 1 FROM chats
      WHERE id_chat = $1 AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(participantes) p
         WHERE p->>'codigo_usu' = $2 AND p->>'estado' = 'activo'
      )`,
    [chatId, id],
  );
  return rows.length > 0;
}

async function esAdminDeGrupo(idChat, userId) {
  const id = normalizeUserId(userId);
  const { rows } = await pool.query(
    `SELECT 1 FROM chats
      WHERE id_chat = $1 AND tipo_chat = 'grupo' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(participantes) p
         WHERE p->>'codigo_usu' = $2 AND p->>'rol' = 'admin' AND p->>'estado' = 'activo'
      )`,
    [idChat, id],
  );
  return rows.length > 0;
}

async function obtenerMiembrosGrupo(idChat) {
  const { rows } = await pool.query(
    `SELECT u.codigo_usu AS id,
            u.username,
            p->>'rol' AS rol,
            perfil.foto_perfil AS avatar
       FROM chats c
       CROSS JOIN LATERAL jsonb_array_elements(c.participantes) p
       JOIN usuarios u ON u.codigo_usu = p->>'codigo_usu'
       LEFT JOIN perfil_usuario perfil ON perfil.codigo_usu = u.codigo_usu
      WHERE c.id_chat = $1 AND c.tipo_chat = 'grupo' AND p->>'estado' = 'activo'
      ORDER BY (p->>'rol' = 'admin') DESC, u.username`,
    [idChat],
  );
  return rows;
}

async function actualizarMiembros(idChat, transform) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT participantes FROM chats WHERE id_chat = $1 AND tipo_chat = 'grupo' FOR UPDATE`,
      [idChat],
    );
    if (!rows.length) throw fail("No se encontró el grupo", 404);
    const updated = transform(rows[0].participantes || []);
    await client.query(
      `UPDATE chats SET participantes = $1::jsonb, actualizado_en = NOW() WHERE id_chat = $2`,
      [JSON.stringify(updated), idChat],
    );
    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function expulsarMiembro({ idChat, adminId, userIdExpulsar }) {
  const admin = normalizeUserId(adminId);
  const target = normalizeUserId(userIdExpulsar);
  if (admin === target) throw fail("No puedes expulsarte a ti mismo; usa salir del grupo.");
  if (!await esAdminDeGrupo(idChat, admin)) throw fail("No tienes permisos de administrador en este grupo", 403);
  const members = await actualizarMiembros(idChat, (list) => list.filter((entry) => entry.codigo_usu !== target));
  return { ok: true, miembros: members.length };
}

async function actualizarGrupo({ idChat, adminId, nombre, descripcion }) {
  const admin = normalizeUserId(adminId);
  if (!await esAdminDeGrupo(idChat, admin)) throw fail("No tienes permisos de administrador en este grupo", 403);
  const { rows } = await pool.query(
    `UPDATE chats
        SET nombre = COALESCE($1, nombre),
            descripcion = CASE WHEN $2::boolean THEN $3 ELSE descripcion END,
            actualizado_en = NOW()
      WHERE id_chat = $4 AND tipo_chat = 'grupo'
      RETURNING id_chat AS id, nombre, descripcion`,
    [
      typeof nombre === "string" && nombre.trim() ? nombre.trim().slice(0, 80) : null,
      descripcion !== undefined,
      typeof descripcion === "string" ? descripcion.trim().slice(0, 500) || null : null,
      idChat,
    ],
  );
  if (!rows.length) throw fail("No se encontró el grupo", 404);
  return rows[0];
}

async function salirDeGrupo({ idChat, userId }) {
  const id = normalizeUserId(userId);
  let wasAdmin = false;
  const members = await actualizarMiembros(idChat, (list) => {
    const member = list.find((entry) => entry.codigo_usu === id && entry.estado === "activo");
    if (!member) throw fail("No perteneces a este grupo", 404);
    wasAdmin = member.rol === "admin";
    const remaining = list.filter((entry) => entry.codigo_usu !== id);
    if (wasAdmin && remaining.length && !remaining.some((entry) => entry.rol === "admin")) {
      remaining[0].rol = "admin";
    }
    return remaining;
  });
  return { ok: true, miembros: members.length };
}

async function regenerarCodigoInvitacion({ idChat, adminId }) {
  const admin = normalizeUserId(adminId);
  if (!await esAdminDeGrupo(idChat, admin)) throw fail("No tienes permisos de administrador en este grupo", 403);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { rows } = await pool.query(
        `UPDATE chats SET codigo_invitacion = $1, actualizado_en = NOW()
          WHERE id_chat = $2 AND tipo_chat = 'grupo'
          RETURNING codigo_invitacion AS codigo`,
        [generateInviteCode(), idChat],
      );
      if (!rows.length) throw fail("No se encontró el grupo", 404);
      return rows[0];
    } catch (error) {
      if (error.code !== "23505" || attempt === 4) throw error;
    }
  }
  throw fail("No se pudo generar un código de invitación", 500);
}

async function guardarMensajeConArchivo() {
  throw fail("El almacenamiento de archivos de chat aún no está configurado.", 503);
}

module.exports = {
  getChatsDeUsuario,
  obtenerOCrearChatPrivado,
  crearGrupo,
  unirseGrupoConCodigo,
  getMensajes,
  guardarMensaje,
  guardarMensajeConArchivo,
  buscarUsuarios,
  actualizarPresencia,
  esMiembroActivoDeChat,
  reportarMensaje,
  reaccionarMensaje,
  marcarMensajeVisto,
  eliminarMensaje,
  obtenerMiembrosGrupo,
  expulsarMiembro,
  actualizarGrupo,
  salirDeGrupo,
  regenerarCodigoInvitacion,
};
