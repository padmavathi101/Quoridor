/**
 *  class for drawing the elements in the board
 */

import * as d3 from "d3";
import PubSub from "pubsub-js";

export class drawBoard {
    constructor() {
        this.squares = [];
        for (let i = 0; i < 9; i++)
            for (let j = 0; j < 9; j++) this.squares.push({X: i, Y: j});

        // gapsV and gapsH are used only for onHover events
        this.gapsV = [];
        for (let i = 0; i < 8; i++)
            for (let j = 0; j < 9; j++) this.gapsV.push({X: i, Y: j});

        this.gapsH = [];
        for (let i = 0; i < 9; i++)
            for (let j = 0; j < 8; j++) this.gapsH.push({X: i, Y: j});

        // updated in subscribe method
        this.playerTurn = "p1";
        this.pawns = {};
        this.walls = {H: [], V: []};
        this.potentialPawn = [];

        // svg min width = 9 * 55 (squares) + 8 * 10 (gaps) + 2 * 10 (margin) = 595
        this.dimensions = {
            margin: 10,
            gridSize: 9,
            gridWidthLength: 65,
            squareWidthLength: 55,
            gapWidth: 10,
            gapLength: 55,
            pawnRadius: 15
        };

        this.scaleX = d3.scaleLinear().domain([0, 8]);
        this.scaleY = d3.scaleLinear().domain([0, 8]);

        this.gameFieldDiv = d3.select("#gameFieldDiv");
        this.svg = this.gameFieldDiv.append("svg").attr("id", "gameSVG");

        this.squaresGroup = this.svg
            .append("g")
            .attr(
                "transform",
                `translate(${this.dimensions.margin},${this.dimensions.margin})`
            );

        this.labelsGroup = this.svg
            .append("g")
            .attr(
                "transform",
                `translate(${this.dimensions.margin},${this.dimensions.margin})`
            )
            .attr("id", "labelsGroup"); // used to display the data of squares and gaps

        this.svg
            .append("g")
            .attr(
                "transform",
                `translate(${this.dimensions.margin},${this.dimensions.margin})`
            )
            .attr("id", "routesGroup"); // used to display the possible route

        this.gapsGroup = this.svg
            .append("g")
            .attr(
                "transform",
                `translate(${this.dimensions.margin},${this.dimensions.margin})`
            );
        this.pawnsGroup = this.svg
            .append("g")
            .attr(
                "transform",
                `translate(${this.dimensions.margin},${this.dimensions.margin})`
            );

        this.hoveredWall = this.gapsGroup.append("rect").attr("id", "hoveredWall");

        this.subscribe();
    }

    /**
     * attach listeners
     */
    subscribe() {
        // [playerTurn, pawns, walls, potentialPawn, availableWalls]
        PubSub.subscribe("MAIN_DATA", (msg, data) => {
            this.playerTurn = data[0];
            this.pawns = data[1];
            this.walls = data[2];
            this.potentialPawn = data[3];
            this.update();
        });

    }

    /**
     * update the drawing
     */
    update() {
        this.drawSquares();
        this.drawGaps();
        this.drawWalls();
        this.drawPawns();

        // this.drawBoardLabels();
    }

    // ----------------- Draw methods

    /**
     * draw all squares
     */
    drawSquares() {
        this.squaresGroup.selectAll(".squares").remove();

        this.squaresGroup
            .selectAll(".squares")
            .data(this.squares)
            .enter()
            .append("rect")
            .classed("squares square", true)
            .attr("x", d => d.X * this.dimensions.gridWidthLength)
            .attr("y", d => d.Y * this.dimensions.gridWidthLength)
            .attr("width", this.dimensions.squareWidthLength)
            .attr("height", this.dimensions.squareWidthLength)
            .on("click", function (d) {
                if (d3.select(this).classed("potentialPawn")) {
                    console.log("selected position!", d);
                    PubSub.publish("SELECTED_PAWN_POS", [d]);
                }
            });
    }

    /**
     * draw labels of squares and gaps x,y
     */
    drawBoardLabels() {
        // squares top-right corner X or Y = i * (55 + 10)

        this.labelsGroup
            .selectAll(".tempLabels")
            .data(this.squares)
            .enter()
            .append("text")
            .classed("tempLabels", true)
            .attr("x", d => d.X * this.dimensions.gridWidthLength + 15)
            .attr("y", d => d.Y * this.dimensions.gridWidthLength + 30)
            .text(d => `${d.X},${d.Y}`);

        // vertical

        this.labelsGroup
            .selectAll(".tempLabelsGapV")
            .data(this.gapsV)
            .enter()
            .append("text")
            .classed("tempLabelsGapV", true)
            .attr(
                "x",
                d =>
                    d.X * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength
            )
            .attr("y", d => d.Y * this.dimensions.gridWidthLength + 15)
            .text(d => `${d.X},${d.Y}`);

        // horizontal

        this.labelsGroup
            .selectAll(".tempLabelsGapH")
            .data(this.gapsH)
            .enter()
            .append("text")
            .classed("tempLabelsGapH", true)
            .attr("x", d => d.X * this.dimensions.gridWidthLength + 15)
            .attr(
                "y",
                d =>
                    d.Y * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength +
                    5
            )
            .text(d => `${d.X},${d.Y}`);
    }

    /**
     * draw pawns
     */
    drawPawns() {
        let self = this;
        this.pawnsGroup.selectAll(".pawn").remove();

        this.pawnsGroup
            .selectAll(".pawn1")
            .data([this.pawns["p1"]])
            .enter()
            .append("circle")
            .classed("pawn pawn1", true)
            .attr("id", "pawn1")
            .attr(
                "cx",
                d =>
                    d.X * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength / 2
            )
            .attr(
                "cy",
                d =>
                    d.Y * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength / 2
            )
            .attr("r", this.dimensions.pawnRadius)
            .on("click", function () {
                if (self.playerTurn !== "p1") return;
                let isSelected = d3.select(this).classed("selectedPawn");
                d3.select(this).classed("selectedPawn", !isSelected);
                if (!isSelected) self.displayPotentialPawn();
                else
                    self.svg.selectAll(".potentialPawn").classed("potentialPawn", false);
            });

        this.pawnsGroup
            .selectAll(".pawn2")
            .data([this.pawns["p2"]])
            .enter()
            .append("circle")
            .classed("pawn pawn2", true)
            .attr("id", "pawn2")
            .attr(
                "cx",
                d =>
                    d.X * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength / 2
            )
            .attr(
                "cy",
                d =>
                    d.Y * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength / 2
            )
            .attr("r", this.dimensions.pawnRadius)
            .on("click", function () {
                if (self.playerTurn !== "p2") return;
                let isSelected = d3.select(this).classed("selectedPawn");
                d3.select(this).classed("selectedPawn", !isSelected);
                if (!isSelected) self.displayPotentialPawn();
                else
                    self.svg.selectAll(".potentialPawn").classed("potentialPawn", false);
            });
    }

    /**
     * draw gaps for wall locations
     */
    drawGaps() {
        // gaps top-right corner X or Y = i * (55 + 10) + 55

        // vertical

        this.gapsGroup
            .selectAll(".gapV")
            .data(this.gapsV)
            .enter()
            .append("rect")
            .classed("gapV gap", true)
            .attr(
                "x",
                d =>
                    d.X * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength
            )
            .attr("y", d => d.Y * this.dimensions.gridWidthLength)
            .attr("width", this.dimensions.gapWidth)
            .attr("height", this.dimensions.gapLength)
            .on("mouseover", d => this.displayPotentialWall(d, "V"))
            .on("mouseout", () => d3.select("#hoveredWall").style("fill-opacity", 0))
            .on("click", d => PubSub.publish("VERIFY_WALL", [d, "V"]));

        // horizontal

        this.gapsGroup
            .selectAll(".gapH")
            .data(this.gapsH)
            .enter()
            .append("rect")
            .classed("gapH gap", true)
            .attr("x", d => d.X * this.dimensions.gridWidthLength)
            .attr(
                "y",
                d =>
                    d.Y * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength
            )
            .attr("width", this.dimensions.gapLength)
            .attr("height", this.dimensions.gapWidth)
            .on("mouseover", d => this.displayPotentialWall(d, "H"))
            .on("mouseout", () => d3.select("#hoveredWall").style("fill-opacity", 0))
            .on("click", d => PubSub.publish("VERIFY_WALL", [d, "H"]));
    }

    /**
     * draw active walls
     */
    drawWalls() {
        this.gapsGroup.selectAll(".wall").remove();

        // vertical

        this.gapsGroup
            .selectAll(".wallV")
            .data(this.walls["V"])
            .enter()
            .append("rect")
            .classed("wallV wall", true)
            .attr(
                "x",
                d =>
                    d.X * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength
            )
            .attr(
                "y",
                d => d.Y /*+ ((d.Y === 8) ? -1 : 0)*/ * this.dimensions.gridWidthLength
            )
            .attr("width", this.dimensions.gapWidth)
            .attr(
                "height",
                this.dimensions.gapLength /*+ this.dimensions.gridWidthLength*/
            );

        // horizontal

        this.gapsGroup
            .selectAll(".wallH")
            .data(this.walls["H"])
            .enter()
            .append("rect")
            .classed("wallH wall", true)
            .attr(
                "x",
                d => d.X /*+ ((d.X === 8) ? -1 : 0)*/ * this.dimensions.gridWidthLength
            )
            .attr(
                "y",
                d =>
                    d.Y * this.dimensions.gridWidthLength +
                    this.dimensions.squareWidthLength
            )
            .attr(
                "width",
                this.dimensions.gapLength /*+ this.dimensions.gridWidthLength*/
            )
            .attr("height", this.dimensions.gapWidth);
    }

    /**
     * display potential wall locations
     * @param d data
     * @param orientation H or V
     */
    displayPotentialWall(d, orientation) {
        if (orientation === "V") {
            this.svg
                .select("#hoveredWall")
                .attr(
                    "x",
                    () =>
                        d.X * this.dimensions.gridWidthLength +
                        this.dimensions.squareWidthLength
                )
                .attr(
                    "y",
                    () => (d.Y + (d.Y === 8 ? -1 : 0)) * this.dimensions.gridWidthLength
                )
                .attr("width", this.dimensions.gapWidth)
                .attr(
                    "height",
                    this.dimensions.gapLength + this.dimensions.gridWidthLength
                )
                .style("fill-opacity", 1);
        } else if (orientation === "H") {
            this.svg
                .select("#hoveredWall")
                .attr(
                    "x",
                    () => (d.X + (d.X === 8 ? -1 : 0)) * this.dimensions.gridWidthLength
                )
                .attr(
                    "y",
                    () =>
                        d.Y * this.dimensions.gridWidthLength +
                        this.dimensions.squareWidthLength
                )
                .attr(
                    "width",
                    this.dimensions.gapLength + this.dimensions.gridWidthLength
                )
                .attr("height", this.dimensions.gapWidth)
                .style("fill-opacity", 1);
        }
    }

    /**
     * display the potential pawn locations
     */
    displayPotentialPawn() {
        this.svg
            .selectAll(".squares")
            .filter(
                d =>
                    this.potentialPawn.find(dd => d.X === dd.X && d.Y === dd.Y) !==
                    undefined
            )
            .classed("potentialPawn", true);
    }
}
