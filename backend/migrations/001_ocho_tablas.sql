BEGIN;

DO $$
DECLARE
  tabla RECORD;
BEGIN
  FOR tabla IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', tabla.schemaname, tabla.tablename);
  END LOOP;
END
$$;

CREATE TABLE IF NOT EXISTS usuarios (
  codigo_usu TEXT PRIMARY KEY CHECK (codigo_usu ~ '^U[0-9]{8}$'),
  correo TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'suspendido', 'eliminado')),
  ultima_conexion TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS perfil_usuario (
  codigo_usu TEXT PRIMARY KEY REFERENCES usuarios(codigo_usu) ON DELETE CASCADE,
  bio TEXT NOT NULL DEFAULT '',
  carrera TEXT,
  ciclo TEXT,
  genero TEXT,
  intereses JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(intereses) = 'array'),
  estado_actual TEXT,
  privado BOOLEAN NOT NULL DEFAULT FALSE,
  foto_perfil TEXT,
  portada TEXT,
  preferencias JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(preferencias) = 'object'),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id_post BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_usu TEXT NOT NULL REFERENCES usuarios(codigo_usu) ON DELETE CASCADE,
  contenido TEXT NOT NULL DEFAULT '',
  tipo_post TEXT NOT NULL DEFAULT 'publicacion'
    CHECK (tipo_post IN ('publicacion', 'short', 'historia')),
  visibilidad TEXT NOT NULL DEFAULT 'publico'
    CHECK (visibilidad IN ('publico', 'seguidores', 'privado')),
  media_url TEXT,
  media_type TEXT,
  categoria TEXT NOT NULL DEFAULT 'General',
  comentarios JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(comentarios) = 'array'),
  reacciones JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(reacciones) = 'object'),
  guardado_por JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(guardado_por) = 'array'),
  etiquetas JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(etiquetas) = 'array'),
  reportes JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(reportes) = 'array'),
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'oculto', 'eliminado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relaciones (
  id_relacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_usu TEXT NOT NULL REFERENCES usuarios(codigo_usu) ON DELETE CASCADE,
  codigo_destino TEXT NOT NULL REFERENCES usuarios(codigo_usu) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('seguir', 'amistad', 'bloqueo')),
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('pendiente', 'activo', 'rechazado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (codigo_usu <> codigo_destino),
  UNIQUE (codigo_usu, codigo_destino, tipo)
);

CREATE TABLE IF NOT EXISTS chats (
  id_chat BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT,
  descripcion TEXT,
  tipo_chat TEXT NOT NULL DEFAULT 'privado'
    CHECK (tipo_chat IN ('privado', 'grupo', 'comunidad')),
  participantes JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(participantes) = 'array'),
  codigo_invitacion TEXT UNIQUE,
  creado_por TEXT REFERENCES usuarios(codigo_usu) ON DELETE SET NULL,
  avatar TEXT,
  ultimo_mensaje_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensajes (
  id_mensaje BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_chat BIGINT NOT NULL REFERENCES chats(id_chat) ON DELETE CASCADE,
  codigo_usu TEXT NOT NULL REFERENCES usuarios(codigo_usu) ON DELETE CASCADE,
  contenido TEXT NOT NULL DEFAULT '',
  tipo_mensaje TEXT NOT NULL DEFAULT 'texto'
    CHECK (tipo_mensaje IN ('texto', 'imagen', 'video', 'audio', 'archivo')),
  adjuntos JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(adjuntos) = 'array'),
  reacciones JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(reacciones) = 'object'),
  leido_por JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(leido_por) = 'array'),
  reportes JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(reportes) = 'array'),
  eliminado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  editado_en TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id_notificacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_usu TEXT NOT NULL REFERENCES usuarios(codigo_usu) ON DELETE CASCADE,
  codigo_actor TEXT REFERENCES usuarios(codigo_usu) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  datos JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(datos) = 'object'),
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sesiones (
  id_sesion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_usu TEXT NOT NULL REFERENCES usuarios(codigo_usu) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  dispositivo TEXT,
  ip INET,
  fecha_expiracion TIMESTAMPTZ NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_feed_idx
  ON posts (visibilidad, estado, creado_en DESC);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_ci_idx
  ON usuarios (LOWER(username));
CREATE INDEX IF NOT EXISTS posts_usuario_idx
  ON posts (codigo_usu, creado_en DESC);
CREATE INDEX IF NOT EXISTS posts_tipo_idx
  ON posts (tipo_post, creado_en DESC);
CREATE INDEX IF NOT EXISTS relaciones_destino_idx
  ON relaciones (codigo_destino, tipo, estado);
CREATE INDEX IF NOT EXISTS chats_participantes_idx
  ON chats USING GIN (participantes);
CREATE INDEX IF NOT EXISTS mensajes_chat_idx
  ON mensajes (id_chat, creado_en DESC);
CREATE INDEX IF NOT EXISTS notificaciones_usuario_idx
  ON notificaciones (codigo_usu, leida, creado_en DESC);
CREATE INDEX IF NOT EXISTS sesiones_usuario_idx
  ON sesiones (codigo_usu, activo, fecha_expiracion DESC);

COMMIT;
