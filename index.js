// src/index.ts
import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import path from "path";
import { MyRoom } from "./rooms/MyRoom"; // <-- TypeScript इम्पोर्ट सिंटैक्स

const port = Number(process.env.PORT) || 2567; // Render process.env.PORT का उपयोग करेगा
const app = express();

// यह सुनिश्चित करेगा कि Express 'public' फोल्डर को सही ढंग से सर्व करे
// __dirname होगा /opt/render/project/src/build/
// public फोल्डर है /opt/render/project/src/public/
// इसलिए, build से public तक पहुंचने के लिए आपको दो कदम ऊपर (..) जाना होगा।
const staticFilesPath = path.resolve(__dirname, '..', '..', 'public');

// डीबगिंग के लिए (Render लॉग्स में देखने के लिए)
console.log(`DEBUG: __dirname (current file location) is: ${__dirname}`);
console.log(`DEBUG: Static files served from: ${staticFilesPath}`);

app.use(express.static(staticFilesPath));

const gameServer = new Server({
    server: createServer(app), // Express ऐप को HTTP सर्वर को पास करें
});

gameServer.define("my_dice_room", MyRoom); // आपके रूम का नाम

gameServer.listen(port)
    .then(() => {
        console.log(`✅ सर्वर चालू हो गया है`);
        console.log(`🚀 गेम खेलने के लिए ब्राउज़र में http://localhost:${port} खोलें`);
        console.log(`Frontend served from: ${staticFilesPath}`); // Render लॉग्स में देखें
    })
    .catch((err) => {
        console.error("Failed to start server:", err);
    });