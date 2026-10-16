import db from "../../db.js";
import bcrypt from "bcryptjs";

const ROLES = ["user", "admin"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Réservé aux admins (voir route.js). Jamais le hash du mot de passe.
export const getAllUsers = (req, res) => {
  db.query("SELECT id, username, email, role FROM users", (err, results) => {
    if (err) {
      console.error("Erreur lecture utilisateurs :", err.code);
      return res.status(500).send("Internal Server Error");
    }
    res.json(results);
  });
};

export const createUser = (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Tous les champs doivent être remplis." });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Email invalide." });
  }
  if (String(password).length < 8) {
    return res
      .status(400)
      .json({ error: "Le mot de passe doit faire au moins 8 caractères." });
  }

  db.query("SELECT id FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error("Erreur vérification email :", err.code);
      return res.status(500).json({ error: "Erreur interne du serveur" });
    }
    if (results.length > 0) {
      return res.status(400).json({ error: "Cet email est déjà utilisé." });
    }

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error("Erreur hachage mot de passe");
        return res.status(500).json({ error: "Erreur interne du serveur" });
      }
      // Rôle jamais fourni par le client : la base met sa valeur par défaut
      db.query(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, hash],
        (err, result) => {
          if (err) {
            console.error("Erreur création utilisateur :", err.code);
            return res.status(500).json({ error: "Erreur interne du serveur" });
          }
          res.status(201).json({
            message: "Utilisateur créé avec succès !",
            userId: result.insertId,
          });
        }
      );
    });
  });
};

// Rôle de l'utilisateur connecté (le :id de l'URL est ignoré)
export const getUserRole = (req, res) => {
  db.query("SELECT role FROM users WHERE id = ?", [req.userId], (err, result) => {
    if (err) {
      console.error("Erreur lecture rôle :", err.code);
      return res.status(500).json({ error: "Erreur serveur" });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    return res.status(200).json({ role: result[0].role });
  });
};

// Réservé aux admins
export const updateUser = (req, res) => {
  const userId = req.params.id;
  const { role, email, username } = req.body || {};

  if (!username || !email || !role) {
    return res.status(400).json({ error: "Tous les champs doivent être remplis" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "Rôle invalide" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Email invalide" });
  }
  // Un admin ne peut pas se retirer lui-même ses droits (évite de se bloquer)
  if (String(userId) === String(req.userId) && role !== "admin") {
    return res
      .status(400)
      .json({ error: "Vous ne pouvez pas retirer votre propre rôle admin." });
  }

  db.query(
    "UPDATE users SET role = ?, email = ?, username = ? WHERE id = ?",
    [role, email, username, userId],
    (err, result) => {
      if (err) {
        console.error("Erreur mise à jour utilisateur :", err.code);
        return res.status(500).json({ error: "Erreur serveur" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Utilisateur non trouvé." });
      }
      return res.status(200).json({ message: "Rôle mis à jour avec succès." });
    }
  );
};

// Réservé aux admins. Supprime l'utilisateur et toutes ses données
// dans une transaction (sur une connexion dédiée du pool).
export const deleteUser = async (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ error: "ID de l'utilisateur manquant" });
  }
  if (String(userId) === String(req.userId)) {
    return res
      .status(400)
      .json({ error: "Vous ne pouvez pas supprimer votre propre compte ici." });
  }

  const deleteQueries = [
    "DELETE FROM notes_field WHERE id_note IN (SELECT id_note FROM note WHERE id_user = ?)",
    "DELETE FROM note WHERE id_user = ?",
    "DELETE FROM todolist WHERE id_user = ?",
    "DELETE FROM rooms WHERE user_id = ?",
    "DELETE FROM lights WHERE id_user = ?",
    "DELETE FROM huebridgetokens WHERE user_id = ?",
    "DELETE FROM nanoleaftoken WHERE user_id = ?",
  ];

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    for (const q of deleteQueries) await conn.query(q, [userId]);
    const [result] = await conn.query("DELETE FROM users WHERE id = ?", [userId]);
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }
    await conn.commit();
    res.status(200).json({ message: "Utilisateur supprimé avec succès" });
  } catch (err) {
    console.error("Erreur suppression utilisateur :", err.code || err.message);
    if (conn) await conn.rollback().catch(() => {});
    res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" });
  } finally {
    if (conn) conn.release();
  }
};

// Profil de l'utilisateur connecté (jamais le hash)
export const getMe = (req, res) => {
  db.query(
    "SELECT id, username, email, role FROM users WHERE id = ?",
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error("Erreur lecture profil :", err.code);
        return res.status(500).json({ error: "Erreur serveur" });
      }
      if (rows.length === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
      res.json(rows[0]);
    }
  );
};
