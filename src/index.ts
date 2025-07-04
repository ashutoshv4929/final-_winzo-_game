// src/index.ts
import express from "express";
import path from "path";
import { Server } from "colyseus";
import { MyRoom } from "./MyRoom";

const app = express();
const port = Number(process.env.PORT) || 2567;

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Create HTTP server
const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Initialize Colyseus server
const gameServer = new Server({
    server
});

// Register room
gameServer.define("my_dice_room", MyRoom);
