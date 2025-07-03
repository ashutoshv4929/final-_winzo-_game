import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") playerNumber: number = 0;
  @type("number") score: number = 0;
  @type(["number"]) history = new ArraySchema<number>();
  @type("string") sessionId: string = "";
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("number") currentRound: number = 0;
  @type("string") currentPlayerId: string | null = null;
  @type("boolean") gameOver: boolean = false;

  // यह दो प्रॉपर्टीज़ गायब थीं
  @type("string") winnerSessionId: string | null = null; 
  @type({ map: "number" }) finalScores = new MapSchema<number>();
}