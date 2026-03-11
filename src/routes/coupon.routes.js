import express from "express"
import { authMiddleware } from "../middlewares/auth.js"
import {
  validateCoupon,
  applyCoupon,
  createSymbolicOrder,
  verifySymbolicOrder,
  createDiscountedSubscription,
  verifyDiscountedSubscription,
} from "../controllers/coupon.controller.js"

const router = express.Router()

router.post("/validate",                       authMiddleware, validateCoupon)
router.post("/apply",                          authMiddleware, applyCoupon)
router.post("/create-symbolic-order",          authMiddleware, createSymbolicOrder)
router.post("/verify-symbolic-order",          authMiddleware, verifySymbolicOrder)
router.post("/create-discounted-subscription", authMiddleware, createDiscountedSubscription)
router.post("/verify-discounted-subscription", authMiddleware, verifyDiscountedSubscription)

export default router