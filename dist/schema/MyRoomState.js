"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyRoomState = exports.Player = void 0;
const schema_1 = require("@colyseus/schema");
class Player extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.playerNumber = 0;
        this.sessionId = "";
        this.history = new schema_1.ArraySchema();
        this.score = 0;
    }
}
exports.Player = Player;
class MyRoomState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.players = new schema_1.MapSchema();
        this.currentRound = 1;
        this.currentPlayerId = null;
        this.gameOver = false;
        this.winnerSessionId = null;
        this.finalScores = new schema_1.MapSchema();
    }
}
exports.MyRoomState = MyRoomState;
