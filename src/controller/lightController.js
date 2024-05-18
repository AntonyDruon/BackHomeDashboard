import { response } from "express";
import db from "../../db.js";

export const insertHueBridgeToken = async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.userId;

    // Vérifier si l'username est déjà lié à l'utilisateur dans la base de données
    const existingToken = await db.query(
      "SELECT * FROM huebridgetokens WHERE user_id = ?",
      [userId]
    );

    if (existingToken.length > 0) {
      console.log("existingToken", existingToken);
      // Si un token existe déjà, mettez à jour le token existant
      await db.query(
        "UPDATE huebridgetokens SET username = ? WHERE user_id = ?",
        [username, userId]
      );
      res.status(200).json({ message: "Token updated successfully" });
    } else {
      // Si aucun token n'existe, insérez un nouveau token
      await db.query(
        "INSERT INTO huebridgetokens (username, user_id) VALUES (?, ?)",
        [username, userId]
      );
      res.status(200).json({ message: "Token inserted successfully" });
    }
  } catch (error) {
    console.error("Error inserting/updating token:", error);
    res.status(500).json({ error: "Failed to insert/update token" });
  }
};

export const getHueBridgeToken = async (req, res) => {
  try {
    const userId = req.userId;
    console.log("userId", userId);
    db.query(
      "SELECT username FROM huebridgetokens WHERE user_id = ?",
      [userId],
      (error, results) => {
        if (error) {
          console.error("Error executing query:", error);
          res.status(500).json({ message: "Failed to execute query" });
        } else {
          console.log("Results:", results);
          res.status(200).json(results);
        }
      }
    );
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const insertDataHueLights = async (req, res) => {
  const userId = req.userId;
  const { data } = req.body;

  console.log("userId", userId);
  console.log("req.body", data);

  try {
    for (let key in data) {
      if (data.hasOwnProperty(key)) {
        const light = data[key];
        const type = light.productname;
        const name = light.name;
        const state = light.state.on ? 1 : 0; // Convertir l'état booléen en tinyint (1 pour true, 0 pour false)
        const unique_id = light.uniqueid;
        const id_room = null; // Vous pouvez remplacer null par une valeur appropriée si nécessaire

        const insertQuery = `
          INSERT INTO lights (type, name, state, unique_id, id_room, id_user)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        // Exécuter la requête d'insertion pour chaque lampe
        await new Promise((resolve, reject) => {
          db.query(
            insertQuery,
            [type, name, state, unique_id, id_room, userId],
            (error, results) => {
              if (error) {
                console.error("Error inserting light into database:", error);
                return reject(error);
              } else {
                console.log(`Inserted light ${name} into database`);
                resolve(results);
              }
            }
          );
        });
      }
    }

    return res.status(200).json({ message: "Data inserted successfully" });
  } catch (error) {
    console.error("Error inserting lights into database:", error);
    return res
      .status(500)
      .json({ message: "Error inserting lights into database" });
  }
};

export const getAllLights = async (req, res) => {
  try {
    const userId = req.userId;
    db.query(
      "SELECT * FROM lights WHERE id_user = ?",
      [userId],
      (error, results) => {
        if (error) {
          console.error("Error executing query:", error);
          res.status(500).json({ message: "Failed to execute query" });
        } else {
          console.log("Results:", results);
          res.status(200).json(results);
        }
      }
    );
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const modifyStatusHueLights = async (req, res) => {
  try {
    const userId = req.userId;
    const { data } = req.body;
    console.log("data", data);

    // Assurez-vous que vous avez une connexion à votre base de données et un moyen d'exécuter des requêtes SQL
    // Ici, je suppose que vous avez déjà une connexion établie à votre base de données et que vous utilisez une bibliothèque comme mysql ou pg pour exécuter des requêtes

    // Remplacez `db.query` par votre méthode réelle pour exécuter des requêtes SQL
    for (let key in data) {
      if (data.hasOwnProperty(key)) {
        const light = data[key];
        const id_light = light.id_light;
        const state = light.state;

        const updateQuery = `
          UPDATE lights
          SET state = ?
          WHERE id_light = ? AND id_user = ?
        `;

        // Exécutez la requête de mise à jour
        await new Promise((resolve, reject) => {
          db.query(updateQuery, [state, id_light, userId], (error, results) => {
            if (error) {
              console.error("Error updating light:", error);
              return reject(error);
            } else {
              console.log(`Updated light ${id_light}`);
              resolve(results);
            }
          });
        });
      }
    }

    return res.status(200).json({ message: "Lights updated successfully" });
  } catch (error) {
    console.error("Error updating lights:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while updating lights" });
  }
};

// Appliquez le middleware à la route
