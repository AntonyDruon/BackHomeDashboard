import db from "../../db.js";

// Créer une note
export const createNote = (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.userId;

    if (!name || !userId) {
      return res.status(400).json({ message: "Name and user ID are required" });
    }

    const query = "INSERT INTO note (Name, id_user) VALUES (?, ?)";
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

// Récupérer toutes les notes d'un utilisateur
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
          res.status(200).json(results);
        }
      }
    );
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Récupérer une note par son ID
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

// Mettre à jour une note
export const updateNote = (req, res) => {
  try {
    const { name } = req.body;
    const noteId = req.params.id;

    const query = "UPDATE note SET Name = ? WHERE id_note = ?";
    const values = [name, noteId];

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to update note" });
      }

      return res.status(200).json({ message: "Note updated successfully" });
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Supprimer une note
export const deleteNote = (req, res) => {
  try {
    const noteId = req.params.id;
    console.log("noteId", noteId);
    // Commencez par supprimer les fields associés à la note
    const deleteFieldsQuery = "DELETE FROM notes_field WHERE id_note = ?";
    db.query(deleteFieldsQuery, [noteId], (error, fieldResults) => {
      if (error) {
        console.error("Error deleting fields associated with the note:", error);
        return res.status(500).json({
          message: "Failed to delete fields associated with the note",
        });
      }

      // Ensuite, supprimez la note elle-même
      const deleteNoteQuery = "DELETE FROM note WHERE id_note = ?";
      db.query(deleteNoteQuery, [noteId], (error, noteResults) => {
        if (error) {
          console.error("Error deleting note:", error);
          return res.status(500).json({ message: "Failed to delete note" });
        }

        return res
          .status(200)
          .json({ message: "Note and associated fields deleted successfully" });
      });
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Créer un champ (field) dans une note
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

// Récupérer les champs (fields) d'une note
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

// Mettre à jour un field d'une note
export const updateFieldNote = (req, res) => {
  try {
    const { title } = req.body;
    const fieldId = req.params.id;

    const query = "UPDATE notes_field SET titre = ? WHERE id_field = ?";
    const values = [title, fieldId];

    db.query(query, values, (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to update field" });
      }

      return res.status(200).json({ message: "Field updated successfully" });
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Supprimer un field d'une note
export const deleteFieldNote = (req, res) => {
  try {
    const fieldId = req.params.id;

    const query = "DELETE FROM notes_field WHERE id_field = ?";
    db.query(query, [fieldId], (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        return res.status(500).json({ message: "Failed to delete field" });
      }
      console.log("results:", results);
      return res.status(200).json({ message: "Field deleted successfully" });
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
