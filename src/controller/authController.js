import jwt from "jsonwebtoken";
import User from "../model/userModels.mjs";

export const login = async (req, res) => {
  // Extraire les informations d'identification de la requête
  const { email, password } = req.body;

  try {
    // Vérifier les informations d'identification par rapport à celles stockées en base de données
    const userModel = new User();
    userModel.comparePassword(email, password, async (err, isMatch) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }

      // Vérifier si le mot de passe correspond
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid email or password" });
      }

      // Récupérer l'utilisateur à l'aide de l'e-mail
      userModel.getUserByEmail(email, async (err, user) => {
        if (err) {
          return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
        }
        // Générer un token d'authentification
        const token = generateToken(user.id);

        // Renvoyer une réponse avec le token
        return res.status(200).json({ success: true, token });
      });
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

function generateToken(userId) {
  // Créer le token en incluant l'ID de l'utilisateur et une clé secrète
  const token = jwt.sign({ userId }, "xyuituerg");

  return token;
}
