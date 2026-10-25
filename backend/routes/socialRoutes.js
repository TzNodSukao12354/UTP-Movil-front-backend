const { Router } = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = Router();
router.use(requireAuth);

router.post("/usuarios/:id/bloqueo", async (req, res) => {
  const target = String(req.params.id || "").trim().toUpperCase();
  if (!/^U\d{8}$/.test(target)) {
    return res.status(400).json({ success: false, error: "Código de usuario inválido." });
  }
  if (target === req.user.id) {
    return res.status(400).json({ success: false, error: "No puedes ocultarte a ti mismo." });
  }
  try {
    const user = await pool.query(
      `SELECT 1 FROM usuarios WHERE codigo_usu = $1 AND estado = 'activo'`,
      [target],
    );
    if (!user.rows.length) {
      return res.status(404).json({ success: false, error: "No se encontró al usuario." });
    }
    await pool.query(
      `INSERT INTO relaciones (codigo_usu, codigo_destino, tipo, estado)
       VALUES ($1, $2, 'bloqueo', 'activo')
       ON CONFLICT (codigo_usu, codigo_destino, tipo)
       DO UPDATE SET estado = 'activo'`,
      [req.user.id, target],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error ocultando usuario:", error);
    res.status(500).json({ success: false, error: "No se pudo ocultar al usuario." });
  }
});

router.delete("/usuarios/:id/bloqueo", async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM relaciones
        WHERE codigo_usu = $1 AND codigo_destino = $2 AND tipo = 'bloqueo'`,
      [req.user.id, req.params.id],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error mostrando usuario:", error);
    res.status(500).json({ success: false, error: "No se pudo mostrar al usuario." });
  }
});

module.exports = router;
