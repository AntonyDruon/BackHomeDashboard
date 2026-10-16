import db from "../../db.js";
import bcrypt from "bcryptjs";

// Hash factice : on compare quand même quand l'email est inconnu,
// pour ne pas révéler par le temps de réponse quels emails existent.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

class UserModel {
  getUserById(userId, callback) {
    db.query(
      "SELECT id, username, email, role FROM users WHERE id = ?",
      [userId],
      callback
    );
  }

  getUserByEmail(email, callback) {
    db.query(
      "SELECT id, username, email, role FROM users WHERE email = ?",
      [email],
      (err, results) => {
        if (err) return callback(err);
        return callback(null, results[0] || null);
      }
    );
  }

  comparePassword(email, password, callback) {
    db.query(
      "SELECT password FROM users WHERE email = ?",
      [email],
      (err, results) => {
        if (err) return callback(err);
        const hash = results.length ? results[0].password : DUMMY_HASH;
        bcrypt.compare(password, hash, (compareErr, isMatch) => {
          if (compareErr) return callback(compareErr);
          callback(null, results.length > 0 && isMatch);
        });
      }
    );
  }
}

export default UserModel;
