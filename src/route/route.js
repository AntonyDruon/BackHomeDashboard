import express from "express";
const router = express.Router();
import authMiddleware from "../middleware/authMiddleware.js"; // Importez le middleware

// Dynamic import of controllers
import { getAllUsers, createUser } from "../controller/userController.js";
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
} from "../controller/noteController.js";
import {
  createTodo,
  getTodos,
  updateTodo,
  deleteTodo,
} from "../controller/todoController.js"; // Import des contrôleurs de la Todolist

// Define routes

// user routes
router.get("/users", getAllUsers);
router.get("/users/:id", getAllUsers);
router.post("/users/new", createUser);
router.post("/users/login", login);

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
router.get("/notes/getNotes", authMiddleware, getNotes);
router.post("/notes/new", authMiddleware, createNote);
router.get("/notes/:id", authMiddleware, getNoteById);
router.post("/notes/new/field", authMiddleware, createFieldNote);
router.get("/notes/field/:id", authMiddleware, getNotesField);

// todo routes
router.get("/todos", authMiddleware, getTodos); // Récupérer toutes les tâches d'un utilisateur
// todo routes
router.post("/todos/new", authMiddleware, createTodo); // Assure-toi que cette ligne est correcte
router.put("/todos/update/:id", authMiddleware, updateTodo); // Mettre à jour une tâche
router.delete("/todos/delete/:id", authMiddleware, deleteTodo); // Supprimer une tâche

export default router;
