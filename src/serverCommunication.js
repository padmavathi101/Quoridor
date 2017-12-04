/**
 *  class for communication with the server
 */


import PubSub from "pubsub-js";

export class serverCommunication {
    constructor(api, user) {
        // initial state
        this.playerTurn = "p1";
        this.pawns = {p1: {X: 0, Y: 4}, p2: {X: 8, Y: 4}};
        this.walls = {H: [], V: []};
        this.availableWalls = {p1: 6, p2: 6};

        this.playerName = {p1: "player1", p2: "player2"};
        this.winner = 0;

        this.api = api;
        this.user = user;

        this.subscribe();
    }

    /**
     * get the data from the server and publish it
     */
    init() {
        this.playerTurn = "p1";
        this.pawns = {p1: {X: 0, Y: 4}, p2: {X: 8, Y: 4}};
        this.walls = {H: [], V: []};
        this.availableWalls = {p1: 6, p2: 6};

        this.playerName = {p1: "player1", p2: "player2"};
        this.winner = 0;

        PubSub.publish("init -> INIT_DATA", [
            this.playerTurn,
            this.pawns,
            this.walls,
            this.availableWalls
        ]);
    }

    /**
     * subscribe to events
     */
    subscribe() {
        // [gameId]
        PubSub.subscribe("GAME_ID", (msg, data) => {
            this.gameId = data[0];
        });

        PubSub.subscribe("gameChange", (meg, data) => {

            this.playerTurn = data['gameStatus']['playerTurn'];
            this.pawns = data['gameStatus']['pawns'];
            if(data['gameStatus']['walls']) {
                this.walls.H = data['gameStatus']['walls']['H'] ? data['gameStatus']['walls']['H'] : [];
                this.walls.V = data['gameStatus']['walls']['V'] ? data['gameStatus']['walls']['V'] : [];
            }
            else
                this.walls = {H: [], V: []};
            this.availableWalls = data['gameStatus']['availableWalls'];
            this.playerName = data['gameStatus']['playerName'];

            PubSub.publish("INIT_DATA", [
                this.playerTurn,
                this.pawns,
                this.walls,
                this.availableWalls,
                this.playerName
            ]);
        });

        // [{X: x, Y:y}]
        PubSub.subscribe("SELECTED_PAWN_POS", (msg, data) => {
            let futurePawn = this.pawns;
            futurePawn[this.playerTurn] = data[0];

            // SEND TO SERVER
            this.api
                .setMove(this.user.gameId, this.user.token, {
                    player: this.playerTurn,
                    action: 'PAWN_MOVED',
                    location: data[0]
                })
                // .then(res => console.log("returned promise", res))
                .catch(err => console.log("rejected promise", err))
        });

        // [{X: x, Y:y}, 'H' or 'V']
        PubSub.subscribe("SELECTED_WALL", (msg, data) => {
            let newSetOfWalls = JSON.parse(JSON.stringify(this.walls));
            newSetOfWalls[data[1]].push(data[0]);
            if (data[1] === 'V')
                newSetOfWalls[data[1]].push({X: data[0].X, Y: data[0].Y + ((data[0].Y === 8) ? -1 : 1)});
            else
                newSetOfWalls[data[1]].push({X: data[0].X + ((data[0].X === 8) ? -1 : 1), Y: data[0].Y});
            let newAvailableWalls = JSON.parse(JSON.stringify(this.availableWalls));
            newAvailableWalls[this.playerTurn] = this.availableWalls[this.playerTurn] - 1;

            // SEND TO SERVER
            this.api
                .setMove(this.user.gameId, this.user.token, {
                    player: this.playerTurn,
                    action: 'WALL_ADDED',
                    location: data
                })
                // .then(res => console.log("returned promise", res))
                .catch(err => console.log("rejected promise", err))
        });
    }

    setUserToken(token) {
        this.user.token = token;
    }
}
