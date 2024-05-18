import db from "../../db.js";
import bcrypt from "bcrypt";

class UserModel {
  constructor() {}

  getAllUsers(callback) {
    db.query("SELECT * FROM users", callback);
  }

  getUserById(userId, callback) {
    db.query("SELECT * FROM users WHERE id = ?", [userId], callback);
  }
  async getUserByEmail(email, callback) {
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
      if (err) {
        return callback(err);
      }
      if (results.length === 0) {
        return callback(null, null); // User not found
      }
      return callback(null, results[0]);
    });
  }
  async comparePassword(email, password, callback) {
    db.query(
      "SELECT password FROM users WHERE email = ?",
      [email],
      (err, results) => {
        if (err) {
          return callback(err);
        }
        if (results.length === 0) {
          return callback(null, false); // User not found
        }
        const hashedPassword = results[0].password;
        bcrypt.compare(password, hashedPassword, (compareErr, isMatch) => {
          if (compareErr) {
            return callback(compareErr);
          }
          callback(null, isMatch);
        });
      }
    );
  }
}

export default UserModel;
