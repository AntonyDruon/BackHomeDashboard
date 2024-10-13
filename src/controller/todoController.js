import db from "../../db.js"; // Assurez-vous que votre fichier de base de données est importé correctement

// Récupérer toutes les tâches pour un utilisateur
export const getTodos = (req, res) => {
  try {
    const userId = req.userId; // ID de l'utilisateur depuis le token
    db.query(
      "SELECT * FROM todolist WHERE id_user = ?",
      [userId],
      (error, results) => {
        if (error) {
          console.error("Error executing query:", error);
          return res.status(500).json({ message: "Failed to execute query" });
        }
        res.status(200).json(results); // Renvoie toutes les tâches
      }
    );
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Créer une nouvelle tâche
export const createTodo = (req, res) => {
  console.log("req.body", req.body);
  try {
    const { title, date, status, priorite } = req.body;
    const userId = req.userId; // ID de l'utilisateur depuis le token

    if (!title || !date || !status || !priorite) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const query =
      "INSERT INTO todolist (titre, date, status, priorite, id_user) VALUES (?, ?, ?, ?, ?)";
    const values = [title, date, status, priorite, userId];

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to create todo" });
      }

      return res.status(201).json({
        message: "Todo created successfully",
        todoId: results.insertId,
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Mettre à jour une tâche existante
export const updateTodo = (req, res) => {
  try {
    const { title, date, status, priorite, updated_at } = req.body;
    const todoId = req.params.id;
    const userId = req.userId;
    const updatedAt = new Date().toISOString().slice(0, 19).replace("T", " "); // Format to 'YYYY-MM-DD HH:MM:SS'

    const query =
      "UPDATE todolist SET titre = ?, date = ?, status = ?, priorite = ?, updated_at = ? WHERE id_todo = ? AND id_user = ?";
    const values = [title, date, status, priorite, updatedAt, todoId, userId];

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to update todo" });
      }
      res.status(200).json({ message: "Todo updated successfully" });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateTitleTodo = (req, res) => {
  try {
    const { titre, updated_at } = req.body;
    console.log(
      "req.bodyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
      req.body
    );
    const todoId = req.params.id;
    const userId = req.userId;
    const updatedAt = new Date().toISOString().slice(0, 19).replace("T", " "); // Format to 'YYYY-MM-DD HH:MM:SS'

    const query =
      "UPDATE todolist SET titre = ?, updated_at = ? WHERE id_todo = ? AND id_user = ?";
    const values = [titre, updatedAt, todoId, userId];

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to update todo" });
      }
      res.status(200).json({ message: "TodoTitle updated successfully" });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const updateDateTodo = (req, res) => {
  try {
    const { date, updated_at } = req.body;
    const todoId = req.params.id;
    const userId = req.userId;
    const updatedAt = new Date().toISOString().slice(0, 19).replace("T", " "); // Format to 'YYYY-MM-DD HH:MM:SS'

    const query =
      "UPDATE todolist SET date = ?, updated_at = ? WHERE id_todo = ? AND id_user = ?";
    const values = [date, updatedAt, todoId, userId];

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to update todo" });
      }
      res.status(200).json({ message: "Todo updated successfully" });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Supprimer une tâche
export const deleteTodo = (req, res) => {
  try {
    const todoId = req.params.id;
    const userId = req.userId;

    const query = "DELETE FROM todolist WHERE id_todo = ? AND id_user = ?";
    db.query(query, [todoId, userId], (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to delete todo" });
      }
      res.status(200).json({ message: "Todo deleted successfully" });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
