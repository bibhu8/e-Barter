// index.js (or server.js)
import express from "express";
import dotenv from "dotenv";
import http from "http";
import connectDB from "./config/db.js";
import itemRoutes from "./routes/itemRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import swapRoutes from "./routes/swapRoutes.js";
import cors from "cors";
import { initializeSocket } from "./socket.js";  // Import the socket initialization function
import chatRoutes from "./routes/chatRoutes.js";
import { saveChatMessageSocket } from "./controllers/chatController.js"; // New socket function

import session from "express-session";
import passport from "./googleAuth.js"; // File that configures Passport with Google OAuth strategy
import jwt from "jsonwebtoken";
import { handleGoogleCallback, getMe } from "./controllers/authController.js";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Create HTTP server and attach it to the app
const server = http.createServer(app);

// Initialize Socket.IO and attach to the server
export const io = initializeSocket(server);

// Database Connection
connectDB();

// Middleware
app.use(cors({
  origin: '*', // React app URL
  
}));

app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Configure session middleware (required for Passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cats', // Consider moving this to .env for production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  })
);

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ----- Google Auth Routes -----
// Route to initiate Google authentication
app.get("/auth/google/new", (req, res) => {
  // Clear any existing sessions
  req.session = null;
  
  passport.authenticate("google", {
    scope: ["email", "profile"],
    prompt: "select_account", // This forces the account chooser
    session: false
  })(req, res);
});

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { 
    //failureRedirect: `http://${process.env.REACT_APP_IP_CONFIG}:3000/login`,
    failureRedirect: `https://e-barter.vercel.app/login`,
    session: false
  }),
  async (req, res) => {
    try {
      const { token, user } = await handleGoogleCallback(req, req.user);
      // Redirect with token
      //res.redirect(`http://${process.env.REACT_APP_IP_CONFIG}:3000/login?token=${token}`);
        res.redirect(`https://e-barter.vercel.app/login?token=${token}`);
    } catch (error) {
      console.error("Callback error:", error);
      //res.redirect(`http://${process.env.REACT_APP_IP_CONFIG}:3000/login?error=auth_failed`);
      res.redirect(`https://e-barter.vercel.app/login?error=auth_failed`);
    }
  }
);

// Add middleware to protect routes
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Protected route for getting user details
app.get("/api/auth/me", authMiddleware, getMe);

// Routes
app.use("/api/items", itemRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/swap", swapRoutes);
app.use("/api/chats", chatRoutes);

// WebSocket handling
io.on("connection", (socket) => {
  console.log("A client connected.");

  // Join chat room
  socket.on("join-chat", (chatId) => {
    socket.join(chatId);
  });

   // Leave chat room
   socket.on("leave-chat", (chatId) => {
    socket.leave(chatId);
  });

  // Handle joining user room
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

   // Handle chat messages
   socket.on("chat:message", async (data) => {
    try {
      console.log("Received chat:message event with data:", data);
      // data should contain: chatId, content, and senderId
      const updatedChat = await saveChatMessageSocket({
        chatId: data.chatId,
        content: data.content,
        sender: data.senderId,
      });
      // Emit the last message to all participants
      const lastMessage = updatedChat.messages.slice(-1)[0];
      io.to(data.chatId).emit("chat:message", lastMessage);
      // Emit a chat update to all participants' personal rooms so their chat lists update
    updatedChat.participants.forEach((participant) => {
      io.to(participant.toString()).emit("chat:update", updatedChat);
    });
      console.log("Emitted chat:message event with lastMessage:", lastMessage);
    } catch (error) {
      console.error("Error handling chat message:", error);
    }
  });

socket.on("delete-chat", (chatId) => {
  socket.to(chatId).emit("chat:deleted", { chatId });
  console.log("Emitted chat:deleted event for chatId:", chatId);
});

// Add new swap request event handler
socket.on("swap:request", async (data) => {
  try {
    console.log("Received swap request:", data);
    // data should contain: receiverId, swapId
    
    // Emit to the receiver's room
    io.to(data.receiverId).emit("swap:notification", {
      type: "new_request",
      swapId: data.swapId,
      message: "You have received a new swap request"
    });
  } catch (error) {
    console.error("Error handling swap request notification:", error);
  }
});

// Add swap status update event
socket.on("swap:status_update", async (data) => {
  try {
    // Emit to both parties involved in the swap
    io.to(data.requesterId).emit("swap:notification", {
      type: "status_update",
      swapId: data.swapId,
      status: data.status,
      message: `Swap request ${data.status}`
    });
    
    io.to(data.receiverId).emit("swap:notification", {
      type: "status_update",
      swapId: data.swapId,
      status: data.status,
      message: `Swap request ${data.status}`
    });
  } catch (error) {
    console.error("Error handling swap status update:", error);
  }
});

// Handle client disconnect
socket.on("disconnect", () => {
  console.log("A client disconnected.");
});

});

// Set the port for the server
const PORT = process.env.PORT || 8080;

// Start the server
server.listen(PORT,"0.0.0.0", () => console.log(`Server running on port ${PORT}`));