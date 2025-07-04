// src/index.ts
import express from "express";
import { Server } from "colyseus";
import { MyRoom } from "./MyRoom";

const app = express();
const port = Number(process.env.PORT || 2567);

// Serve static files
app.use(express.static("public"));

// Create HTTP server
const httpServer = require('http').createServer(app);

// Initialize Colyseus server
const gameServer = new Server({
    server: httpServer,
    pingInterval: 2000,
    pingMaxRetries: 3
});

// Register room
gameServer.define("my_dice_room", MyRoom);

// Start server
httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`WebSocket server available at wss://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}:${port}`);
});
