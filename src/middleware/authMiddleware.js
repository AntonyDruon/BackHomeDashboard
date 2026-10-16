import jwt from "jsonwebtoken";
import db from "../../db.js";

// Vérifie la SIGNATURE et l'expiration du jeton (l'ancien code ne faisait
// que le décoder : n'importe qui pouvait fabriquer un jeton).
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (!payload.userId) throw new Error("userId manquant");
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// À placer après authMiddleware : rôle relu en base à chaque requête
// (un rôle retiré prend effet immédiatement).
export const requireAdmin = (req, res, next) => {
  db.query("SELECT role FROM users WHERE id = ?", [req.userId], (err, rows) => {
    if (err) {
      console.error("Erreur vérification admin :", err.code);
      return res.status(500).json({ message: "Internal server error" });
    }
    if (rows.length === 0 || rows[0].role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    next();
  });
};

export default authMiddleware;
