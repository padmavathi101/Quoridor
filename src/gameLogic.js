/**
 * class for computing the logic for the game
 */

import * as d3 from 'd3';
import PubSub from "pubsub-js";
import Graph from "node-dijkstra";

export class gameLogic {

    constructor() {

        // update the data from server
        this.playerTurn = 'p1';
        this.pawns = {};
        this.walls = {H: [], V: []};
        this.potentialPawn = [];
        this.availableWalls = {p1: 0, p2: 0};
        this.playerName = {p1: "player1", p2: "player2"};

        this.subscribe();

    }

    /**
     * attach listeners
     */
    subscribe() {

        // [playerTurn, pawns, walls, availableWalls, playerName]
        PubSub.subscribe("INIT_DATA", (msg, data) => {

            this.playerTurn = data[0];
            this.pawns = data[1];
            this.walls = data[2];
            this.availableWalls = data[3];
            this.playerName = data[4];
            this.computePotentialPawn();

            PubSub.publish('MAIN_DATA', [this.playerTurn, this.pawns, this.walls,
                this.potentialPawn, this.availableWalls, this.playerName]);
        });

        // [wall, H or V]
        PubSub.subscribe("VERIFY_WALL", (msg, data) => {

            let res = this.verifySelectedWall(data[0], data[1]);
            if (res['result']) {
                console.log('selected wall!', data);
                PubSub.publish("SELECTED_WALL", data);
            }
        })

    }

    /**
     * find potential locations for the player pawn
     */
    computePotentialPawn() {

        let player = this.playerTurn;
        let otherPawn = (this.playerTurn === 'p1') ? 'p2' : 'p1';

        // initialize the list
        this.potentialPawn = [];

        // check if the location is blocked by a wall
        let bottom = this.walls.H.filter((d) => this.pawns[player].X === d.X && this.pawns[player].Y === d.Y);
        let top = this.walls.H.filter((d) => this.pawns[player].X === d.X && this.pawns[player].Y - 1 === d.Y);
        let right = this.walls.V.filter((d) => this.pawns[player].X === d.X && this.pawns[player].Y === d.Y);
        let left = this.walls.V.filter((d) => this.pawns[player].X - 1 === d.X && this.pawns[player].Y === d.Y);

        if (bottom.length === 0)
            this.potentialPawn.push({X: this.pawns[player].X, Y: this.pawns[player].Y + 1});
        if (top.length === 0)
            this.potentialPawn.push({X: this.pawns[player].X, Y: this.pawns[player].Y - 1});
        if (right.length === 0)
            this.potentialPawn.push({X: this.pawns[player].X + 1, Y: this.pawns[player].Y});
        if (left.length === 0)
            this.potentialPawn.push({X: this.pawns[player].X - 1, Y: this.pawns[player].Y});

        // remove the location if it is already taken by the other pawn
        this.potentialPawn = this.potentialPawn.filter((d) => !((d.X === this.pawns[otherPawn].X) && (d.Y === this.pawns[otherPawn].Y)));

        // remove the location if it blocks players?

    }


    /**
     * check if the selected wall is valid
     * @param wall
     * @param orientation
     */
    verifySelectedWall(wall, orientation) {

        // check if the player used all walls

        if (this.availableWalls[this.playerTurn] === 0)
            return {result: false};

        // check if the wall overlaps with other walls

        let validWall = this.isWallNotOverlap(wall, orientation);

        // check if the wall blocks other wall

        // deep copy
        let newSetOfWalls = JSON.parse(JSON.stringify(this.walls));
        // add the wall
        newSetOfWalls[orientation].push(wall);
        // add the other partition of the selected wall
        if (orientation === 'V')
            newSetOfWalls[orientation].push({X: wall.X, Y: wall.Y + ((wall.Y === 8) ? -1 : 1)});
        else
            newSetOfWalls[orientation].push({X: wall.X + ((wall.X === 8) ? -1 : 1), Y: wall.Y});

        let isP1Blocked = this.checkPathExistence('p1', newSetOfWalls);
        let isP2Blocked = this.checkPathExistence('p2', newSetOfWalls);

        return {newSetOfWalls: newSetOfWalls, result: (!isP1Blocked && !isP2Blocked && validWall)}
    }

    /**
     * check if the walls overlaps with other walls
     * @param wall
     * @param orientation
     */
    isWallNotOverlap(wall, orientation) {

        // check whether there is already a wall at this location

        let wallElement = d3.select('#gameSVG').selectAll('.wall' + orientation).filter(function (d) {
            return wall.X === d.X && wall.Y === d.Y;
        });
        if (wallElement.size() > 0)
            return false;

        // console.log("No wall on the location of first partition");

        // check if the other wall partition is overlapping

        if (orientation === 'H') {
            let nextWall = (wall.X === 8) ? -1 : 1;
            wallElement = d3.select('#gameSVG').selectAll('.wallH').filter((d) => {
                return wall.X + nextWall === d.X && wall.Y === d.Y;
            });
        }
        else if (orientation === 'V') {
            let nextWall = (wall.Y === 8) ? -1 : 1;
            wallElement = d3.select('#gameSVG').selectAll('.wallV').filter((d) => {
                return wall.X === d.X && wall.Y + nextWall === d.Y;
            });
        }

        if (wallElement.size() > 0)
            return false;

        // console.log("No wall on the location of second partition");

        // check whether there is a wall w/ different orientation intersecting

        if (orientation === 'H') {
            let lastColumn = (wall.X === 8) ? -1 : 0;

            wallElement = d3.select('#gameSVG').selectAll('.wallV').filter((d) => {
                // top wall exists?
                if (!(d.X === wall.X + lastColumn && d.Y === wall.Y))
                    return false;

                // console.log("top wall exists");
                // bottom wall exists?
                let bottomWall = d3.select('#gameSVG').selectAll('.wallV').filter((dd) => {
                    return dd.X === wall.X + lastColumn && dd.Y === wall.Y + 1
                });

                return bottomWall.size() !== 0
            });
        }

        else if (orientation === 'V') {
            let lastRow = (wall.X === 8) ? -1 : 0;
            wallElement = d3.select('#gameSVG').selectAll('.wallH').filter((d) => {
                // left wall exists?
                if (!(d.X === wall.X && d.Y === wall.Y + lastRow))
                    return false;
                // right wall exists?
                let rightWall = d3.select('#gameSVG').selectAll('.wallH').filter((dd) => {
                    return dd.X === wall.X + 1 && dd.Y === wall.Y + lastRow
                });
                return rightWall.size() !== 0
            });

        }

        return wallElement.size() === 0

    }

    /**
     * check if the player pawn is blocked by walls
     * @param player string: 'p1' or 'p2'
     * @param walls similar to this.walls + new walls
     */
    checkPathExistence(player, walls) {

        const route = new Graph();

        for (let x = 0; x < 9; x++) {
            for (let y = 0; y < 9; y++) {
                let neighbors = {};
                if (x !== 0) {
                    let left = walls.V.filter((d) => x - 1 === d.X && y === d.Y);
                    if (left.length === 0)
                        neighbors[(x - 1) + ',' + y] = 1;
                }
                else {
                    if (player === 'p2')
                        neighbors['dummy'] = 1;
                }
                if (x !== 8) {
                    let right = walls.V.filter((d) => x === d.X && y === d.Y);
                    if (right.length === 0)
                        neighbors[(x + 1) + ',' + y] = 1;
                }
                else {
                    if (player === 'p1')
                        neighbors['dummy'] = 1;
                }
                if (y !== 0) {
                    let top = walls.H.filter((d) => x === d.X && y - 1 === d.Y);
                    if (top.length === 0)
                        neighbors[x + ',' + (y - 1)] = 1;
                }
                if (y !== 8) {
                    let bottom = walls.H.filter((d) => x === d.X && y === d.Y);
                    if (bottom.length === 0)
                        neighbors[x + ',' + (y + 1)] = 1;
                }

                route.addNode(`${x},${y}`, neighbors)
            }
        }

        let playerDummyNodeNeighbors = {};
        if (player === 'p1')
            playerDummyNodeNeighbors = {
                '8,0': 1,
                '8,1': 1,
                '8,2': 1,
                '8,3': 1,
                '8,4': 1,
                '8,5': 1,
                '8,6': 1,
                '8,7': 1,
                '8,8': 1
            };
        else
            playerDummyNodeNeighbors = {
                '0,0': 1,
                '0,1': 1,
                '0,2': 1,
                '0,3': 1,
                '0,4': 1,
                '0,5': 1,
                '0,6': 1,
                '0,7': 1,
                '0,8': 1
            };

        route.addNode('dummy', playerDummyNodeNeighbors);

        let foundRoute = route.path(`${this.pawns[player].X},${this.pawns[player].Y}`, 'dummy');

        // if (player === 'p2' && foundRoute !== null)
        //     this.drawRoute(walls, route, foundRoute);

        return foundRoute === null;

    }


    /**
     * draw the suggested route
     * @param walls
     * @param route
     * @param foundRoute
     */
    drawRoute(walls, route, foundRoute) {
        console.log(walls);
        console.log(route);
        console.log(foundRoute);

        d3.select('#routesGroup')
            .selectAll('.route')
            .remove();

        d3.select('#routesGroup')
            .selectAll('.route')
            .data(foundRoute.slice(0, -1))
            .enter()
            .append('rect')
            .classed('route', true)
            .attr('x', (d) => (+d.split('\,')[0] * 65))
            .attr('y', (d) => (+d.split('\,')[1] * 65))
            .attr('width', 55)
            .attr('height', 55);

    }

}
