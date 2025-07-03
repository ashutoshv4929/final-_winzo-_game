"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyRoomState = exports.Player = void 0;
// src/schema/MyRoomState.ts
const schema_1 = require("@colyseus/schema"); // <-- यहाँ MapSchema जोड़ा
class Player extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.playerNumber = 0;
        this.sessionId = "";
        this.score = 0;
        this.history = new Array();
    }
}
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], Player.prototype, "playerNumber", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], Player.prototype, "sessionId", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], Player.prototype, "score", void 0);
__decorate([
    (0, schema_1.type)(["number"]),
    __metadata("design:type", Object)
], Player.prototype, "history", void 0);
exports.Player = Player;
class MyRoomState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.players = new schema_1.MapSchema();
        this.gameOver = false;
        this.currentPlayerId = "";
        this.currentRound = 1;
        this.finalScores = new schema_1.MapSchema();
        this.winnerSessionId = "";
        // **नया बदलाव यहाँ**
        // यह ट्रैक करेगा कि किस खिलाड़ी ने अपना डाइस एनीमेशन पूरा कर लिया है
        this.animationCompletedFlags = new schema_1.MapSchema();
    }
}
__decorate([
    (0, schema_1.type)({ map: Player }),
    __metadata("design:type", Object)
], MyRoomState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], MyRoomState.prototype, "gameOver", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], MyRoomState.prototype, "currentPlayerId", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], MyRoomState.prototype, "currentRound", void 0);
__decorate([
    (0, schema_1.type)({ map: "number" }),
    __metadata("design:type", Object)
], MyRoomState.prototype, "finalScores", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], MyRoomState.prototype, "winnerSessionId", void 0);
__decorate([
    (0, schema_1.type)({ map: "boolean" }),
    __metadata("design:type", Object)
], MyRoomState.prototype, "animationCompletedFlags", void 0);
exports.MyRoomState = MyRoomState;
