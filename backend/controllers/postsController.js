const crypto = require("crypto");
const pool = require("../db");
const { getIO } = require("../services/ioBus");

const MAX_CONTENT_LENGTH = 2000;
const REACTION_TYPES = new Map([
  ["up", "like"],
  ["like", "like"],
  ["down", "dislike"],
  ["dislike", "dislike"],
]);
const REACTION_LABELS = new Map([["like", "up"], ["dislike", "down"]]);

const postFields = `
  p.id_post AS id,
  p.codigo_usu AS "authorId",
  p.contenido AS texto,
  p.categoria,
  p.visibilidad,
  p.tipo_post AS "tipoPost",
  p.media_url AS "mediaUrl",
  p.media_type AS "mediaType",
  to_char(p.creado_en, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
  to_char(p.actualizado_en, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt",
  u.username AS usuario,
  COALESCE(perfil.carrera, 'Estudiante UTP') AS carrera,
  COALESCE((
    SELECT SUM(CASE value WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 ELSE 0 END)::integer
    FROM jsonb_each_text(p.reacciones)
  ), 0) AS likes,
  CASE p.reacciones ->> $1
    WHEN 'like' THEN 'up'
    WHEN 'dislike' THEN 'down'
    ELSE NULL
  END AS "userVote",
  CASE WHEN $1::text IS NULL THEN FALSE ELSE p.guardado_por ? $1 END AS saved,
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.reportes) reporte
     WHERE reporte->>'codigo_usu' = $1
  ) AS reported,
  p.comentarios AS comments,
  p.etiquetas`;

const postJoins = `
  FROM posts p
  JOIN usuarios u ON u.codigo_usu = p.codigo_usu
  LEFT JOIN perfil_usuario perfil ON perfil.codigo_usu = u.codigo_usu`;

function normalizeContent(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategory(value) {
  return (typeof value === "string" ? value.trim() : "").slice(0, 80) || "General";
}

function normalizeMediaType(value) {
  return value === "imagen" || value === "video" ? value : null;
}

function normalizeMediaUrl(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTags(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const tags = [...new Set(raw
    .map((item) => String(item ?? "").trim().replace(/^#/, "").toLowerCase().slice(0, 40))
    .filter(Boolean))];
  return tags.slice(0, 10);
}

function isValidContent(content) {
  return content.length > 0 && content.length <= MAX_CONTENT_LENGTH;
}

async function getPostById(id, viewerId) {
  const { rows } = await pool.query(
    `SELECT ${postFields}
       ${postJoins}
      WHERE p.id_post = $2
        AND p.estado = 'activo'
        AND (p.visibilidad = 'publico' OR p.codigo_usu = $1)`,
    [viewerId || null, id],
  );
  return rows[0] || null;
}

function emitPublicPostEvent(event, post) {
  if (post?.visibilidad !== "publico") return;
  getIO()?.emit(event, post);
}

async function obtenerPosts(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT ${postFields}
         ${postJoins}
        WHERE p.estado = 'activo'
          AND (p.visibilidad = 'publico' OR p.codigo_usu = $1)
          AND NOT EXISTS (
            SELECT 1 FROM relaciones r
             WHERE r.codigo_usu = $1
               AND r.codigo_destino = p.codigo_usu
               AND r.tipo = 'bloqueo'
               AND r.estado = 'activo'
          )
        ORDER BY p.creado_en DESC, p.id_post DESC`,
      [req.user?.id || null],
    );
    res.json({ success: true, posts: rows });
  } catch (error) {
    console.error("Error obteniendo publicaciones:", error);
    res.status(500).json({ success: false, error: "No se pudieron obtener las publicaciones" });
  }
}

async function crearPost(req, res) {
  const contenido = normalizeContent(req.body.texto ?? req.body.contenido);
  const categoria = normalizeCategory(req.body.categoria);
  const visibilidad = ["publico", "seguidores", "privado"].includes(req.body.visibilidad)
    ? req.body.visibilidad
    : "publico";
  const mediaUrl = normalizeMediaUrl(req.body.media_url ?? req.body.mediaUrl);
  const mediaType = mediaUrl ? normalizeMediaType(req.body.media_type ?? req.body.mediaType) : null;
  const tipoPost = ["short", "historia"].includes(req.body.tipo_post)
    ? req.body.tipo_post
    : mediaType === "video"
      ? "short"
      : "publicacion";
  const etiquetas = normalizeTags(req.body.etiquetas ?? req.body.tags);

  if (!isValidContent(contenido)) {
    return res.status(400).json({
      success: false,
      error: `La publicación debe tener entre 1 y ${MAX_CONTENT_LENGTH} caracteres.`,
    });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO posts
         (codigo_usu, contenido, tipo_post, categoria, visibilidad, media_url, media_type, etiquetas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id_post`,
      [req.user.id, contenido, tipoPost, categoria, visibilidad, mediaUrl, mediaType, JSON.stringify(etiquetas)],
    );
    const post = await getPostById(rows[0].id_post, req.user.id);
    if (post?.visibilidad === "publico") {
      getIO()?.emit("feed:post-creado", { post });
    }
    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error("Error creando publicación:", error);
    res.status(500).json({ success: false, error: "No se pudo crear la publicación" });
  }
}

async function editarPost(req, res) {
  const contenido = normalizeContent(req.body.texto ?? req.body.contenido);
  if (!isValidContent(contenido)) {
    return res.status(400).json({
      success: false,
      error: `La publicación debe tener entre 1 y ${MAX_CONTENT_LENGTH} caracteres.`,
    });
  }

  const mediaProvided = req.body.media_url !== undefined || req.body.mediaUrl !== undefined;
  const mediaUrl = normalizeMediaUrl(req.body.media_url ?? req.body.mediaUrl);
  const mediaType = mediaUrl ? normalizeMediaType(req.body.media_type ?? req.body.mediaType) : null;
  const tagsProvided = req.body.etiquetas !== undefined || req.body.tags !== undefined;
  const etiquetas = normalizeTags(req.body.etiquetas ?? req.body.tags);

  try {
    const { rows } = await pool.query(
      `UPDATE posts
          SET contenido = $1,
              categoria = COALESCE($2, categoria),
              media_url = CASE WHEN $3 THEN $4 ELSE media_url END,
              media_type = CASE WHEN $3 THEN $5 ELSE media_type END,
              etiquetas = CASE WHEN $6 THEN $7::jsonb ELSE etiquetas END,
              actualizado_en = NOW()
        WHERE id_post = $8 AND codigo_usu = $9 AND estado = 'activo'
        RETURNING id_post`,
      [
        contenido,
        req.body.categoria ? normalizeCategory(req.body.categoria) : null,
        mediaProvided,
        mediaUrl,
        mediaType,
        tagsProvided,
        JSON.stringify(etiquetas),
        req.params.id,
        req.user.id,
      ],
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: "No tienes permiso para editar esta publicación." });
    }
    const post = await getPostById(rows[0].id_post, req.user.id);
    emitPublicPostEvent("feed:post-actualizado", post);
    res.json({ success: true, post });
  } catch (error) {
    console.error("Error editando publicación:", error);
    res.status(500).json({ success: false, error: "No se pudo editar la publicación" });
  }
}

async function eliminarPost(req, res) {
  try {
    const { rows } = await pool.query(
      `UPDATE posts SET estado = 'eliminado', actualizado_en = NOW()
        WHERE id_post = $1 AND codigo_usu = $2 AND estado = 'activo'
        RETURNING id_post`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: "No tienes permiso para eliminar esta publicación." });
    }
    const { rows: postRows } = await pool.query(
      `SELECT visibilidad FROM posts WHERE id_post = $1`,
      [req.params.id],
    );
    if (postRows[0]?.visibilidad === "publico") {
      getIO()?.emit("feed:post-eliminado", { id: String(req.params.id) });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error eliminando publicación:", error);
    res.status(500).json({ success: false, error: "No se pudo eliminar la publicación" });
  }
}

async function obtenerComentarios(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(comentarios, '[]'::jsonb) AS comments
         FROM posts
        WHERE id_post = $1 AND estado = 'activo'`,
      [req.params.id],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: "La publicación no está disponible." });
    }
    res.json({ success: true, comments: rows[0].comments });
  } catch (error) {
    console.error("Error obteniendo comentarios:", error);
    res.status(500).json({ success: false, error: "No se pudieron obtener los comentarios" });
  }
}

async function crearComentario(req, res) {
  const contenido = normalizeContent(req.body.texto ?? req.body.contenido);
  if (!isValidContent(contenido)) {
    return res.status(400).json({ success: false, error: "Escribe un comentario válido." });
  }

  try {
    const user = await pool.query(
      `SELECT username FROM usuarios WHERE codigo_usu = $1`,
      [req.user.id],
    );
    if (!user.rows.length) {
      return res.status(401).json({ success: false, error: "La sesión no corresponde a una cuenta activa." });
    }
    const comment = {
      id: crypto.randomUUID(),
      authorId: req.user.id,
      usuario: user.rows[0].username,
      avatar: user.rows[0].username.charAt(0).toUpperCase(),
      texto: contenido,
      createdAt: new Date().toISOString(),
      hora: new Date().toISOString(),
    };
    const { rowCount } = await pool.query(
      `UPDATE posts
          SET comentarios = comentarios || jsonb_build_array($1::jsonb),
              actualizado_en = NOW()
        WHERE id_post = $2 AND estado = 'activo'`,
      [JSON.stringify(comment), req.params.id],
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, error: "La publicación ya no está disponible." });
    }
    const publicPost = await getPostById(req.params.id, null);
    if (publicPost) {
      getIO()?.emit("feed:comentario-nuevo", {
        postId: String(req.params.id),
        comment,
      });
    }
    res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error("Error creando comentario:", error);
    res.status(500).json({ success: false, error: "No se pudo crear el comentario" });
  }
}

async function reaccionarPost(req, res) {
  const reaction = REACTION_TYPES.get(req.body.type ?? req.body.reaccion);
  if (!reaction) {
    return res.status(400).json({ success: false, error: "La reacción debe ser 'up', 'down' o 'like'." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT reacciones FROM posts
        WHERE id_post = $1 AND estado = 'activo'
        FOR UPDATE`,
      [req.params.id],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "La publicación ya no está disponible." });
    }

    const reactions = rows[0].reacciones || {};
    const userVote = reactions[req.user.id] === reaction ? null : REACTION_LABELS.get(reaction);
    if (userVote) reactions[req.user.id] = reaction;
    else delete reactions[req.user.id];

    await client.query(
      `UPDATE posts SET reacciones = $1::jsonb, actualizado_en = NOW() WHERE id_post = $2`,
      [JSON.stringify(reactions), req.params.id],
    );
    const likes = Object.values(reactions).reduce(
      (total, value) => total + (value === "like" ? 1 : value === "dislike" ? -1 : 0),
      0,
    );
    await client.query("COMMIT");
    const publicPost = await getPostById(req.params.id, null);
    if (publicPost) {
      getIO()?.emit("feed:reaccion", { postId: String(req.params.id), likes });
    }
    res.json({ success: true, likes, userVote });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error reaccionando a publicación:", error);
    res.status(500).json({ success: false, error: "No se pudo registrar la reacción" });
  } finally {
    client.release();
  }
}

async function alternarGuardado(req, res) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT guardado_por FROM posts
        WHERE id_post = $1 AND estado = 'activo'
        FOR UPDATE`,
      [req.params.id],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "La publicación ya no está disponible." });
    }
    const savedBy = rows[0].guardado_por || [];
    const exists = savedBy.includes(req.user.id);
    const updated = exists
      ? savedBy.filter((id) => id !== req.user.id)
      : [...savedBy, req.user.id];
    await client.query(
      `UPDATE posts SET guardado_por = $1::jsonb WHERE id_post = $2`,
      [JSON.stringify(updated), req.params.id],
    );
    await client.query("COMMIT");
    res.json({ success: true, saved: !exists });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error guardando publicación:", error);
    res.status(500).json({ success: false, error: "No se pudo actualizar el guardado" });
  } finally {
    client.release();
  }
}

async function reportarPost(req, res) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT codigo_usu, reportes
         FROM posts
        WHERE id_post = $1 AND estado = 'activo'
        FOR UPDATE`,
      [req.params.id],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "La publicación no está disponible." });
    }
    if (rows[0].codigo_usu === req.user.id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "No puedes denunciar tu propia publicación." });
    }
    const reports = rows[0].reportes || [];
    if (!reports.some((report) => report.codigo_usu === req.user.id)) {
      reports.push({ codigo_usu: req.user.id, creado_en: new Date().toISOString() });
      await client.query(
        `UPDATE posts SET reportes = $1::jsonb WHERE id_post = $2`,
        [JSON.stringify(reports), req.params.id],
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, reported: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error denunciando publicación:", error);
    res.status(500).json({ success: false, error: "No se pudo registrar la denuncia" });
  } finally {
    client.release();
  }
}

module.exports = {
  obtenerPosts,
  crearPost,
  editarPost,
  eliminarPost,
  obtenerComentarios,
  crearComentario,
  reaccionarPost,
  alternarGuardado,
  reportarPost,
};
