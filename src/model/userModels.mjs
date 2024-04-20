import db from "../../db.js";

class UserModel {
  constructor() {
    // Pas besoin de lier les méthodes dans ES6
  }

  getAllUsers(callback) {
    db.query("SELECT * FROM users", callback);
  }

  getUserById(userId, callback) {
    db.query("SELECT * FROM users WHERE id = ?", [userId], callback);
  }
}

export default UserModel;
