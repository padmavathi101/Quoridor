// import Graph from "node-dijkstra";
const Graph = require("node-dijkstra");
const admin = require("firebase-admin");

const createGame = (gameName, player) =>
    new Promise((res, rej) =>
        isCurrentlyPlaying(player.uid)
            .then(generateGameId)
            .then(gameId => createPrivateGame(player.uid, gameId))
            .then(gameId => createPublicGame(gameName, gameId, player.email))
            .then(gameId => createWaitingGame(gameName, gameId))
            .then(gameId => setCurrentlyPlaying(player.uid, gameId))
            .then(gameId => res({gameId}))
            .catch(err => rej(err))
    );
const joinGame = (gameId, playerTwo) =>
    new Promise((res, rej) =>
        isCurrentlyPlaying(playerTwo.uid)
            .then(() => isWaitingGame(gameId))
            .then(() => addPlayerToGame(gameId, playerTwo))
            .then(() => setCurrentlyPlaying(playerTwo.uid, gameId))
            .then(() => deleteWaitingGame(gameId))
            .then(() => getCurrentGameState(gameId))
            .then(gameState =>
                updateGameMessage(
                    `${playerTwo.email} just joined the game. It is ${
                        gameState.playerName.p1
                        // gameState.playerOne.name
                        } One turn.`,
                    gameId
                )
            )
            .then(() => res(setTimeStamp(gameId)))
            .catch(err => rej(err))
    );
const setMove = (player, gameId, futureMove) =>
    new Promise((res, rej) =>
        isNotWaitingGame(gameId)
            .then(() => timeout(player, gameId))
            .then(() => getCurrentGameState(gameId))
            .then(currentGameState => isValidMove(currentGameState, futureMove))
            .then(futureGameState => isWinnerMove(futureGameState, gameId, player))
            .then(futureGameState => updateGameState(futureGameState, gameId))
            .then(futureGameState => futureGameState.gameState.winner !== 0
                ? res(updateGameMessage(`The winner is ${futureGameState.gameState.winner}`, gameId))
                : res())
            .then(() => switchPlayer(gameId, player).then(() => gameEnded(gameId)))
            .then(() => res(gameId))
            .catch(err => {
                console.log(err);
                return rej(err)
            })
    );

const gameEnded = (gameId) =>
    new Promise((res, rej) =>
        getPlayers(gameId)
            .then(players =>
                setCurrentlyPlaying(players['playerOne'], 0)
                    .then(() => setCurrentlyPlaying(players['playerTwo'], 0))
            ).catch(err => rej(err))
    );

const getLeaderBoard = () =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref("/playersProfiles")
            .once("value")
            .then(data => data.val())
            .then(players => Object.keys(players).map(key => players[key]))
            .then(players =>
                players.map(({lost, won, numberOfGamesPlayed, userName}) => ({
                    lost,
                    won,
                    numberOfGamesPlayed,
                    userName
                }))
            )
            .then(players => res(players))
            .catch(err => rej({err}))
    );
const timeout = (player, gameId) =>
    new Promise((res, rej) =>
        getNextPlayer(gameId)
            .then(
                nextPlayerId =>
                    nextPlayerId === 0 ? rej("Game already finished") : nextPlayerId
            )
            .then(nextPlayerId => getPlayerProfile(nextPlayerId))
            .then(nextPlayer =>
                getTimeStamp(gameId).then(timeStamp => {
                    // console.log("nextPlayer: ", nextPlayer);
                    Date.now() - timeStamp > 65000 ?
                        rej(switchPlayer(gameId, nextPlayer).then(() => changePlayerTurn(gameId)))
                        : res(`Time remaining ${60 - (Date.now() - timeStamp) / 1000}`);
                })
            )
            .catch(err => rej(err))
    );

const changePlayerTurn = (gameId) =>
    new Promise((res, rej) =>
        getCurrentGameState(gameId)
            .then((gameState) =>
                new Promise((res1, rej1) =>
                    admin
                        .database()
                        .ref(`/games/${gameId}/public/gameStatus`)
                        .update({playerTurn: gameState.playerTurn === 'p1' ? 'p2' : 'p1'})
                        .then(() => res1())
                        .catch(err => rej1({err}))
                )
            )
            .catch(err => rej({err}))
    );

const leaveGame = (gameId, playerId) =>
    new Promise((res, rej) =>
        getCurrentGameState(gameId)
            .then(
                gameState =>
                    gameState.winner !== 0 ? rej("Game already finished") : gameId
            )
            .then(gameId => getPlayers(gameId))
            .then(players => {
                const key = Object.keys(players).filter(
                    key => players[key] !== playerId
                );
                return players[key];
            })
            .then(
                winner =>
                    winner === undefined ? res(removeGame(gameId, playerId)) : winner
            )
            .then(winner => getPlayerProfile(winner))

            .then(winner => setWinner(winner))
            .then(winner => {
                winner.won = winner.won + 1;
                winner.currentlyPlaying = 0;
                winner.numberOfGamesPlayed = winner.numberOfGamesPlayed + 1;
                return winner;
            })

            .then(winner => updatePlayerProfile(winner.uid, winner))
            .then(winner =>
                updateGameMessage(`${winner.userName} is the winner`, gameId)
                    .then(() => getPlayerProfile(playerId))
                    .then(loser => {
                        loser.lost = loser.lost + 1;
                        loser.currentlyPlaying = 0;
                        loser.numberOfGamesPlayed = loser.numberOfGamesPlayed + 1;
                        return loser;
                    })

                    .then(loser => updatePlayerProfile(loser.uid, loser))
            )
            .then(() => setNextPlayer(gameId, 0, 0))
            .then(() => res())
            .catch(err => rej({err}))
    );
const removeGame = (gameId, playerId) =>
    deleteWaitingGame(gameId)
        .then(() => getPlayerProfile(playerId))
        .then(playerProfile => {
            playerProfile.currentlyPlaying = 0;
            return playerProfile;
        })
        .then(playerProfile => updatePlayerProfile(playerId, playerProfile));
const generateGameId = () =>
    Promise.resolve(
        admin
            .database()
            .ref()
            .child("keys")
            .push().key
    );
const switchPlayer = (gameId, player) => {
    let winner = 0;
    getCurrentGameState(gameId)
        .then((gameState) => {
            winner = gameState.winner;
            return Promise.resolve()
        });
    return new Promise((res, rej) =>
        getPlayers(gameId)
            .then(players => {
                const key = Object.keys(players).filter(
                    key => players[key] !== player.uid
                );
                return players[key];
            })
            .then(nextPlayerId => getPlayerProfile(nextPlayerId))
            .then(player => {
                if (winner === 0)
                    updateGameMessage(`It is ${player.userName}'s turn now.`, gameId);
                return player;
            })
            .then(({uid, userName}) => setNextPlayer(gameId, uid, userName))
            .then(() => res())
            .catch(err => rej(err))
    );
};

const isWaitingGame = gameId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/waitingGames/${gameId}`)
            .once("value")
            .then(
                data =>
                    data.val() ? res(gameId) : rej({err: "Game does not exist!"})
            )
            .catch(err => rej(err))
    );
const isNotWaitingGame = gameId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/waitingGames/${gameId}`)
            .once("value")
            .then(
                data =>
                    data.val()
                        ? rej({err: "Game is still waiting for another player!"})
                        : res(gameId)
            )
            .catch(err => rej(err))
    );
const setWinner = winner =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${winner.currentlyPlaying}/public/gameStatus`)
            .update({winner: winner.userName})
            .then(() => res(winner))
            .catch(err => rej(err))
    );
const updateGameMessage = (message, gameId) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/public`)
            .update({message: message})
            .then(() => res(gameId))
            .catch(err => rej(err))
    );
const addPlayerToGame = (gameId, player) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/private/players`)
            .update({playerTwo: player.uid})
            .then(() => addPublicPlayerGame(gameId, player))
            .then(() => res())
            .catch(err => rej(err))
    );
const setTimeStamp = gameId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/private`)
            .update({timeStamp: Date.now()})
            .then(() => res(gameId))
            .catch(err => rej(err))
    );
const getTimeStamp = gameId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/private/timeStamp`)
            .once("value")
            .then(data => res(data.val()))
            .catch(err => rej(err))
    );
const addPublicPlayerGame = (gameId, player) =>
    new Promise((res, rej) =>
        admin
            .database()
            // .ref(`/games/${gameId}/public/gameStatus/playerTwo`)
            .ref(`/games/${gameId}/public/gameStatus/playerName`)
            .update({p2: player.email})
            .then(() => res())
            .catch(err => rej(err))
    );
const deleteWaitingGame = gameId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/waitingGames/${gameId}`)
            .remove()
            .then(() => res(gameId))
            .catch(err => rej(err))
    );

const createPrivateGame = (playerId, gameId) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/private`)
            .update({players: {playerOne: playerId}, nextPlayer: playerId})
            .then(() => res(gameId))
            .catch(err => rej(err))
    );

const createPublicGame = (gameName, gameId, playerOneName) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/public`)
            .update({
                gameStatus: getInitialState(playerOneName),
                message: "waiting for player two to join...",
                gameName,
                gameId,
                nextPlayer: playerOneName
            })
            .then(() => res(gameId))
            .catch(err => rej(err))
    );

const createWaitingGame = (gameName, gameId) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/waitingGames/${gameId}`)
            .update({gameName, gameId})
            .then(() => res(gameId))
            .catch(err => rej(err))
    );

const isWinnerMove = (futureGameState, gameId, player) => {
    const winner = (futureGameState.action !== 'PAWN_MOVED') ? 0 :
        ((futureGameState.location.X === 8 && futureGameState.gameState.playerTurn === 'p2') ||
            (futureGameState.location.X === 0 && futureGameState.gameState.playerTurn === 'p1'))
            ? player.email
            : 0;
    futureGameState.gameState.winner = winner;
    return new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/public/gameStatus`) // waitingGames
            .update({winner: winner})
            .then(() => res(futureGameState))// gameId
            .catch(err => rej(err))
    );
};
const getInitialState = playerOneName => ({
    pawns: {p1: {X: 0, Y: 4}, p2: {X: 8, Y: 4}},
    walls: {H: [], V: []},
    availableWalls: {p1: 6, p2: 6},
    playerName: {p1: playerOneName, p2: ""},
    playerTurn: "p1",
    winner: 0,
    history: ["Game is started."]
});

const setNextPlayer = (gameId, playerId, playerName) =>
    new Promise((res, rej) =>
        updatePrivatePlayerId(gameId, playerId, playerName)
            .then(() => updatePublicPlayerName(gameId, playerId, playerName))
            .then(() => res(setTimeStamp(gameId)))
            .catch(err => rej(err))
    );

const updatePrivatePlayerId = (gameId, playerId, playerName) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/private`)
            .update({nextPlayer: playerId})
            .then(() => res())
            .catch(err => rej(err))
    );
const updatePublicPlayerName = (gameId, playerId, playerName) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/public`)
            .update({nextPlayer: playerName})
            .then(() => res())
            .catch(err => rej(err))
    );

const updateGameState = (futureGameState, gameId) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/public`)
            .update({gameStatus: futureGameState.gameState})
            .then(() => res(futureGameState))
            .catch(err => rej(err))
    );
const getCurrentGameState = gameId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/public/gameStatus`)
            .once("value")
            .then(data => res(data.val()))
    );
const isValidMove = (currentGameState, futureMove) => {

    if (!validData)
        return Promise.reject("Invalid Data");

    let futureGameState = {
        player: futureMove.player,
        action: futureMove.action,
        location: futureMove.location,
        gameState: {
            playerTurn: currentGameState.playerTurn === 'p2' ? 'p1' : 'p2',
            pawns: {p1: {X: 0, Y: 4}, p2: {X: 8, Y: 4}}, // update
            walls: {H: [], V: []}, // update
            availableWalls: {p1: 0, p2: 0}, // update
            playerName: currentGameState.playerName,
            winner: currentGameState.winner,
            history: JSON.parse(JSON.stringify(currentGameState.history))
        }
    };

    switch (futureGameState['action']) {
        case 'PAWN_MOVED':
            if (currentGameState.walls) {
                if (currentGameState.walls.H)
                    futureGameState.gameState.walls.H = currentGameState.walls.H;
                if (currentGameState.walls.V)
                    futureGameState.gameState.walls.V = currentGameState.walls.V;
            }
            futureGameState.gameState.availableWalls = currentGameState.availableWalls;

            let valid = computePotentialPawn(currentGameState).filter((d) => {
                return d.X === futureGameState['location'].X && d.Y === futureGameState['location'].Y
            });
            if (valid.length === 1) {

                futureGameState.gameState.pawns[futureGameState.gameState.playerTurn] = currentGameState.pawns[futureGameState.gameState.playerTurn];
                futureGameState.gameState.pawns[currentGameState.playerTurn] = futureMove.location;
                futureGameState.gameState.history.push(`Pawn ${futureMove.player} is moved to location ${futureGameState['location'].X},${futureGameState['location'].Y}`);

                return Promise.resolve(futureGameState);
            }
            return Promise.reject("Invalid Move");
            break;
        case 'WALL_ADDED':
            futureGameState.gameState.pawns = currentGameState.pawns;

            let result = verifySelectedWall(currentGameState, futureGameState);
            if (result['result']) {

                if (currentGameState.walls) {
                    if (currentGameState.walls.H)
                        futureGameState.gameState.walls.H = JSON.parse(JSON.stringify(currentGameState.walls.H));
                    if (currentGameState.walls.V)
                        futureGameState.gameState.walls.V = JSON.parse(JSON.stringify(currentGameState.walls.V));
                }

                futureGameState.gameState.walls[futureMove.location[1]].push(futureMove.location[0]);
                if (futureMove.location[1] === 'V')
                    futureGameState.gameState.walls[futureMove.location[1]].push({X: futureMove.location[0].X, Y: futureMove.location[0].Y + ((futureMove.location[0].Y === 8) ? -1 : 1)});
                else
                    futureGameState.gameState.walls[futureMove.location[1]].push({X: futureMove.location[0].X + ((futureMove.location[0].X === 8) ? -1 : 1), Y: futureMove.location[0].Y});

                futureGameState.gameState.availableWalls[futureGameState.gameState.playerTurn] = currentGameState.availableWalls[futureGameState.gameState.playerTurn];
                futureGameState.gameState.availableWalls[currentGameState.playerTurn] = currentGameState.availableWalls[currentGameState.playerTurn] - 1;
                futureGameState.gameState.history.push(`${futureMove.location[1]} Wall is added by ${futureMove.player} in ${futureGameState['location'][0].X},${futureGameState['location'][0].Y}`);

                return Promise.resolve(futureGameState);
            }
            return Promise.reject("Invalid Wall");
            break;
        default:
            return Promise.reject("Invalid action");
    }
};

const createPlayerProfile = ({data}) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/playersProfiles/${data.uid}`)
            .update({
                numberOfGamesPlayed: 0,
                won: 0,
                lost: 0,
                currentlyPlaying: 0,
                userName: data.email,
                uid: data.uid
            })
            .catch(err => rej({err}))
    );
const getPlayerProfile = playerId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/playersProfiles/${playerId}`)
            .once("value")
            .then(data => res(data.val()))
            .catch(err => rej(err))
    );
const getPlayers = gameId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/private/players`)
            .once("value")
            .then(data => res(data.val()))
    );
const getNextPlayer = gameId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/games/${gameId}/private/nextPlayer`)
            .once("value")
            .then(data => res(data.val()))
    );
const isCurrentlyPlaying = playerId =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/playersProfiles/${playerId}`)
            .once("value")
            .then(
                data =>
                    data.val().currentlyPlaying !== 0
                        ? rej({err: "You already playing another game!"})
                        : res(playerId)
            )
            .catch(err => rej(err))
    );
const setCurrentlyPlaying = (playerId, gameId) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/playersProfiles/${playerId}`)
            .update({currentlyPlaying: gameId})
            .then(() => res(gameId))
            .catch(err => rej(err))
    );
const updatePlayerProfile = (playerId, player) =>
    new Promise((res, rej) =>
        admin
            .database()
            .ref(`/playersProfiles/${playerId}`)
            .update({
                numberOfGamesPlayed: player.numberOfGamesPlayed,
                won: player.won,
                lost: player.lost,
                currentlyPlaying: player.currentlyPlaying
            })
            .then(() => res(player))
            .catch(err => rej(err))
    );

//------------------  game logic

/**
 * find potential locations for the player pawn
 */
const computePotentialPawn = (gameState) => {

    let player = gameState.playerTurn;
    let otherPawn = (gameState.playerTurn === 'p1') ? 'p2' : 'p1';

    gameState['walls'] = gameState['walls'] ? gameState['walls'] : {H: [], V: []};
    gameState['walls'].H = gameState['walls']['H'] ? gameState['walls']['H'] : [];
    gameState['walls'].V = gameState['walls']['V'] ? gameState['walls']['V'] : [];

    // initialize the list
    let potentialPawn = [];

    // check if the location is blocked by a wall
    let bottom = gameState.walls.H.filter((d) => gameState.pawns[player].X === d.X && gameState.pawns[player].Y === d.Y);
    let top = gameState.walls.H.filter((d) => gameState.pawns[player].X === d.X && gameState.pawns[player].Y - 1 === d.Y);
    let right = gameState.walls.V.filter((d) => gameState.pawns[player].X === d.X && gameState.pawns[player].Y === d.Y);
    let left = gameState.walls.V.filter((d) => gameState.pawns[player].X - 1 === d.X && gameState.pawns[player].Y === d.Y);

    if (bottom.length === 0)
        potentialPawn.push({X: gameState.pawns[player].X, Y: gameState.pawns[player].Y + 1});
    if (top.length === 0)
        potentialPawn.push({X: gameState.pawns[player].X, Y: gameState.pawns[player].Y - 1});
    if (right.length === 0)
        potentialPawn.push({X: gameState.pawns[player].X + 1, Y: gameState.pawns[player].Y});
    if (left.length === 0)
        potentialPawn.push({X: gameState.pawns[player].X - 1, Y: gameState.pawns[player].Y});

    // remove the location if it is already taken by the other pawn
    potentialPawn = potentialPawn.filter((d) => !((d.X === gameState.pawns[otherPawn].X) && (d.Y === gameState.pawns[otherPawn].Y)));

    // remove the location if it blocks players?

    return potentialPawn;

};
/**
 * check if the selected wall is valid
 * @param gameState
 * @param futureGameState
 */
const verifySelectedWall = (gameState, futureGameState) => {

    let wall = futureGameState['location'][0];
    let orientation = futureGameState['location'][1];

    // check if the player used all walls

    if (gameState.availableWalls[gameState.playerTurn] === 0)
        return {result: false};

    // check if the wall overlaps with other walls

    let validWall = isWallNotOverlap(gameState, wall, orientation);

    // check if the wall blocks other wall

    gameState.walls = (gameState.walls) ? gameState.walls : {H: [], V: []};
    // deep copy
    let newSetOfWalls = JSON.parse(JSON.stringify(gameState.walls));
    // add the wall
    newSetOfWalls[orientation].push(wall);
    // add the other partition of the selected wall
    if (orientation === 'V')
        newSetOfWalls[orientation].push({X: wall.X, Y: wall.Y + ((wall.Y === 8) ? -1 : 1)});
    else
        newSetOfWalls[orientation].push({X: wall.X + ((wall.X === 8) ? -1 : 1), Y: wall.Y});

    let isP1Blocked = checkPathExistence(gameState, 'p1', newSetOfWalls);
    let isP2Blocked = checkPathExistence(gameState, 'p2', newSetOfWalls);

    return {newSetOfWalls: newSetOfWalls, result: (!isP1Blocked && !isP2Blocked && validWall)}
};


/**
 * check if the walls overlaps with other walls
 * @param gameState
 * @param wall
 * @param orientation
 */
const isWallNotOverlap = (gameState, wall, orientation) => {

    if (!gameState['walls']) return true;
    gameState['walls'].H = gameState['walls']['H'] ? gameState['walls']['H'] : [];
    gameState['walls'].V = gameState['walls']['V'] ? gameState['walls']['V'] : [];

    // check whether there is already a wall at this location

    if (gameState['walls'][orientation]) {
        let wallElement = gameState['walls'][orientation].filter(function (d) {
            return wall.X === d.X && wall.Y === d.Y;
        });
        // console.log("wallElement", wallElement);
        if (wallElement.length > 0)
            return false;
    }

    // check if the other wall partition is overlapping

    if (gameState['walls'][orientation]) {
        let wallElement = [];
        if (orientation === 'H') {
            let nextWall = (wall.X === 8) ? -1 : 1;
            wallElement = gameState['walls']['H'].filter((d) => {
                return wall.X + nextWall === d.X && wall.Y === d.Y;
            });
        }
        else if (orientation === 'V') {
            let nextWall = (wall.Y === 8) ? -1 : 1;
            wallElement = gameState['walls']['V'].filter((d) => {
                return wall.X === d.X && wall.Y + nextWall === d.Y;
            });
        }

        if (wallElement.length > 0)
            return false;
    }

    // check whether there is a wall w/ different orientation intersecting

    if (!gameState['walls'][orientation === 'H' ? 'V' : 'H'])
        return true;

    let wallElement = [];
    if (orientation === 'H') {
        let lastColumn = (wall.X === 8) ? -1 : 0;

        wallElement = gameState['walls']['V'].filter((d) => {
            // top wall exists?
            if (!(d.X === wall.X + lastColumn && d.Y === wall.Y))
                return false;

            // bottom wall exists?
            let bottomWall = gameState['walls']['V'].filter((dd) => {
                return dd.X === wall.X + lastColumn && dd.Y === wall.Y + 1
            });

            return bottomWall.length !== 0
        });
    }

    else if (orientation === 'V') {
        let lastRow = (wall.X === 8) ? -1 : 0;
        wallElement = gameState['walls']['H'].filter((d) => {
            // left wall exists?
            if (!(d.X === wall.X && d.Y === wall.Y + lastRow))
                return false;
            // right wall exists?
            let rightWall = gameState['walls']['H'].filter((dd) => {
                return dd.X === wall.X + 1 && dd.Y === wall.Y + lastRow
            });
            return rightWall.length !== 0
        });

    }

    return wallElement.length === 0

};

/**
 * check if the player pawn is blocked by walls
 * @param gameState
 * @param player string: 'p1' or 'p2'
 * @param walls similar to gameState.walls + new walls
 */
const checkPathExistence = (gameState, player, walls) => {

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

    let foundRoute = route.path(`${gameState.pawns[player].X},${gameState.pawns[player].Y}`, 'dummy');
    return foundRoute === null;

};

const validData = (currentGameState, futureMove) => {

    // check for missing data and data types

    if (!futureMove) return false;
    if (typeof futureMove !== "object") return false;
    if (Object.keys(futureMove).length !== 3) return false;

    if (!futureMove.player) return false;
    if (typeof futureMove.player !== "string") return false;
    if (futureMove.player !== currentGameState.playerTurn) return false;

    if (!futureMove.action) return false;
    if (typeof futureMove.action !== "string") return false;

    if (!futureMove.location) return false;
    if (typeof futureMove.location !== "object") return false;


    switch (futureMove['action']) {
        case 'PAWN_MOVED':
            if (Object.keys(futureMove.location).length !== 2) return false;
            if (!futureMove.location.X || !futureMove.location.Y) return false;
            if (typeof futureMove.location.X !== "number" || typeof futureMove.location.Y !== "number") return false;

            break;
        case 'WALL_ADDED':
            if (Object.keys(futureMove.location).length !== 2) return false;
            if (Object.keys(futureMove.location[0]).length !== 2) return false;
            if (!futureMove.location[0].X || !futureMove.location[0].Y) return false;
            if (typeof futureMove.location[0].X !== "number" || typeof futureMove.location[0].Y !== "number") return false;
            if (typeof futureMove.location[1] !== "string") return false;

            break;
        default:
            return false;
    }
};
//------------------

module.exports = {
    createGame,
    joinGame,
    createPlayerProfile,
    setMove,
    getLeaderBoard,
    leaveGame,
    getPlayerProfile,
    timeout
};