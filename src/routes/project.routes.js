



import express from "express"
import { authMiddleware } from "../middlewares/auth.js"
import {
  createProject,
  getProjects,
} from "../controllers/project.controller.js"

const router = express.Router()

// create project
router.post("/", authMiddleware, createProject)

// get all user projects
router.get("/", authMiddleware, getProjects)

export default router
