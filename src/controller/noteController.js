import db from "../../db.js";

export const createNote = (req, res) => {
  try {
    console.log("req.body", req.body);
    const { name } = req.body;
    const userId = req.userId;

    console.log("userId", userId);
    console.log("name", name);

    if (!name || !userId) {
      return res.status(400).json({ message: "Name and user ID are required" });
    }

    const query = "INSERT INTO Note (Name, id_user) VALUES (?, ?)";
    const values = [name, userId];

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to create note" });
      }

      return res.status(201).json({
        message: "Note created successfully",
        noteId: results.insertId,
      });
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const getNotes = (req, res) => {
  try {
    const userId = req.userId;
    db.query(
      "SELECT * FROM note WHERE id_user = ?",
      [userId],
      (error, results) => {
        if (error) {
          console.error("Error executing query:", error);
          return res.status(500).json({ message: "Failed to execute query" });
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
export const getNoteById = (req, res) => {
  try {
    const noteId = req.params.id;
    db.query("SELECT * FROM note WHERE id = ?", [noteId], (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to execute query" });
      } else if (results.length === 0) {
        return res.status(404).json({ message: "Note not found" });
      } else {
        res.status(200).json(results[0]);
      }
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const createFieldNote = (req, res) => {
  try {
    const { title, id_note } = req.body;
    const query = "INSERT INTO notes_field (titre, id_note) VALUES (?, ?)";
    const values = [title, id_note];
    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to create field" });
      } else {
        return res.status(201).json({
          message: "Field created successfully",
          fieldId: results.insertId,
        });
      }
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const getNotesField = (req, res) => {
  try {
    const noteId = req.params.id;
    db.query(
      "SELECT * FROM notes_field WHERE id_note = ?",
      [noteId],
      (error, results) => {
        if (error) {
          console.error("Error executing query:", error);
          return res.status(500).json({ message: "Failed to execute query" });
        } else {
          res.status(200).json(results);
        }
      }
    );
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
