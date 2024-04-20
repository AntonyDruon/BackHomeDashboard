import UserModel from "../model/userModels.mjs";
import db from "../../db.js";
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

  console.log(username, email, password);

  // Vérifier si toutes les données nécessaires sont fournies
  if (!username || !email || !password) {
    res.status(400).json({ error: "Tous les champs doivent être remplis." });
    return;
  }

  // Créer un nouvel utilisateur avec les données fournies
  const newUser = { username, email, password };

  // Insérer le nouvel utilisateur dans la base de données
  db.query("INSERT INTO users SET ?", newUser, (err, result) => {
    if (err) {
      console.error("Error creating user:", err);
      res.status(500).send("Internal Server Error");
      return;
    }
    res
      .status(201)
      .json({ message: "Utilisateur créé avec succès !", user: result });
  });
};
