import express from "express";
import { loginUser, registerUser, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
//import User from "../models/userModel.js";

const router = express.Router();

router.post("/signup", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
