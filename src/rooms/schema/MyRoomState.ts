// src/schema/MyRoomState.ts
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema"; // <-- ArraySchema भी इम्पोर्ट करें

export class Player extends Schema {
  @type("number") playerNumber: number = 0;
  @type("string") sessionId: string = "";
  @type("number") score: number = 0;
  @type(["number"]) history = new ArraySchema<number>(); // <-- यहाँ ArraySchema का उपयोग करें!
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("boolean") gameOver: boolean = false;
  @type("string") currentPlayerId: string = "";
  @type("number") currentRound: number = 1;
  @type({ map: "number" }) finalScores = new MapSchema<number>();
  @type("string") winnerSessionId: string = "";

  @type({ map: "boolean" }) animationCompletedFlags = new MapSchema<boolean>();

  // **यह सबसे महत्वपूर्ण प्रॉपर्टी है जो डाइस की वर्तमान वैल्यू को स्टोर करती है**
  @type("number") currentDiceValue: number = 0; // <-- यह लाइन जोड़ें!
}
