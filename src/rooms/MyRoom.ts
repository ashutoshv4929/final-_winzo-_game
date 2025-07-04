// src/rooms/MyRoom.ts
import { Room, Client } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState";

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

            const player = this.state.players.get(client.sessionId) as Player;
            if (!player) {
                console.warn(`[Server] Player ${client.sessionId} not found.`);
                return;
            }

            const roll = Math.floor(Math.random() * 6) + 1;
            player.history.push(roll);

            this.state.currentDiceValue = roll;
            console.log(`[Server] Player ${player.playerNumber} (${client.sessionId}) rolled a ${roll}. State.currentDiceValue updated.`);

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
            }

            this.state.animationCompletedFlags.set(client.sessionId, true);
            console.log(`[Server] Animation flag set for ${client.sessionId}: ${this.state.animationCompletedFlags.get(client.sessionId)}`);

            const allPlayersCompletedAnimation = Array.from(this.state.players.keys())
                .every(sessionId => this.state.animationCompletedFlags.get(sessionId) === true);

            console.log(`[Server] All players completed animation: ${allPlayersCompletedAnimation}`);

            if (allPlayersCompletedAnimation) {
                console.log("[Server] All players' animations are complete. Processing scores and turn switch.");

                this.state.players.forEach((p: Player) => {
                    if (p.history.length === this.state.currentRound) {
                        const rollToAdd = p.history[p.history.length - 1];
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
                    const ids = Array.from(this.state.players.keys());
                    const currentClientIndex = ids.indexOf(this.state.currentPlayerId);
                    const nextClientIndex = (currentClientIndex + 1) % ids.length;
                    this.state.currentPlayerId = ids[nextClientIndex];
                    console.log(`[Server] Turn switched to: ${this.state.currentPlayerId}`);

                    this.state.currentRound++;
                    console.log(`[Server] Moving to Round ${this.state.currentRound}`);

                    this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false));
                    console.log("[Server] Animation flags reset for new round.");

                    this.state.currentDiceValue = 0;
                    console.log("[Server] State.currentDiceValue reset to 0 for next turn.");
                }
            } else {
                console.log("[Server] Not all players completed animation yet. Waiting...");
                const ids = Array.from(this.state.players.keys());
                const currentClientIndex = ids.indexOf(client.sessionId);
                const nextClientIndex = (currentClientIndex + 1) % ids.length;
                this.state.currentPlayerId = ids[nextClientIndex];
                console.log(`[Server] Current round still in progress. Turn switched to: ${this.state.currentPlayerId}`);
            }
        });
    }

    onJoin(client: Client, options?: any, auth?: any) {
        console.log(`[Server] Player ${client.sessionId} attempting to join.`);
        const player = new Player();
        player.playerNumber = this.state.players.size + 1;
        player.sessionId = client.sessionId;
        this.state.players.set(client.sessionId, player);
        console.log(`[Server] Player ${client.sessionId} joined. Total players: ${this.state.players.size}`);

        if (this.state.players.size === this.maxClients) {
            this.state.currentRound = 1;
            this.state.currentPlayerId = Array.from(this.state.players.keys())[0];
            this.broadcast("chat", { senderName: "Server", text: "Game Shuru!" });
            console.log(`[Server] Game started. First turn for: ${this.state.currentPlayerId}`);
        } else {
            this.broadcast("chat", { senderName: "Server", text: `Waiting for players... (${this.state.players.size}/${this.maxClients})` });
        }
    } // <-- यह ब्रैकेट onJoin के लिए गायब था

    // endGame() और बाकी मेथड्स यहाँ आएंगे...
    // फिलहाल, हम क्लास को सही से बंद कर रहे हैं।
    // अगर आपके पास endGame, onLeave आदि मेथड हैं, तो उन्हें इस ब्रैकेट से पहले रखें।

} // <-- यह ब्रैकेट MyRoom क्लास के लिए गायब था
