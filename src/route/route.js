import express from "express";
const router = express.Router();
import authMiddleware from "../middleware/authMiddleware.js"; // Importez le middleware

// Dynamic import of controllers
import {
  getAllUsers,
  createUser,
  getUserRole,
  updateUser,
  deleteUser,
} from "../controller/userController.js";
import { login } from "../controller/authController.js";
import {
  insertHueBridgeToken,
  getHueBridgeToken,
  insertDataHueLights,
  getAllLights,
  modifyStatusHueLights,
  insertTokenNanoleaf,
  getNanoleafToken,
  insertDataNanoleafLights,
  getDataNanoleafBDD,
} from "../controller/lightController.js";
import { createRoom } from "../controller/roomController.js";
import { getAllRooms } from "../controller/roomController.js";
import {
  createNote,
  getNotes,
  getNoteById,
  createFieldNote,
  getNotesField,
  deleteNote, // Importer la fonction pour supprimer une note
  updateFieldNote,
  updateNote, // Importer la fonction pour mettre à jour un field
  deleteFieldNote,
  // Importer la fonction pour supprimer un field
} from "../controller/noteController.js";
import {
  createTodo,
  getTodos,
  updateTodo,
  deleteTodo,
  updateTitleTodo,
  updateDateTodo,
} from "../controller/todoController.js"; // Import des contrôleurs de la Todolist

// Define routes

// user routes
// router.get("/users", authMiddleware, getAllUsers);
router.get(
  "/users",
  (req, res, next) => {
    console.log("on recupere tout les users:"); // Log des données de la requête
    next(); // Passe à la fonction de contrôleur login
  },
  authMiddleware,
  getAllUsers
);
router.post("/users/new", createUser);
router.post(
  "/users/login",
  (req, res, next) => {
    console.log("Received login request:", req.body); // Log des données de la requête
    next(); // Passe à la fonction de contrôleur login
  },
  login
);
router.get(
  "/users/role/:id",
  (req, res, next) => {
    console.log("Headers de la requêteeeeeeeeeee :", req.headers); // Log tous les headers
    next();
  },
  authMiddleware,
  getUserRole
);
router.put("/users/update/:id", authMiddleware, updateUser);
router.delete("/users/delete/:id", authMiddleware, deleteUser);

// light routes
router.post(
  "/lights/insertHueBridgeToken",
  authMiddleware,
  insertHueBridgeToken
);
router.get("/lights/getHueBridgeToken", authMiddleware, getHueBridgeToken);
router.post("/lights/insertDataHueLights", authMiddleware, insertDataHueLights);
router.get("/lights/getDataHueLights", authMiddleware, getAllLights);
router.post(
  "/lights/modifyStatusHueLights/all",
  authMiddleware,
  modifyStatusHueLights
);
router.post("/lights/insertNanoleafToken", authMiddleware, insertTokenNanoleaf);
router.get("/lights/getNanoleafToken", authMiddleware, getNanoleafToken);
router.post(
  "/lights/insertDataNanoleaf",
  authMiddleware,
  insertDataNanoleafLights
);
router.get("/lights/getDataNanoleafBDD", authMiddleware, getDataNanoleafBDD);
router.put(
  "/lights/modifyStatusNanoleaf",
  authMiddleware,
  modifyStatusHueLights
);

// room routes
router.get("/rooms", authMiddleware, getAllRooms);
router.post("/rooms/new", authMiddleware, createRoom);

// note routes
router.get("/notes/getNotes", authMiddleware, getNotes); // Récupérer toutes les notes
router.post("/notes/new", authMiddleware, createNote); // Creer une nouvelle note
router.get("/notes/:id", authMiddleware, getNoteById); // Récupérer une note
router.put("/notes/update/:id", authMiddleware, updateNote); // Mettre à jourune note
router.delete("/notes/delete/:id", authMiddleware, deleteNote); // Supprimer une note

// notefield routes
router.post("/notes/new/field", authMiddleware, createFieldNote); // création d'un nouveau field
router.get("/notes/field/:id", authMiddleware, getNotesField); // Récupérer tous les fields d'une note
router.put("/notes/field/update/:id", authMiddleware, updateFieldNote); // Mettre à jour un field d'une note
router.delete("/notes/field/delete/:id", authMiddleware, deleteFieldNote); // Supprimer un field d'une note

// todo routes
router.get("/todos", authMiddleware, getTodos); // Récupérer toutes les tâches d'un utilisateur
router.post("/todos/new", authMiddleware, createTodo); // Créer une nouvelle tâche
router.put("/todos/update/:id", authMiddleware, updateTodo); // Mettre à jour une tâche
router.delete("/todos/delete/:id", authMiddleware, deleteTodo); // Supprimer une tâche
router.put(
  "/todos/updateTitle/:id",
  (req, res, next) => {
    console.log("Received Update title request:", req.body); // Log des données de la requête
    next(); // Passe à la fonction de contrôleur login
  },
  authMiddleware,
  updateTitleTodo
); // Mettre à jour une tâche
router.put(
  "/todos/updateDate/:id",
  (req, res, next) => {
    console.log("Received Update Date request:", req.body); // Log des données de la requête
    next(); // Passe à la fonction de contrôleur login
  },
  authMiddleware,
  updateDateTodo
); // Mettre à jour une tâche
export default router;
