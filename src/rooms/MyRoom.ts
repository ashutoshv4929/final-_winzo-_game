// src/rooms/MyRoom.ts
import { Room, Client } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState"; // <-- यह पाथ सही है

export class MyRoom extends Room<MyRoomState> {
    maxClients = 2;
    TOTAL_TURNS = 3;

    onCreate() {
        this.setState(new MyRoomState());
        console.log("Room created. Initial state:", this.state.toJSON());

        this.onMessage("roll_dice", (client) => {
            console.log(`[Server] Roll dice message received from: ${client.sessionId}`);
            if (this.state.gameOver || this.state.currentPlayerId !== client.sessionId) {
                console.warn(`[Server] Roll denied for ${client.sessionId}: Game Over or Not their turn.`);
                return;
            }

            const player = this.state.players.get(client.sessionId) as Player; // Add type assertion
            if (!player) {
                console.warn(`[Server] Player ${client.sessionId} not found.`);
                return;
            }

            const roll = Math.floor(Math.random() * 6) + 1;
            player.history.push(roll);

            // **मुख्य बदलाव**: डाइस वैल्यू को सीधे स्टेट में अपडेट करें
            // यह Colyseus द्वारा सभी क्लाइंट्स को अपने आप सिंक्रनाइज़ हो जाएगा
            this.state.currentDiceValue = roll;
            console.log(`[Server] Player ${player.playerNumber} (${client.sessionId}) rolled a ${roll}. State.currentDiceValue updated.`);

            // `dice_rolled` ब्रॉडकास्ट अब मुख्य UI अपडेट के लिए सीधे ज़रूरी नहीं है,
            // क्योंकि स्टेट सिंक्रनाइज़ेशन ही विज़ुअल अपडेट को संभालेगा।
            // इसे सिर्फ़ अतिरिक्त लॉगिंग या चैट मैसेज के लिए रख सकते हैं।
            // this.broadcast("dice_rolled", { roll, player: player.playerNumber, sessionId: client.sessionId });

            this.state.animationCompletedFlags.set(client.sessionId, false);
            console.log(`[Server] Animation flag set to false for ${client.sessionId}.`);
        });

        this.onMessage("animation_completed", (client, message) => {
            console.log(`[Server] Animation completed message received from ${client.sessionId} for roll: ${message.roll}`);
            const player = this.state.players.get(client.sessionId) as Player;
            if (!player) {
                console.warn(`[Server] Player ${client.sessionId} not found on animation_completed.`);
                return;
            }

            const latestRoll = player.history[player.history.length - 1];
            if (message.roll !== latestRoll) {
                console.warn(`[Server] Client ${client.sessionId} reported animation complete for wrong roll. Expected ${latestRoll}, got ${message.roll}`);
                // अगर गलत रोल आता है, तो यहाँ आप और लॉजिक जोड़ सकते हैं (जैसे क्लाइंट को किक करना)
                // फिलहाल, हम इसे केवल चेतावनी के रूप में रखेंगे और आगे बढ़ेंगे।
            }

            this.state.animationCompletedFlags.set(client.sessionId, true);
            console.log(`[Server] Animation flag set for ${client.sessionId}: ${this.state.animationCompletedFlags.get(client.sessionId)}`);

            const allPlayersCompletedAnimation = Array.from(this.state.players.keys())
                .every(sessionId => this.state.animationCompletedFlags.get(sessionId) === true);

            console.log(`[Server] All players completed animation: ${allPlayersCompletedAnimation}`);

            if (allPlayersCompletedAnimation) {
                console.log("[Server] All players' animations are complete. Processing scores and turn switch.");

                // स्कोर अपडेट करें: हर खिलाड़ी के लिए वर्तमान राउंड का रोल जोड़ें
                this.state.players.forEach((p: Player) => {
                    // सुनिश्चित करें कि स्कोर सिर्फ एक बार अपडेट हो प्रति रोल/राउंड
                    // यह तभी अपडेट होना चाहिए जब खिलाड़ी ने वर्तमान राउंड में रोल किया हो और उसका स्कोर अभी तक इस रोल के लिए अपडेट न हुआ हो
                    if (p.history.length === this.state.currentRound) {
                        const rollToAdd = p.history[p.history.length - 1]; // आखिरी रोल
                        p.score += rollToAdd;
                        console.log(`[Server] Player ${p.playerNumber} score updated to ${p.score} with roll ${rollToAdd}.`);
                    } else if (p.history.length < this.state.currentRound) {
                        console.warn(`[Server] Player ${p.playerNumber} has not rolled yet for current round.`);
                    }
                });

                const allGameRollsCompleted = Array.from(this.state.players.values())
                    .every((p: Player) => p.history.length === this.TOTAL_TURNS);

                console.log(`[Server] All game rolls completed for all rounds: ${allGameRollsCompleted}`);

                if (allGameRollsCompleted) {
                    this.endGame();
                } else {
                    // टर्न बदलें: अगले खिलाड़ी पर स्विच करें
                    const ids = Array.from(this.state.players.keys());
                    const currentClientIndex = ids.indexOf(this.state.currentPlayerId); // वर्तमान सक्रिय खिलाड़ी
                    const nextClientIndex = (currentClientIndex + 1) % ids.length; // अगले खिलाड़ी का इंडेक्स
                    this.state.currentPlayerId = ids[nextClientIndex]; // अगले खिलाड़ी का टर्न
                    console.log(`[Server] Turn switched to: ${this.state.currentPlayerId}`);

                    // राउंड बढ़ाएं
                    this.state.currentRound++;
                    console.log(`[Server] Moving to Round ${this.state.currentRound}`);

                    // अगले राउंड के लिए एनिमेशन फ़्लैग्स रीसेट करें
                    this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false));
                    console.log("[Server] Animation flags reset for new round.");

                    // **महत्वपूर्ण**: डाइस वैल्यू को रीसेट करें ताकि अगले खिलाड़ी को नया रोल दिखे
                    this.state.currentDiceValue = 0;
                    console.log("[Server] State.currentDiceValue reset to 0 for next turn.");
                }
            } else { // This is the 'else' block for allPlayersCompletedAnimation being FALSE
                console.log("[Server] Not all players completed animation yet. Waiting...");
                // **टर्न यहीं स्विच करें अगर गेम ऐसा है कि एक खिलाड़ी के रोल के बाद तुरंत दूसरे का टर्न आता है**
                // आपका पुराना लॉजिक यही कर रहा था.
                const ids = Array.from(this.state.players.keys());
                const currentClientIndex = ids.indexOf(client.sessionId); // जिसने अभी-अभी एनिमेशन पूरा किया
                const nextClientIndex = (currentClientIndex + 1) % ids.length;
                this.state.currentPlayerId = ids[nextClientIndex];
                console.log(`[Server] Current round still in progress. Turn switched to: ${this.state.currentPlayerId}`);
                // `currentDiceValue` को यहाँ रीसेट न करें यदि आप चाहते हैं कि डाइस तब तक दिखे जब तक सभी ने रोल न कर लिया हो।
                // इसे 'currentRoundRolls' true होने पर ही रीसेट करें।
            }
        }); // onMessage("animation_completed") का क्लोजिंग ब्रेस

    } // onCreate() मेथड का क्लोजिंग ब्रेस


    onJoin(client: Client, options?: any, auth?: any) { // Colyseus के onJoin सिग्नेचर में options और auth भी होते हैं
        console.log(`[Server] Player ${client.sessionId} attempting to join.`);
        const player = new Player(); // Ensure Player class is defined and imported
        player.playerNumber = this.state.players.size + 1;
        player.sessionId = client.sessionId;
        this.state.players.set(client.sessionId, player);
        console.log(`[Server] Player ${client.sessionId} joined. Total players: ${this.state.players.size}`);

        if (this.state.players.size === this.maxClients) {
            this.state.currentRound = 1;
            this.state.currentPlayerId = Array.from(this.state.players.keys())[0]; // पहले खिलाड़ी का टर्न
            this.broadcast("chat", { senderName: "Server", text: "Game Shuru!" });
            console.log(`[Server] Game started. First turn for: ${this.state.currentPlayerId}`);
        } else {
            this.broadcast("chat", { senderName: "Server", text: `Waiting for players... (${this.state.players.size}/${this.maxClients})` });
        }
    }

    endGame() {
        console.log("[Server] Ending game.");
        this.state.gameOver = true;
        const playersArray = Array.from(this.state.players.values()) as Player[]; // Type assertion for safety
        const p1 = playersArray.find((p: Player) => p.playerNumber === 1);
        const p2 = playersArray.find((p: Player) => p.playerNumber === 2);

        this.state.finalScores.set("1", p1 ? p1.score : 0);
        this.state.finalScores.set("2", p2 ? p2.score : 0);

        if (p1 && p2) { // Use this check to ensure p1 and p2 are not undefined
            if (p1.score > p2.score) {
                this.state.winnerSessionId = p1.sessionId;
            } else if (p2.score > p1.score) {
                this.state.winnerSessionId = p2.sessionId;
            } else {
                this.state.winnerSessionId = ""; // Draw
            }
        } else {
            this.state.winnerSessionId = "";
        }

        this.broadcast("game_over", {
            finalScores: Object.fromEntries(this.state.finalScores),
            winnerId: this.state.winnerSessionId,
        });
        console.log("Game Over. Final Scores:", this.state.finalScores.toJSON());
    }

    resetGame() { // यह क्लाइंट द्वारा 'reset_game' मैसेज पर कॉल हो सकता है
        console.log("[Server] Resetting game state.");
        this.state.gameOver = false;
        this.state.winnerSessionId = "";
        this.state.currentRound = 1;
        this.state.finalScores.clear();
        this.state.players.forEach((p: Player) => {
            p.score = 0;
            p.history.clear(); // ArraySchema के लिए .clear() का उपयोग करें
        });
        this.state.currentPlayerId = Array.from(this.state.players.keys())[0] || "";

        this.state.animationCompletedFlags.clear();
        this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false));
        this.state.currentDiceValue = 0; // रीसेट पर डाइस वैल्यू भी रीसेट करें

        this.broadcast("chat", { senderName: "Server", text: "Game reset ho gaya hai!" });
        console.log("Game reset by server.");
    }

    onLeave(client: Client, consented?: boolean) { // 'consented' पैराামিটার भी Colyseus का हिस्सा है
        console.log(`[Server] Player ${client.sessionId} leaving. Consented: ${consented}`);
        const player = this.state.players.get(client.sessionId); // Remove 'as Player' here
        if (player) { // Ensure player is not undefined
            this.state.players.delete(client.sessionId);
            console.log(`[Server] Player ${client.sessionId} left. Remaining players: ${this.state.players.size}`);
        } else {
            console.warn(`[Server] Player ${client.sessionId} not found in state on leave.`);
        }
        
        // यदि गेम चल रहा था और कोई खिलाड़ी छोड़ देता है
        if (!this.state.gameOver && this.state.players.size < this.maxClients) {
            console.log("[Server] Game ending due to player leaving mid-game.");
            this.state.gameOver = true;
            this.broadcast("chat", { senderName: "Server", text: "Player left, game ended!" });
            this.state.winnerSessionId = "";
            this.state.finalScores.clear();
            this.broadcast("game_over", {
                finalScores: {},
                winnerId: "",
                message: "Opponent left the game."
            });
            console.log("[Server] Game ended due to player leaving.");
        }
    }

    onDispose() {
        console.log("Room band ho gaya:", this.roomId);
    }
}
