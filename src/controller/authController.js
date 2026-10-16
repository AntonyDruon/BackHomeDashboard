import jwt from "jsonwebtoken";
import User from "../model/userModels.mjs";

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "90d";

export const login = (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required" });
  }

  const userModel = new User();
  userModel.comparePassword(email, password, (err, isMatch) => {
    if (err) {
      console.error("Erreur login :", err.code || err.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    userModel.getUserByEmail(email, (err, user) => {
      if (err || !user) {
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: TOKEN_TTL,
      });
      return res.status(200).json({ success: true, token });
    });
  });
};
