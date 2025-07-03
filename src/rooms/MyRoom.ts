// src/rooms/MyRoom.ts
import { Room, Client } from "colyseus";
import { MyRoomState, Player } from "../schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
    maxClients = 2;
    TOTAL_TURNS = 3;

    onCreate() {
        this.setState(new MyRoomState());

        this.onMessage("roll_dice", (client) => {
            if (this.state.gameOver || this.state.currentPlayerId !== client.sessionId) return;

            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const roll = Math.floor(Math.random() * 6) + 1;
            player.history.push(roll);
            this.broadcast("dice_rolled", { roll, player: player.playerNumber, sessionId: client.sessionId });

            // **बदलाव यहाँ: जब डाइस रोल होता है, तो एनीमेशन फ़्लैग को फ़ॉल्स करें**
            // यह सुनिश्चित करता है कि प्रत्येक नए रोल के लिए हम एनीमेशन पूरा होने की प्रतीक्षा करते हैं
            this.state.animationCompletedFlags.set(client.sessionId, false);
        });

        this.onMessage("animation_completed", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const latestRoll = player.history[player.history.length - 1];
            // सुनिश्चित करें कि रिपोर्ट किया गया रोल वही है जो हमने भेजा था
            if (message.roll !== latestRoll) {
                console.warn(`Client ${client.sessionId} reported animation complete for wrong roll. Expected ${latestRoll}, got ${message.roll}`);
                return;
            }

            // **बदलाव यहाँ: इस खिलाड़ी के लिए एनीमेशन को 'true' पर सेट करें**
            this.state.animationCompletedFlags.set(client.sessionId, true);

            // जांचें कि क्या सभी सक्रिय खिलाड़ियों ने अपना एनीमेशन पूरा कर लिया है
            const allPlayersCompletedAnimation = Array.from(this.state.players.keys())
                .every(sessionId => this.state.animationCompletedFlags.get(sessionId) === true);

            if (allPlayersCompletedAnimation) {
                // **बदलाव यहाँ: सभी खिलाड़ियों का स्कोर अपडेट करें (एनीमेशन पूरा होने के बाद)**
                this.state.players.forEach(p => {
                    const roll = p.history[p.history.length - 1]; // प्रत्येक खिलाड़ी का नवीनतम रोल
                    p.score += roll;
                });
                this.broadcast("scores_updated"); // क्लाइंट को बताएं कि स्कोर अपडेट हो गए हैं

                const allRolled = Array.from(this.state.players.values())
                    .every(p => p.history.length === this.TOTAL_TURNS);

                if (allRolled) {
                    this.endGame();
                } else {
                    const ids = Array.from(this.state.players.keys());
                    const next = ids.find(id => id !== client.sessionId); // या कोई और लॉजिक अगले खिलाड़ी का चयन करने के लिए
                    this.state.currentPlayerId = next || "";

                    const totalRolls = Array.from(this.state.players.values()).reduce((sum, p) => sum + p.history.length, 0);
                    this.state.currentRound = Math.floor(totalRolls / this.maxClients) + 1;

                    // **एनीमेशन फ़्लैग्स को रीसेट करें नए राउंड के लिए**
                    this.state.players.forEach(p => this.state.animationCompletedFlags.set(p.sessionId, false));
                }
            }
        });

        // ... onCreate का बाकी हिस्सा ...
    }

    // ... onJoin, onLeave, onDispose ...

    resetGame() {
        this.state.gameOver = false;
        this.state.winnerSessionId = "";
        this.state.currentRound = 1;
        this.state.finalScores.clear();
        this.state.players.forEach(p => {
            p.score = 0;
            p.history.length = 0;
        });
        this.state.currentPlayerId = Array.from(this.state.players.keys())[0] || "";

        // **नए बदलाव: एनीमेशन फ़्लैग्स को भी रीसेट करें**
        this.state.animationCompletedFlags.clear(); // सभी फ़्लैग्स हटा दें
        this.state.players.forEach(p => this.state.animationCompletedFlags.set(p.sessionId, false)); // नए खिलाड़ियों के लिए सेट करें

        this.broadcast("chat", { senderName: "Server", text: "Game reset ho gaya hai!" });
    }
}
