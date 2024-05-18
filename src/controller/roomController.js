import db from "../../db.js";

export const getAllRooms = async (req, res) => {
  try {
    const userId = req.userId;
    db.query(
      "SELECT * FROM rooms WHERE user_id = ?",
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

export const createRoom = async (req, res) => {
  try {
    const { name } = req.body;
    console.log("name", name);
    const userId = req.userId;
    console.log("userId", userId);

    // Input validation
    if (!name) {
      return res.status(400).json({ message: "Room name is required" });
    }

    const result = await db.query(
      "INSERT INTO rooms (name, user_id) VALUES (?, ?)",
      [name, userId]
    );

    // Check for error
    if (result instanceof Error) {
      console.error("Error executing query:", result);
      return res.status(500).json({ message: "Failed to execute query" });
    }

    // Check if insertion was successful

    // Return the ID of the newly created room
    res
      .status(201)
      .json({ "la salle à bien été crée": name, roomId: result.insertId });

    // If insertion failed for some reason
    //   res.status(500).json({ message: "Failed to create room" });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
