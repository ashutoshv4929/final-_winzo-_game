
const colyseus = require("colyseus");

class MyRoom extends colyseus.Room {
  onCreate() {
    this.maxClients = 2;
    this.players = {};
    this.turnOrder = [];
    this.currentTurn = 0;
    this.round = 1;

    this.onMessage("roll_dice", (client) => {
      if (this.turnOrder[this.currentTurn] !== client.sessionId) return;

      const dice = Math.floor(Math.random() * 6) + 1;
      this.players[client.sessionId].score += dice;

      this.broadcast("dice_result", {
        playerId: client.sessionId,
        dice,
        score: this.players[client.sessionId].score
      });

      if (this.round >= 3 && this.currentTurn === 1) {
        this.determineWinner();
      } else {
        this.currentTurn = (this.currentTurn + 1) % this.turnOrder.length;
        if (this.currentTurn === 0) this.round++;
        this.broadcast("turn", { currentTurn: this.turnOrder[this.currentTurn] });
      }
    });
  }

  determineWinner() {
    const [p1, p2] = this.turnOrder;
    const s1 = this.players[p1].score;
    const s2 = this.players[p2].score;

    const result = {
      winner: s1 > s2 ? p1 : s2 > s1 ? p2 : null,
      isTie: s1 === s2
    };

    this.broadcast("game_over", result);
  }

  onJoin(client) {
    this.players[client.sessionId] = { score: 0 };
    this.turnOrder.push(client.sessionId);

    if (this.turnOrder.length === 2) {
      this.broadcast("start_game", {
        players: this.turnOrder,
        currentTurn: this.turnOrder[this.currentTurn]
      });
    }
  }

  onLeave(client) {
    delete this.players[client.sessionId];
  }
}
exports.MyRoom = MyRoom;
