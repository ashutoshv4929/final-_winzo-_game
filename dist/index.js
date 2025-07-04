"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const colyseus_1 = require("colyseus");
const MyRoom_1 = require("./MyRoom");
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT || '8080');
// Serve static files
app.use(express_1.default.static("public"));
// Create HTTP server
const httpServer = require('http').createServer(app);
// Initialize Colyseus server
const gameServer = new colyseus_1.Server({
    server: httpServer
});
// Register room
gameServer.define("my_dice_room", MyRoom_1.MyRoom);
// Start server
httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`WebSocket server available at wss://final-winzo-game-lf1r.onrender.com`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});
