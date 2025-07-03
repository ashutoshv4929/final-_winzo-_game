// src/schema/MyRoomState.ts
import { Schema, type, MapSchema } from "@colyseus/schema"; // <-- यहाँ MapSchema जोड़ा

export class Player extends Schema {
  @type("number") playerNumber: number = 0;
  @type("string") sessionId: string = "";
  @type("number") score: number = 0;
  @type(["number"]) history = new Array<number>();
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("boolean") gameOver: boolean = false;
  @type("string") currentPlayerId: string = "";
  @type("number") currentRound: number = 1;
  @type({ map: "number" }) finalScores = new MapSchema<number>();
  @type("string") winnerSessionId: string = "";

  // **नया बदलाव यहाँ**
  // यह ट्रैक करेगा कि किस खिलाड़ी ने अपना डाइस एनीमेशन पूरा कर लिया है
  @type({ map: "boolean" }) animationCompletedFlags = new MapSchema<boolean>();
}
