import express from "express";
import rateLimit from "express-rate-limit";
import authMiddleware, { requireAdmin } from "../middleware/authMiddleware.js";

import {
  getAllUsers,
  createUser,
  getUserRole,
  updateUser,
  deleteUser,
  getMe,
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
  modifyStatusNanoleafLights,
} from "../controller/lightController.js";
import { createRoom, getAllRooms } from "../controller/roomController.js";
import {
  createNote,
  getNotes,
  getNoteById,
  createFieldNote,
  getNotesField,
  deleteNote,
  updateFieldNote,
  updateNote,
  deleteFieldNote,
} from "../controller/noteController.js";
import {
  createTodo,
  getTodos,
  updateTodo,
  deleteTodo,
  updateTitleTodo,
  updateDateTodo,
} from "../controller/todoController.js";
import { getBus118 } from "../controller/transportController.js";
import {
  getLightsStatus,
  pairHue,
  unpairHue,
  setHueLight,
  pairNanoleaf,
  unpairNanoleaf,
  setNanoleafState,
} from "../controller/homeLightsController.js";
import {
  getPcStatus,
  getPcHistory,
  getPcLighting,
  setPcLighting,
  getPcFans,
  setPcFans,
} from "../controller/pcController.js";

const router = express.Router();

// Anti force brute : 10 tentatives de connexion / 15 min / IP,
// 5 créations de compte / heure / IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Trop de tentatives, réessayez plus tard." },
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop de créations de compte, réessayez plus tard." },
});

// --- Utilisateurs ---
router.post("/users/new", signupLimiter, createUser);
router.post("/users/login", loginLimiter, login);
router.get("/users/me", authMiddleware, getMe);
router.get("/users/role/:id", authMiddleware, getUserRole); // :id ignoré, rôle de l'utilisateur connecté
// Administration : réservé aux admins
router.get("/users", authMiddleware, requireAdmin, getAllUsers);
router.put("/users/update/:id", authMiddleware, requireAdmin, updateUser);
router.delete("/users/delete/:id", authMiddleware, requireAdmin, deleteUser);

// --- Lumières ---
router.post("/lights/insertHueBridgeToken", authMiddleware, insertHueBridgeToken);
router.get("/lights/getHueBridgeToken", authMiddleware, getHueBridgeToken);
router.post("/lights/insertDataHueLights", authMiddleware, insertDataHueLights);
router.get("/lights/getDataHueLights", authMiddleware, getAllLights);
router.post("/lights/modifyStatusHueLights/all", authMiddleware, modifyStatusHueLights);
router.post("/lights/insertNanoleafToken", authMiddleware, insertTokenNanoleaf);
router.get("/lights/getNanoleafToken", authMiddleware, getNanoleafToken);
router.post("/lights/insertDataNanoleaf", authMiddleware, insertDataNanoleafLights);
router.get("/lights/getDataNanoleafBDD", authMiddleware, getDataNanoleafBDD);
// URL appelée par l'app (nanoleafApiSlice) ; l'ancienne route est gardée
router.put("/lights/modifyStatusNanoleafLights/all", authMiddleware, modifyStatusNanoleafLights);
router.put("/lights/modifyStatusNanoleaf", authMiddleware, modifyStatusNanoleafLights);

// Pilotage par le serveur (web app) : état, appairage, commandes
const pairLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
router.get("/lights/status", authMiddleware, getLightsStatus);
router.post("/lights/hue/pair", authMiddleware, pairLimiter, pairHue);
router.delete("/lights/hue/pair", authMiddleware, unpairHue);
router.put("/lights/hue/:id", authMiddleware, setHueLight);
router.post("/lights/nanoleaf/pair", authMiddleware, pairLimiter, pairNanoleaf);
router.delete("/lights/nanoleaf/pair", authMiddleware, unpairNanoleaf);
router.put("/lights/nanoleaf", authMiddleware, setNanoleafState);

// --- PC Windows (agent) : réservé aux administrateurs ---
router.get("/pc/status", authMiddleware, requireAdmin, getPcStatus);
router.get("/pc/history", authMiddleware, requireAdmin, getPcHistory);
router.get("/pc/lighting", authMiddleware, requireAdmin, getPcLighting);
router.post("/pc/lighting", authMiddleware, requireAdmin, setPcLighting);
router.get("/pc/fans", authMiddleware, requireAdmin, getPcFans);
router.post("/pc/fans", authMiddleware, requireAdmin, setPcFans);

// --- Pièces ---
router.get("/rooms", authMiddleware, getAllRooms);
router.post("/rooms/new", authMiddleware, createRoom);

// --- Notes ---
router.get("/notes/getNotes", authMiddleware, getNotes);
router.post("/notes/new", authMiddleware, createNote);
router.post("/notes/new/field", authMiddleware, createFieldNote);
router.get("/notes/field/:id", authMiddleware, getNotesField);
router.put("/notes/field/update/:id", authMiddleware, updateFieldNote);
router.delete("/notes/field/delete/:id", authMiddleware, deleteFieldNote);
router.get("/notes/:id", authMiddleware, getNoteById);
router.put("/notes/update/:id", authMiddleware, updateNote);
router.delete("/notes/delete/:id", authMiddleware, deleteNote);

// --- Transport (bus 118 temps réel, PRIM IDFM) ---
router.get("/transport/118", authMiddleware, getBus118);

// --- Todos ---
router.get("/todos", authMiddleware, getTodos);
router.post("/todos/new", authMiddleware, createTodo);
router.put("/todos/update/:id", authMiddleware, updateTodo);
router.delete("/todos/delete/:id", authMiddleware, deleteTodo);
router.put("/todos/updateTitle/:id", authMiddleware, updateTitleTodo);
router.put("/todos/updateDate/:id", authMiddleware, updateDateTodo);

export default router;
