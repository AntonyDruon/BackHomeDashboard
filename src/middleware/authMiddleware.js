import { jwtDecode } from "jwt-decode";

const authMiddleware = (req, res, next) => {
  // Récupérer le token JWT de la requête
  const token = req.headers.authorization?.split(" ")[1];
  console.log("req.headers.authorization", req.headers.authorization);
  console.log("tokenMiddlewar", token);

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    // Vérifier le token et décoder son contenu
    const decoded = jwtDecode(token);
    console.log("decoded", decoded);
    req.userId = decoded.userId; // Ajouter l'id de l'utilisateur à req.userId
    console.log("req.userId", req.userId);
    next();
  } catch (error) {
    return res.status(403).json({ message: "Unauthorized" });
  }
};

export default authMiddleware;
