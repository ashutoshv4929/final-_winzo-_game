import { Room, Client } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
    maxClients = 2;
    TOTAL_TURNS = 3;

    onCreate(options: any) {
        this.setState(new MyRoomState());
        console.log("Room ban gayi hai:", this.roomId);

        this.onMessage("roll_dice", (client) => {
            if (this.state.gameOver || this.state.currentPlayerId !== client.sessionId) {
                return;
            }

            const player = this.state.players.get(client.sessionId);
            if (!player) { return; }
            
            const roll = Math.floor(Math.random() * 6) + 1;
            player.history.push(roll); // पासे का नंबर इतिहास में जोड़ें, स्कोर अभी नहीं

            // सर्वर केवल क्लाइंट को पासा रोल करने के लिए कहता है, स्कोर अभी अपडेट नहीं करता।
            // क्लाइंट को अपनी sessionId भी भेजें ताकि वह पहचान सके कि यह उसका रोल है।
            this.broadcast("dice_rolled", { roll, player: player.playerNumber, sessionId: client.sessionId });
        });

        // नया मैसेज हैंडलर: जब क्लाइंट बताता है कि पासा एनीमेशन पूरा हो गया है
        this.onMessage("animation_completed", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) { return; }

            // सुनिश्चित करें कि यह सही रोल है जिसका एनीमेशन पूरा हुआ है (ताकि कोई धोखाधड़ी न हो)
            const latestRoll = player.history[player.history.length - 1]; // इतिहास से नवीनतम रोल प्राप्त करें

            // यदि मैसेज में भेजा गया रोल और इतिहास का नवीनतम रोल मैच करता है, तो स्कोर अपडेट करें
            if (message.roll === latestRoll) {
                player.score += latestRoll; // *** अब स्कोर अपडेट करें ***
                
                // अब बारी बदलने और गेम खत्म करने का लॉजिक यहां आएगा
                const everyPlayerHasRolledMaxTurns = Array.from(this.state.players.values())
                    .every(p => p.history.length === this.TOTAL_TURNS);

                if (everyPlayerHasRolledMaxTurns) {
                    this.endGame();
                } else {
                    const playerIds = Array.from(this.state.players.keys());
                    const nextPlayerId = playerIds.find(id => id !== client.sessionId);
                    this.state.currentPlayerId = nextPlayerId || null;
                    
                    const totalRolls = Array.from(this.state.players.values()).reduce((sum, p) => sum + p.history.length, 0);
                    this.state.currentRound = Math.floor(totalRolls / this.maxClients) + 1;
                }
            } else {
                console.warn(`Mismatch in animation_completed roll for ${client.sessionId}. Expected ${latestRoll}, got ${message.roll}`);
            }
        });
        
        this.onMessage("reset_game", () => this.resetGame());
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "join ho gaya!");
        
        const player = new Player();
        player.playerNumber = this.state.players.size + 1;
        player.sessionId = client.sessionId;
        this.state.players.set(client.sessionId, player);

        if (this.state.players.size === this.maxClients) {
            this.state.currentRound = 1;
            this.state.currentPlayerId = Array.from(this.state.players.keys())[0] || null;
            this.broadcast("chat", { senderName: "Server", text: "Game Shuru!" });
        }
    }

    endGame() {
        this.state.gameOver = true;
        const players = Array.from(this.state.players.values());
        const player1 = players.find(p => p.playerNumber === 1);
        const player2 = players.find(p => p.playerNumber === 2);

        if (player1 && player2) {
            this.state.finalScores.set("1", player1.score);
            this.state.finalScores.set("2", player2.score);
            if (player1.score > player2.score) { this.state.winnerSessionId = player1.sessionId; }
            else if (player2.score > player1.score) { this.state.winnerSessionId = player2.sessionId; }
            else { this.state.winnerSessionId = null; }
        }
        
        this.broadcast("game_over", {
            finalScores: Object.fromEntries(this.state.finalScores),
            winnerId: this.state.winnerSessionId,
        });
    }

    resetGame() {
        this.state.gameOver = false;
        this.state.winnerSessionId = null;
        this.state.currentRound = 1;
        this.state.finalScores.clear();
        this.state.players.forEach(player => {
            player.score = 0;
            player.history.clear();
        });
        
        this.state.currentPlayerId = Array.from(this.state.players.keys())[0] || null;
        this.broadcast("chat", { senderName: "Server", text: "Game reset ho gaya hai!" });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "chala गया!");
        if (this.state.players.has(client.sessionId)) {
            this.state.players.delete(client.sessionId);
        }
    }

    onDispose() {
        console.log("Room band ho gaya:", this.roomId);
    }
}
