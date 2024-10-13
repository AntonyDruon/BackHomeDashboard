import UserModel from "../model/userModels.mjs";
import db from "../../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const getAllUsers = (req, res) => {
  console.log("getAllUsers");
  const query = "SELECT * FROM users";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error getting users:", err);
      res.status(500).send("Internal Server Error");
      return;
    }

    // Log fetched users to debug
    console.log("Fetched Users from DB:", results);

    // Send the fetched users as a response
    res.json(results);
  });
};

export const createUser = (req, res) => {
  // Récupérer les données du formulaire
  const { username, email, password } = req.body;

  console.log("username", username);
  if (!username || !email || !password) {
    res.status(400).json({ error: "Tous les champs doivent être remplis." });
    return;
  }

  // Vérifier si l'email existe déjà
  const emailCheckQuery = "SELECT * FROM users WHERE email = ?";
  db.query(emailCheckQuery, [email], (err, results) => {
    if (err) {
      console.error("Erreur lors de la vérification de l'email:", err);
      return res.status(500).json({ error: "Erreur interne du serveur" });
    }

    if (results.length > 0) {
      // Si un utilisateur avec cet email existe déjà
      return res.status(400).json({ error: "Cet email est déjà utilisé." });
    }

    // Continuer la création de l'utilisateur si l'email n'existe pas
    const saltRounds = 10;
    bcrypt.genSalt(saltRounds, (err, salt) => {
      if (err) {
        console.error("Erreur lors de la génération du sel:", err);
        res.status(500).send("Erreur interne du serveur");
        return;
      }

      // Hasher le mot de passe avec le sel
      bcrypt.hash(password, salt, (err, hash) => {
        if (err) {
          console.error("Erreur lors du hachage du mot de passe:", err);
          res.status(500).send("Erreur interne du serveur");
          return;
        }
        console.log("hash:", hash);
        // Créer un nouvel utilisateur avec le mot de passe hashé
        const newUser = { username, email, password: hash };

        // Insérer le nouvel utilisateur dans la base de données
        db.query("INSERT INTO users SET ?", newUser, (err, result) => {
          if (err) {
            console.error("Erreur lors de la création de l'utilisateur:", err);
            res.status(500).send("Erreur interne du serveur");
            return;
          }
          res.status(201).json({
            message: "Utilisateur créé avec succès !",
            user: result,
          });
        });
      });
    });
  });
};

export const getUserRole = (req, res) => {
  const userId = req.userId;
  console.log("userId get user role", userId);
  // Vérifier si l'ID de l'utilisateur est fourni
  if (!userId) {
    return res.status(400).json({ error: "ID utilisateur manquant" });
  }

  // Requête pour récupérer le rôle de l'utilisateur par ID
  const query = "SELECT role FROM users WHERE id = ?";

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error("Erreur lors de la récupération du rôle:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    if (result.length === 0) {
      // Si l'utilisateur n'est pas trouvé
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Retourner le rôle de l'utilisateur
    const userRole = result[0].role;
    return res.status(200).json({ role: userRole });
  });
};

export const updateUser = (req, res) => {
  const userId = req.params.id;
  const { role, email, username } = req.body;
  console.log("req.body", req.body);
  if (!username || !email || !role) {
    return res
      .status(400)
      .json({ error: "Tous les champs doivent être remplis" });
  }

  const query =
    "UPDATE users SET role = ?, email = ?, username = ? WHERE id = ?";
  db.query(query, [role, email, username, userId], (err, result) => {
    if (err) {
      console.error("Erreur lors de la mise à jour du rôle :", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    return res.status(200).json({ message: "Rôle mis à jour avec succès." });
  });
};

export const deleteUser = (req, res) => {
  const userId = req.params.id;
  console.log("userId", userId);

  if (!userId) {
    return res.status(400).json({ error: "ID de l'utilisateur manquant" });
  }
  console.log("on verifie qu'on a l'user id ");
  // Requêtes pour supprimer les entités liées à l'utilisateur
  const deleteQueries = [
    `DELETE FROM notes_field WHERE id_note IN (SELECT id_note FROM note WHERE id_user = ?)`,
    `DELETE FROM note WHERE id_user = ?`,
    `DELETE FROM todolist WHERE id_user = ?`,
    `DELETE FROM rooms WHERE user_id = ?`,
    `DELETE FROM lights WHERE id_user = ?`,
    `DELETE FROM huebridgetokens WHERE user_id = ?`,
    `DELETE FROM nanoleaftoken WHERE user_id = ?`,
  ];
  console.log("deleteQueries", deleteQueries);
  db.beginTransaction((err) => {
    if (err) {
      console.log("Erreur lors du demarrage de la transaction");
      return res
        .status(500)
        .json({ error: "Erreur lors du démarrage de la transaction" });
    }

    // Fonction pour exécuter chaque requête de suppression
    const executeQuery = (index) => {
      console.log("On execute la requête ");
      console.log("index", index);
      console.log("deleteQueries.length", deleteQueries.length);
      if (index >= deleteQueries.length) {
        console.log("On execute la requête de suppression de l'utilisateur");
        // Supprimer l'utilisateur après avoir supprimé les entités associées
        db.query("DELETE FROM users WHERE id = ?", [userId], (err, result) => {
          if (err) {
            return db.rollback(() => {
              return res.status(500).json({
                error: "Erreur lors de la suppression de l'utilisateur",
              });
            });
          }

          // Confirmer la transaction si tout est correct
          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                return res.status(500).json({
                  error: "Erreur lors de la validation de la transaction",
                });
              });
            }
            res
              .status(200)
              .json({ message: "Utilisateur supprimé avec succès" });
          });
        });
      } else {
        console.log("On execute la requête de suppression de l'utilisateur");
        db.query(deleteQueries[index], [userId], (err) => {
          if (err) {
            console.error("Erreur lors de la suppression :", err);
            return db.rollback(() => {
              return res.status(500).json({
                error: "Erreur lors de la suppression des données associées",
              });
            });
          }
          // Passer à la prochaine requête de suppression
          executeQuery(index + 1);
        });
      }
    };

    // Lancer l'exécution des requêtes
    executeQuery(0);
  });
};
