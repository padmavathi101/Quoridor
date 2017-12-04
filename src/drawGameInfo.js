/**
 *  class for drawing the information of the game
 */

import * as d3 from 'd3';
import PubSub from "pubsub-js";

export class drawGameInfo {
    constructor() {
        this.playerTurn = "p1";
        this.availableWalls = {p1: 0, p2: 0};
        this.playerName = {p1: "player1", p2: "player2"};

        this.subscribe();
    }

    /**
     * subscribe to events
     */
    subscribe() {
        // [playerTurn, pawns, walls, potentialPawn, availableWalls, playerName]
        PubSub.subscribe("MAIN_DATA", (msg, data) => {
            this.playerTurn = data[0];
            this.availableWalls = data[4];
            this.playerName = data[5];
            this.update();
        });
    }

    /**
     * update the info
     */
    update() {
        d3.select("#label_p1_Wall").text(this.availableWalls['p1']);
        d3.select("#label_p2_Wall").text(this.availableWalls['p2']);

        d3.select("#label_p1_name").text(this.playerName['p1']);
        d3.select("#label_p2_name").text(this.playerName['p2']);

    }
}
