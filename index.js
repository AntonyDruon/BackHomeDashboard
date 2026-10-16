import express from "express";
import cors from "cors";
import "./db.js"; // charge .env et vérifie les variables avant tout
import routes from "./src/route/route.js";

const app = express();
app.disable("x-powered-by");

// Derrière nginx : nécessaire pour que la limite de débit voie la vraie IP
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));

// L'app mobile n'a pas besoin de CORS. Activé seulement si une origine web
// est listée dans CORS_ORIGIN (séparées par des virgules).
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) }));
}

app.use(express.json({ limit: "100kb" }));
app.use("/", routes);

// Erreurs non gérées (JSON invalide, etc.) : pas de pile d'appel renvoyée
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON" });
  }
  console.error("Erreur non gérée :", err.message);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.LISTEN_HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
});
