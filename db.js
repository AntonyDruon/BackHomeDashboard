import mysql from "mysql2";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// .env à côté de ce fichier (indépendant du dossier de lancement).
// Noms préfixés DB_ : la variable système USER écrasait l'ancien "USER".
dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

for (const key of ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Variable d'environnement manquante : ${key}`);
    process.exit(1);
  }
}

// Pool : se reconnecte tout seul si MariaDB redémarre (l'ancienne connexion
// unique restait morte jusqu'au redémarrage de l'app).
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  // DATE renvoyées telles quelles ("2026-10-20") : évite les décalages de fuseau
  dateStrings: ["DATE"],
});

pool.query("SELECT 1", (err) => {
  if (err) console.error("Base de données injoignable :", err.code);
  else console.log("Connexion à la base OK");
});

// db.query(sql, params, callback) : comme avant.
// db.query(sql, params) sans callback : renvoie une Promise des lignes
// (les anciens `await db.query(...)` ne recevaient rien d'exploitable).
const db = {
  query(sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = undefined;
    }
    if (callback) return pool.query(sql, params, callback);
    return pool
      .promise()
      .query(sql, params)
      .then(([rows]) => rows);
  },
  // Pour les transactions (une seule connexion pour BEGIN/COMMIT)
  getConnection: () => pool.promise().getConnection(),
};

export default db;
