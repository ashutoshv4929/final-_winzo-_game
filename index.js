const http = require("http");
const path = require("path");
const express = require("express");
const { Server } = require("colyseus");

// MyRoom.ts कम्पाइल होकर build/src/rooms/MyRoom.js में जाएगा
// लेकिन आपका rootDir src है, तो यह build/rooms/MyRoom.js होगा
const { MyRoom } = require("./build/rooms/MyRoom");

const app = express();
const port = 2567;

// यह लाइन public फोल्डर से HTML, CSS, JS फाइल्स को सर्व करने के लिए ज़रूरी है
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);

// Colyseus सर्वर का पुराना वर्ज़न इस तरह सेटअप होता है
const gameServer = new Server({
    server: server
});

gameServer.define("my_dice_room", MyRoom);

gameServer.listen(port);

console.log(`✅ सर्वर चालू हो गया है`);
console.log(`🚀 गेम खेलने के लिए ब्राउज़र में http://localhost:${port} खोलें`);
