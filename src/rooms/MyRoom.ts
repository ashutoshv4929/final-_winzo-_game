// src/rooms/MyRoom.ts
import { Room, Client } from "colyseus";
// *** इस लाइन को नीचे वाली लाइन से बदलें! ***
import { MyRoomState, Player } from "./schema/MyRoomState"; // <-- यह पाथ 100% सही है आपके वर्तमान स्ट्रक्चर के लिए!

export class MyRoom extends Room<MyRoomState> {
    maxClients = 2;
    TOTAL_TURNS = 3;

    onCreate() {
        this.setState(new MyRoomState());

        this.onMessage("roll_dice", (client) => {
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
            player.history.push(roll);
            this.broadcast("dice_rolled", { roll, player: player.playerNumber, sessionId: client.sessionId });

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

            this.state.animationCompletedFlags.set(client.sessionId, true);

            const allPlayersCompletedAnimation = Array.from(this.state.players.keys())
                .every(sessionId => this.state.animationCompletedFlags.get(sessionId) === true);

            if (allPlayersCompletedAnimation) {
                this.state.players.forEach((p: Player) => {
                    const roll = p.history[p.history.length - 1];
                    p.score += roll;
                });
                this.broadcast("scores_updated");

                const allRolled = Array.from(this.state.players.values())
                    .every((p: Player) => p.history.length === this.TOTAL_TURNS);

                if (allRolled) {
                    this.endGame();
                } else {
                    const ids = Array.from(this.state.players.keys());
                    const currentClientIndex = ids.indexOf(client.sessionId);
                    const nextClientIndex = (currentClientIndex + 1) % ids.length;
                    const nextPlayerSessionId = ids[nextClientIndex];
                    this.state.currentPlayerId = nextPlayerSessionId;

                    const totalRolls = Array.from(this.state.players.values()).reduce((sum, p: Player) => sum + p.history.length, 0);
                    this.state.currentRound = Math.floor(totalRolls / this.maxClients) + 1;

                    this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false));
                }
            }
        });
    }

    onJoin(client: Client) {
        const player = new Player();
        player.playerNumber = this.state.players.size + 1;
        player.sessionId = client.sessionId;
        this.state.players.set(client.sessionId, player);
        console.log(`Player ${client.sessionId} joined. Total players: ${this.state.players.size}`);

        if (this.state.players.size === this.maxClients) {
            this.state.currentRound = 1;
            this.state.currentPlayerId = Array.from(this.state.players.keys())[0];
            this.broadcast("chat", { senderName: "Server", text: "Game Shuru!" });
            console.log(`Game started. First turn for: ${this.state.currentPlayerId}`);
        } else {
            this.broadcast("chat", { senderName: "Server", text: `Waiting for players... (${this.state.players.size}/${this.maxClients})` });
        }
    }

    endGame() {
        this.state.gameOver = true;
        const playersArray = Array.from(this.state.players.values());
        const p1 = playersArray.find(p => p.playerNumber === 1) as Player;
        const p2 = playersArray.find(p => p.playerNumber === 2) as Player;

        this.state.finalScores.set("1", p1 ? p1.score : 0);
        this.state.finalScores.set("2", p2 ? p2.score : 0);

        if (p1 && p2) {
            if (p1.score > p2.score) {
                this.state.winnerSessionId = p1.sessionId;
            } else if (p2.score > p1.score) {
                this.state.winnerSessionId = p2.sessionId;
            } else {
                this.state.winnerSessionId = "";
            }
        } else {
            this.state.winnerSessionId = "";
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
        this.state.currentPlayerId = Array.from(this.state.players.keys())[0] || "";

        this.state.animationCompletedFlags.clear();
        this.state.players.forEach((p: Player) => this.state.animationCompletedFlags.set(p.sessionId, false));

        this.broadcast("chat", { senderName: "Server", text: "Game reset ho gaya hai!" });
        console.log("Game reset by server.");
    }

    onLeave(client: Client) {
        this.state.players.delete(client.sessionId);
        console.log(`Player ${client.sessionId} left. Remaining players: ${this.state.players.size}`);

        if (!this.state.gameOver && this.state.players.size < this.maxClients) {
            this.state.gameOver = true;
            this.broadcast("chat", { senderName: "Server", text: "Player left, game ended!" });
            this.state.winnerSessionId = "";
            this.state.finalScores.clear();
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
