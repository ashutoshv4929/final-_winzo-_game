// MyRoomState.js

(function (exports) {
    // This is a polyfill for the schema library to work in the browser without a bundler
    var global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

    // *** यहाँ यह लाइन जोड़ी गई है ***
    var schema = window.schema; 

    // Player Schema
    class Player extends schema.Schema {
    }
    schema.defineTypes(Player, {
        playerNumber: "number",
        score: "number",
        history: new schema.ArraySchema("number"),
        sessionId: "string",
    });

    // Room State Schema
    class MyRoomState extends schema.Schema {
        constructor() {
            super();
            this.players = new schema.MapSchema();
            // This property was added to match the server
            this.finalScores = new schema.MapSchema(); 
        }
    }
    schema.defineTypes(MyRoomState, {
        players: { map: Player },
        currentRound: "number",
        currentPlayerId: "string",
        gameOver: "boolean",
        // These two properties were missing
        winnerSessionId: "string",
        finalScores: { map: "number" },
    });

    exports.MyRoomState = MyRoomState;

})(window);