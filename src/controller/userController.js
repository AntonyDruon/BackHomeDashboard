import UserModel from "../model/userModels.mjs";
import db from "../../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const getAllUsers = (req, res) => {
  const userModel = new UserModel();
  userModel.getAllUsers((err, results) => {
    if (err) {
      console.error("Error getting users:", err);
      res.status(500).send("Internal Server Error");
      return;
    }
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
  console.log("ded");
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
};
