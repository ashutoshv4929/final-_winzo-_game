// src/rooms/MyRoom.ts
import { Room, Client } from "colyseus";
// *** इस लाइन को नीचे वाली लाइन से बदलें! ***
import { MyRoomState, Player } from "../../src/schema/MyRoomState"; // <-- यह पाथ आजमाएं!

// ... बाकी कोड
export class MyRoom extends Room<MyRoomState> {
    maxClients = 2;
    TOTAL_TURNS = 3;

    onCreate() {
        this.setState(new MyRoomState());

        this.onMessage("roll_dice", (client) => {
            // केवल वर्तमान खिलाड़ी और जब गेम ओवर न हो, तभी रोल करने दें
            if (this.state.gameOver || this.state.currentPlayerId !== client.sessionId) {
                console.warn(`Roll denied for ${client.sessionId}: Game Over or Not their turn.`);
                return;
            }

            const player = this.state.players.get(client.sessionId);
            if (!player) {
                console.warn(`Player ${client.sessionId} not found.`);
                return;
            }

            const roll = Math.floor(Math.random() * 6) + 1;
            player.history.push(roll); // इतिहास अपडेट करें
            this.broadcast("dice_rolled", { roll, player: player.playerNumber, sessionId: client.sessionId });

            // एनीमेशन पूरा होने की प्रतीक्षा के लिए फ़्लैग को फ़ॉल्स करें
            this.state.animationCompletedFlags.set(client.sessionId, false);
        });

        this.onMessage("animation_completed", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const latestRoll = player.history[player.history.length - 1];
            if (message.roll !== latestRoll) {
                console.warn(`Client ${client.sessionId} reported animation complete for wrong roll. Expected ${latestRoll}, got ${message.roll}`);
                return;
            }

            // इस खिलाड़ी के लिए एनीमेशन को 'true' पर सेट करें
            this.state.animationCompletedFlags.set(client.sessionId, true);

            // जांचें कि क्या सभी सक्रिय खिलाड़ियों ने अपना एनीमेशन पूरा कर लिया है
            const allPlayersCompletedAnimation = Array.from(this.state.players.keys())
                .every(sessionId => this.state.animationCompletedFlags.get(sessionId) === true);

            // **स्कोर अपडेट और टर्न बदलने का लॉजिक यहाँ है (केवल जब सभी एनीमेशन पूरे हो जाएं)**
            if (allPlayersCompletedAnimation) {
                // *** यहाँ स्कोर अपडेट का लॉजिक बदला गया है! ***
                // केवल जिसने रोल किया है, उसका स्कोर अपडेट करें।
                // हम प्रत्येक खिलाड़ी के नवीनतम रोल से उनके स्कोर को अपडेट करते हैं।
                this.state.players.forEach((p: Player) => {
                    const roll = p.history[p.history.length - 1];
                    p.score += roll; // यह स्कोर अपडेट करेगा
                });
                this.broadcast("scores_updated"); // क्लाइंट को बताएं कि स्कोर अपडेट हो गए हैं

                const allRolled = Array.from(this.state.players.values())
                    .every((p: Player) => p.history.length === this.TOTAL_TURNS);

                if (allRolled) {
                    this.endGame();
                } else {
                    // *** यहाँ टर्न लॉजिक बदला गया है ताकि यह अगले खिलाड़ी की बारी हो ***
                    const currentClientIndex = Array.from(this.state.players.keys()).indexOf(client.sessionId);
                    const nextClientIndex = (currentClientIndex + 1) % this.state.players.size;
                    const nextPlayerSessionId = Array.from(this.state.players.keys())[nextClientIndex];
                    this.state.currentPlayerId = nextPlayerSessionId;

                    const totalRolls = Array.from(this.state.players.values()).reduce((sum, p: Player) => sum + p.history.length, 0);
                    this.state.currentRound = Math.floor(totalRolls / this.maxClients) + 1;

                    // एनीमेशन फ़्लैग्स को रीसेट करें नए टर्न के लिए
                    this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false));
                }
            }
        });
    } // onCreate() का बंद होने वाला ब्रेस

    onJoin(client: Client) {
        const player = new Player();
        player.playerNumber = this.state.players.size + 1;
        player.sessionId = client.sessionId;
        this.state.players.set(client.sessionId, player);
        console.log(`Player ${client.sessionId} joined. Total players: ${this.state.players.size}`);

        // जब दोनों खिलाड़ी जुड़ जाएं तो खेल शुरू करें
        if (this.state.players.size === this.maxClients) {
            this.state.currentRound = 1;
            // पहले खिलाड़ी को बारी दें
            this.state.currentPlayerId = Array.from(this.state.players.keys())[0]; // पहले खिलाड़ी का sessionId
            this.broadcast("chat", { senderName: "Server", text: "Game Shuru!" });
            console.log(`Game started. First turn for: ${this.state.currentPlayerId}`);
        } else {
            this.broadcast("chat", { senderName: "Server", text: `Waiting for players... (${this.state.players.size}/${this.maxClients})` });
        }
    }

    endGame() {
        this.state.gameOver = true;
        const playersArray = Array.from(this.state.players.values());
        const p1 = playersArray.find(p => p.playerNumber === 1);
        const p2 = playersArray.find(p => p.playerNumber === 2);

        this.state.finalScores.set("1", p1 ? p1.score : 0);
        this.state.finalScores.set("2", p2 ? p2.score : 0);

        // विजेता का निर्धारण
        if (p1 && p2) {
            if (p1.score > p2.score) {
                this.state.winnerSessionId = p1.sessionId;
            } else if (p2.score > p1.score) {
                this.state.winnerSessionId = p2.sessionId;
            } else {
                this.state.winnerSessionId = ""; // टाई के लिए खाली स्ट्रिंग
            }
        } else {
            this.state.winnerSessionId = ""; // अगर पर्याप्त खिलाड़ी नहीं हैं
        }


        this.broadcast("game_over", {
            finalScores: Object.fromEntries(this.state.finalScores),
            winnerId: this.state.winnerSessionId,
        });
        console.log("Game Over. Final Scores:", this.state.finalScores);
    }

    resetGame() {
        this.state.gameOver = false;
        this.state.winnerSessionId = "";
        this.state.currentRound = 1;
        this.state.finalScores.clear();
        this.state.players.forEach((p: Player) => {
            p.score = 0;
            p.history.length = 0;
        });
        this.state.currentPlayerId = Array.from(this.state.players.keys())[0] || ""; // गेम रिसेट होने पर पहले खिलाड़ी को बारी दें

        this.state.animationCompletedFlags.clear();
        this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false));

        this.broadcast("chat", { senderName: "Server", text: "Game reset ho gaya hai!" });
        console.log("Game reset by server.");
    }

    onLeave(client: Client) {
        this.state.players.delete(client.sessionId);
        console.log(`Player ${client.sessionId} left. Remaining players: ${this.state.players.size}`);

        // अगर गेम चल रहा है और एक खिलाड़ी छोड़ देता है
        if (!this.state.gameOver && this.state.players.size < this.maxClients) {
            this.state.gameOver = true; // गेम को ओवर करें
            this.broadcast("chat", { senderName: "Server", text: "Player left, game ended!" });
            this.state.winnerSessionId = ""; // कोई विजेता नहीं
            this.state.finalScores.clear(); // स्कोर साफ़ करें
            this.broadcast("game_over", {
                finalScores: {},
                winnerId: "",
                message: "Opponent left the game."
            });
            console.log("Game ended due to player leaving.");
        }
    }

    onDispose() {
        console.log("Room band ho gaya:", this.roomId);
    }
}
