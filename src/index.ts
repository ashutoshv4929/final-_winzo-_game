// src/index.ts
import express from "express";
import { Server } from "colyseus";
import { MyRoom } from "./MyRoom";

const app = express();
const port = 8080;

// Serve static files
app.use(express.static("public"));

// Create HTTP server
const httpServer = require('http').createServer(app);

// Initialize Colyseus server
const gameServer = new Server({
    server: httpServer
});

// Register room
gameServer.define("my_dice_room", MyRoom);

// Start server
httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`WebSocket server available at wss://final-winzo-game-lf1r.onrender.com:${port}`);
});
