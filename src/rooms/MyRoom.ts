// src/rooms/MyRoom.ts
import { Room, Client } from "colyseus";
import { MyRoomState, Player } from "../schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
    maxClients = 2;
    TOTAL_TURNS = 3;

    // खिलाड़ियों के टर्न का क्रम ट्रैक करने के लिए
    private turnOrder: string[] = [];
    private currentTurnIndex: number = 0;

    onCreate() {
        this.setState(new MyRoomState());

        console.log("Room created successfully!");

        this.onMessage("roll_dice", (client) => {
            // सुनिश्चित करें कि यह सही खिलाड़ी का टर्न है और गेम खत्म नहीं हुआ है
            if (this.state.gameOver || this.state.currentPlayerId !== client.sessionId) {
                console.log(`Roll dice denied for ${client.sessionId}. Game Over: ${this.state.gameOver}, Current Player: ${this.state.currentPlayerId}`);
                return;
            }

            const player = this.state.players.get(client.sessionId);
            if (!player) {
                console.warn(`Player ${client.sessionId} not found for roll_dice message.`);
                return;
            }

            // यदि खिलाड़ी पहले ही अपनी सभी बारी ले चुका है
            if (player.history.length >= this.TOTAL_TURNS) {
                console.log(`Player ${client.sessionId} has already completed all turns.`);
                return;
            }

            const roll = Math.floor(Math.random() * 6) + 1;
            player.history.push(roll);
            this.broadcast("dice_rolled", { roll, player: player.playerNumber, sessionId: client.sessionId });

            // डाइस रोल होने पर, इस खिलाड़ी के एनीमेशन फ़्लैग को फ़ॉल्स करें
            this.state.animationCompletedFlags.set(client.sessionId, false);
            console.log(`Player ${client.sessionId} rolled ${roll}. Animation flag set to false.`);
        });

        this.onMessage("animation_completed", (client, message: { roll: number }) => { // message को टाइप दिया
            const player = this.state.players.get(client.sessionId);
            if (!player) {
                console.warn(`Player ${client.sessionId} not found for animation_completed message.`);
                return;
            }

            const latestRoll = player.history[player.history.length - 1];
            // सुनिश्चित करें कि रिपोर्ट किया गया रोल वही है जो हमने भेजा था
            if (message.roll !== latestRoll) {
                console.warn(`Client ${client.sessionId} reported animation complete for wrong roll. Expected ${latestRoll}, got ${message.roll}`);
                // अगर गलत रोल है, तो भी हम एनीमेशन पूरा मान सकते हैं, या इसे वापस कर सकते हैं
                // return;
            }

            // इस खिलाड़ी के लिए एनीमेशन को 'true' पर सेट करें
            this.state.animationCompletedFlags.set(client.sessionId, true);
            console.log(`Player ${client.sessionId} animation completed. Flag set to true.`);

            // जांचें कि क्या सभी सक्रिय खिलाड़ियों ने अपना एनीमेशन पूरा कर लिया है
            // केवल उन खिलाड़ियों को गिनें जो वर्तमान राउंड में रोल कर चुके हैं
            const playersWhoRolledThisRound = Array.from(this.state.players.values())
                .filter((p: Player) => p.history.length === this.state.currentRound); // सुनिश्चित करें कि इस राउंड में रोल किया हो

            const allActivePlayersCompletedAnimation = playersWhoRolledThisRound
                .every((p: Player) => this.state.animationCompletedFlags.get(p.sessionId) === true);


            if (allActivePlayersCompletedAnimation) {
                console.log("All players completed animation for this turn. Updating scores and proceeding.");
                // सभी खिलाड़ियों का स्कोर अपडेट करें (एनीमेशन पूरा होने के बाद)
                this.state.players.forEach((p: Player) => { // 'p' को Player टाइप दिया
                    const roll = p.history[p.history.length - 1]; // प्रत्येक खिलाड़ी का नवीनतम रोल
                    p.score += roll;
                });
                this.broadcast("scores_updated"); // क्लाइंट को बताएं कि स्कोर अपडेट हो गए हैं

                const allRolledFinalTurns = Array.from(this.state.players.values())
                    .every((p: Player) => p.history.length === this.TOTAL_TURNS); // 'p' को Player टाइप दिया

                if (allRolledFinalTurns) {
                    this.endGame();
                } else {
                    // अगले खिलाड़ी का टर्न
                    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
                    this.state.currentPlayerId = this.turnOrder[this.currentTurnIndex];
                    console.log(`Next player: ${this.state.currentPlayerId}`);

                    // कुल रोल की संख्या के आधार पर वर्तमान राउंड अपडेट करें
                    const totalRollsCount = Array.from(this.state.players.values()).reduce((sum: number, p: Player) => sum + p.history.length, 0); // sum और p को टाइप दिया
                    this.state.currentRound = Math.floor(totalRollsCount / this.maxClients) + 1; // maxClients की जगह this.state.players.size का उपयोग बेहतर होगा यदि खिलाड़ी संख्या बदलती है
                    console.log(`Current round: ${this.state.currentRound}`);

                    // एनीमेशन फ़्लैग्स को रीसेट करें नए टर्न के लिए
                    // केवल अगले खिलाड़ी के लिए रीसेट करने की आवश्यकता हो सकती है, या सभी के लिए यदि यह एक नए राउंड की शुरुआत है
                    // यहाँ सभी के लिए रीसेट कर रहे हैं
                    this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false));
                }
            }
        });
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "रूम में शामिल हुआ!");

        // प्लेयर ऑब्जेक्ट बनाएं
        const player = new Player();
        player.sessionId = client.sessionId;
        player.playerNumber = this.state.players.size + 1; // खिलाड़ी संख्या असाइन करें
        player.score = 0; // स्कोर 0 से शुरू करें
        player.history = new Array<number>(); // खाली हिस्ट्री एरे

        // स्टेट में खिलाड़ी को जोड़ें
        this.state.players.set(client.sessionId, player);
        this.state.animationCompletedFlags.set(client.sessionId, false); // एनीमेशन फ़्लैग सेट करें

        // टर्न ऑर्डर को अपडेट करें
        this.turnOrder.push(client.sessionId);

        // यदि यह पहला खिलाड़ी है, तो उसे चालू खिलाड़ी बनाएं
        if (this.state.players.size === 1) {
            this.state.currentPlayerId = client.sessionId;
            console.log(`First player joined. Current player set to: ${this.state.currentPlayerId}`);
        }

        // यदि अधिकतम खिलाड़ी रूम में आ गए हैं, तो गेम शुरू करें
        if (this.state.players.size === this.maxClients) {
            this.broadcast("game_starts", "सभी खिलाड़ी जुड़ गए हैं! गेम शुरू हो रहा है!");
            console.log("Max clients reached. Game starting!");
            // यहाँ आप कोई प्रारंभिक गेम लॉजिक जोड़ सकते हैं
        } else {
            this.broadcast("waiting_for_players", `खिलाड़ी ${this.state.players.size}/${this.maxClients}. और खिलाड़ियों का इंतज़ार है...`);
        }
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "रूम छोड़ रहा है");

        // स्टेट से खिलाड़ी को हटा दें
        this.state.players.delete(client.sessionId);
        this.state.animationCompletedFlags.delete(client.sessionId); // एनीमेशन फ़्लैग भी हटा दें

        // टर्न ऑर्डर से खिलाड़ी को हटा दें
        this.turnOrder = this.turnOrder.filter(id => id !== client.sessionId);

        // यदि कोई खिलाड़ी चला जाता है और गेम खत्म नहीं हुआ है
        if (this.state.players.size < this.maxClients && this.state.gameOver === false) {
            this.broadcast("game_paused", "एक खिलाड़ी चला गया है, खेल रुका हुआ है या रीसेट हो रहा है।");
            console.log("A player left. Game paused/reset.");
            this.resetGame(); // गेम को रीसेट करना एक अच्छा विकल्प हो सकता है
        }

        // यदि जाने वाला खिलाड़ी चालू खिलाड़ी था, तो अगले खिलाड़ी को चुनें (यदि कोई हो)
        if (this.state.currentPlayerId === client.sessionId && this.state.players.size > 0) {
            this.currentTurnIndex = this.currentTurnIndex % this.turnOrder.length; // इंडेक्स को एडजस्ट करें
            this.state.currentPlayerId = this.turnOrder[this.currentTurnIndex];
            console.log(`Current player left. New current player: ${this.state.currentPlayerId}`);
        } else if (this.state.players.size === 0) {
            // यदि कोई खिलाड़ी नहीं बचा है, तो currentPlayerId को खाली करें
            this.state.currentPlayerId = "";
            this.currentTurnIndex = 0;
            this.turnOrder = [];
            console.log("No players left in the room.");
        }
    }

    onDispose() {
        console.log("Room disposed:", this.roomId);
    }

    // गेम खत्म करने का मेथड
    endGame() {
        this.state.gameOver = true;
        console.log("Game has ended!");

        // विजेता का निर्धारण करें
        let highestScore = -1;
        let winnerSessionId = "";
        this.state.players.forEach((p: Player) => { // 'p' को Player टाइप दिया
            this.state.finalScores.set(p.sessionId, p.score); // अंतिम स्कोर सेव करें
            if (p.score > highestScore) {
                highestScore = p.score;
                winnerSessionId = p.sessionId;
            }
        });
        this.state.winnerSessionId = winnerSessionId;

        this.broadcast("game_ended", { winner: this.state.winnerSessionId, finalScores: Array.from(this.state.finalScores.entries()) });
        // MapSchema को सीधे क्लाइंट को भेजने के बजाय array of entries भेजें।

        // आप चाहें तो यहाँ रूम को लॉक या डिसकनेक्ट भी कर सकते हैं
        // this.lock();
        // this.disconnect(); // यदि आप चाहते हैं कि रूम तुरंत बंद हो जाए
    }

    resetGame() {
        this.state.gameOver = false;
        this.state.winnerSessionId = "";
        this.state.currentRound = 1;
        this.state.finalScores.clear();
        this.state.players.forEach((p: Player) => { // 'p' को Player टाइप दिया
            p.score = 0;
            p.history.length = 0; // हिस्ट्री को खाली करें
        });

        // टर्न ऑर्डर को रीसेट और पहले खिलाड़ी को करंट प्लेयर बनाएं
        this.turnOrder = Array.from(this.state.players.keys());
        this.currentTurnIndex = 0;
        this.state.currentPlayerId = this.turnOrder[0] || ""; // यदि कोई खिलाड़ी नहीं है

        // एनीमेशन फ़्लैग्स को भी रीसेट करें
        this.state.animationCompletedFlags.clear(); // सभी फ़्लैग्स हटा दें
        this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false)); // नए खिलाड़ियों के लिए सेट करें

        this.broadcast("game_reset", { senderName: "Server", text: "Game reset हो गया है! नया गेम शुरू हो रहा है!" });
        console.log("Game state reset.");
    }
}
