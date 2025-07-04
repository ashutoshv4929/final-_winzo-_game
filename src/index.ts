// src/index.ts
import http from "http";
import path from "path";
import express from "express";
import { Server } from "colyseus";
import { MyRoom } from "./MyRoom"; // MyRoom को यहाँ इम्पोर्ट करना सही है

const app = express();
const port = Number(process.env.PORT) || 2567; // Use environment port or fallback to 2567

// स्टैटिक फ़ाइलों (जैसे HTML, CSS, क्लाइंट-साइड JS) को सर्व करें
app.use(express.static(path.join(__dirname, "../public")));

const server = http.createServer(app);
const gameServer = new Server({
    server
});

// Colyseus रूम को डिफ़ाइन करें
gameServer.define("my_dice_room", MyRoom);

// सर्वर को दिए गए पोर्ट पर सुनना शुरू करें
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

console.log(`Server is running on port ${port}`);
console.log(`WebSocket server available at wss://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}:${port}`);
