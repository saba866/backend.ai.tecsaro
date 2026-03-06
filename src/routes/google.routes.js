import express from "express"
import { authMiddleware } from "../middlewares/auth.js"
import {
  googleConnect,
  googleCallback,

} from "../controllers/google.controller.js"
import { listGAProperties } from "../controllers/ga.controller.js"
const router = express.Router()

router.get("/connect", authMiddleware, googleConnect)
router.get("/callback", googleCallback)


router.get("/ga-properties", authMiddleware, listGAProperties)
export default router
