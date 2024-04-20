import express from "express";
const router = express.Router();

// Dynamic import of controllers
const { getAllUsers, createUser } = await import(
  "../controller/userController.mjs"
);

// Define routes
router.get("/users", getAllUsers);
router.get("/users/:id", getAllUsers);
router.post("/users/new", createUser);

// Export the router
export default router;
