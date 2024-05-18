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
} from "../controller/lightController.js";
import { createRoom } from "../controller/roomController.js";
import { getAllRooms } from "../controller/roomController.js";

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
// room routes
router.get("/rooms", authMiddleware, getAllRooms);
router.post("/rooms/new", authMiddleware, createRoom);

export default router;
