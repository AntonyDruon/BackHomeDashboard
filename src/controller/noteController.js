import db from "../../db.js";

// Toutes les requêtes filtrent sur req.userId (issu d'un jeton vérifié) :
// un utilisateur ne peut lire ou modifier que ses propres notes.

const OWNS_NOTE = "SELECT id_note FROM note WHERE id_note = ? AND id_user = ?";
const OWNS_FIELD =
  "SELECT f.id_field FROM notes_field f JOIN note n ON n.id_note = f.id_note WHERE f.id_field = ? AND n.id_user = ?";

// Vérifie l'appartenance puis exécute la suite ; 404 si l'objet n'est pas à l'utilisateur
const checkOwnership = (res, query, id, userId, next) => {
  db.query(query, [id, userId], (error, results) => {
    if (error) {
      console.error("Erreur vérification propriétaire:", error.code);
      return res.status(500).json({ message: "Internal server error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    next();
  });
};

// Créer une note
export const createNote = (req, res) => {
  const { name } = req.body;
  const userId = req.userId;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  db.query(
    "INSERT INTO note (name, id_user) VALUES (?, ?)",
    [name, userId],
    (error, results) => {
      if (error) {
        console.error("Erreur création note:", error.code);
        return res.status(500).json({ message: "Failed to create note" });
      }
      return res.status(201).json({
        message: "Note created successfully",
        noteId: results.insertId,
      });
    }
  );
};

// Récupérer toutes les notes de l'utilisateur
export const getNotes = (req, res) => {
  db.query(
    "SELECT * FROM note WHERE id_user = ?",
    [req.userId],
    (error, results) => {
      if (error) {
        console.error("Erreur lecture notes:", error.code);
        return res.status(500).json({ message: "Failed to execute query" });
      }
      res.status(200).json(results);
    }
  );
};

// Récupérer une note par son ID
export const getNoteById = (req, res) => {
  db.query(
    "SELECT * FROM note WHERE id_note = ? AND id_user = ?",
    [req.params.id, req.userId],
    (error, results) => {
      if (error) {
        console.error("Erreur lecture note:", error.code);
        return res.status(500).json({ message: "Failed to execute query" });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.status(200).json(results[0]);
    }
  );
};

// Mettre à jour une note
export const updateNote = (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }
  db.query(
    "UPDATE note SET name = ? WHERE id_note = ? AND id_user = ?",
    [name, req.params.id, req.userId],
    (error, results) => {
      if (error) {
        console.error("Erreur mise à jour note:", error.code);
        return res.status(500).json({ message: "Failed to update note" });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: "Note not found" });
      }
      return res.status(200).json({ message: "Note updated successfully" });
    }
  );
};

// Supprimer une note (et ses fields)
export const deleteNote = (req, res) => {
  const noteId = req.params.id;
  checkOwnership(res, OWNS_NOTE, noteId, req.userId, () => {
    db.query("DELETE FROM notes_field WHERE id_note = ?", [noteId], (error) => {
      if (error) {
        console.error("Erreur suppression fields:", error.code);
        return res.status(500).json({
          message: "Failed to delete fields associated with the note",
        });
      }
      db.query(
        "DELETE FROM note WHERE id_note = ? AND id_user = ?",
        [noteId, req.userId],
        (error) => {
          if (error) {
            console.error("Erreur suppression note:", error.code);
            return res.status(500).json({ message: "Failed to delete note" });
          }
          return res.status(200).json({
            message: "Note and associated fields deleted successfully",
          });
        }
      );
    });
  });
};

// Créer un field dans une note
export const createFieldNote = (req, res) => {
  const { title, id_note } = req.body;
  if (!title || !id_note) {
    return res.status(400).json({ message: "title and id_note are required" });
  }
  checkOwnership(res, OWNS_NOTE, id_note, req.userId, () => {
    db.query(
      "INSERT INTO notes_field (titre, id_note) VALUES (?, ?)",
      [title, id_note],
      (error, results) => {
        if (error) {
          console.error("Erreur création field:", error.code);
          return res.status(500).json({ message: "Failed to create field" });
        }
        return res.status(201).json({
          message: "Field created successfully",
          fieldId: results.insertId,
        });
      }
    );
  });
};

// Récupérer les fields d'une note
export const getNotesField = (req, res) => {
  db.query(
    "SELECT f.* FROM notes_field f JOIN note n ON n.id_note = f.id_note WHERE f.id_note = ? AND n.id_user = ?",
    [req.params.id, req.userId],
    (error, results) => {
      if (error) {
        console.error("Erreur lecture fields:", error.code);
        return res.status(500).json({ message: "Failed to execute query" });
      }
      res.status(200).json(results);
    }
  );
};

// Mettre à jour un field
export const updateFieldNote = (req, res) => {
  const { title } = req.body;
  const fieldId = req.params.id;
  if (!title) {
    return res.status(400).json({ message: "title is required" });
  }
  checkOwnership(res, OWNS_FIELD, fieldId, req.userId, () => {
    db.query(
      "UPDATE notes_field SET titre = ? WHERE id_field = ?",
      [title, fieldId],
      (error) => {
        if (error) {
          console.error("Erreur mise à jour field:", error.code);
          return res.status(500).json({ message: "Failed to update field" });
        }
        return res.status(200).json({ message: "Field updated successfully" });
      }
    );
  });
};

// Supprimer un field
export const deleteFieldNote = (req, res) => {
  const fieldId = req.params.id;
  checkOwnership(res, OWNS_FIELD, fieldId, req.userId, () => {
    db.query(
      "DELETE FROM notes_field WHERE id_field = ?",
      [fieldId],
      (error) => {
        if (error) {
          console.error("Erreur suppression field:", error.code);
          return res.status(500).json({ message: "Failed to delete field" });
        }
        return res.status(200).json({ message: "Field deleted successfully" });
      }
    );
  });
};
