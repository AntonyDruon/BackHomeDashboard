import mysql from "mysql";
import dotenv from "dotenv";

// Charger les variables d'environnement depuis le fichier .env
dotenv.config();

console.log("HOST:", process.env.HOST);
console.log("USER:", process.env.USER);
console.log("PASSWORD:", process.env.PASSWORD);
console.log("DATABASE:", process.env.DATABASE);

const connection = mysql.createConnection({
  host: process.env.HOST, // utilise la variable HOST du fichier .env
  user: process.env.USER, // utilise la variable USER du fichier .env
  password: process.env.PASSWORD, // utilise la variable PASSWORD du fichier .env
  database: process.env.DATABASE, // utilise la variable DATABASE du fichier .env
});

// Vérifie si la connexion est réussie
connection.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données :", err);
  } else {
    console.log("Connexion réussie à la base de données");
  }
});

export default connection;
