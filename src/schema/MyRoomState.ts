import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") playerNumber: number = 0;
  @type("string") sessionId: string = "";
  @type("number") score: number = 0;
  @type(["number"]) history: ArraySchema<number> = new ArraySchema<number>();
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") currentPlayerId: string = "";
  @type("number") currentRound: number = 1;
  @type("boolean") gameOver: boolean = false;
  @type("string") winnerSessionId: string = "";
  @type({ map: "number" }) finalScores = new MapSchema<number>();
  // Server-only fields (not sent to client)
  animationCompletedFlags: Map<string, boolean> = new Map();
}
