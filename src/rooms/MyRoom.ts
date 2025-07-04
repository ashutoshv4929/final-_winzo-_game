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

            const player = this.state.players.get(client.sessionId);
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
                    if (p.history.length === this.state.currentRound && p.score !== p.history.reduce((sum, r) => sum + r, 0)) {
                        const rollToAdd = p.history[p.history.length - 1]; // आखिरी रोल
                        p.score += rollToAdd;
                        console.log(`[Server] Player ${p.playerNumber} score updated to ${p.score} with roll ${rollToAdd}.`);
                    } else if (p.history.length < this.state.currentRound) {
                        console.warn(`[Server] Player ${p.playerNumber} has not rolled yet for current round.`);
                    }
                });
                // this.broadcast("scores_updated"); // इसकी भी अब सीधे ज़रूरत नहीं, स्टेट सिंक्रनाइज़ करेगी

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
                    console.log(`
