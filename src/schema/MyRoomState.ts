import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
    @type("number") playerNumber: number = 0;
    @type("number") sessionId: string = "";
    @type(["number"]) history: number[] = [];
    @type("number") score: number = 0;
}

export class MyRoomState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type("number") currentRound: number = 1;
    @type("string") currentPlayerId: string | null = null;
    @type("boolean") gameOver: boolean = false;
    @type("string") winnerSessionId: string | null = null;
    @type({ map: "number" }) finalScores = new MapSchema<number>();
}
