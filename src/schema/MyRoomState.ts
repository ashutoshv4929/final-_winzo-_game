import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
    playerNumber: number = 0;
    sessionId: string = "";
    history: number[] = [];
    score: number = 0;
}

export class MyRoomState extends Schema {
    players = new MapSchema<Player>();
    currentRound: number = 1;
    currentPlayerId: string | null = null;
    gameOver: boolean = false;
    winnerSessionId: string | null = null;
    finalScores = new MapSchema<number>();
}
