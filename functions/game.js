const admin = require("firebase-admin");

const createGame = (gameName, player) =>
  new Promise((res, rej) =>
    isCurrentlyPlaying(player.uid)
      .then(generateGameId)
      .then(gameId => createPrivateGame(player.uid, gameId))
      .then(gameId => createPublicGame(gameName, gameId, player.email))
      .then(gameId => createWaitingGame(gameName, gameId))
      .then(gameId => setCurrentlyPlaying(player.uid, gameId))
      .then(gameId => res({ gameId }))
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
            gameState.playerOne.name
          } One turn.`,
          gameId
        )
      )
      .then(() => res(gameId))
      .catch(err => rej(err))
  );
const setMove = (player, gameId, futureGameState) =>
  new Promise((res, rej) =>
    isNotWaitingGame(gameId)
      // .then(() => getCurrentGameState(gameId))
      // .then(currentGameState => isValidMove(currentGameState, futureGameState))
      // .then(futureGameState =>
      //   isWinnerMove(futureGameState, gameId, player.uid)
      // )
      // .then(futureGameState => updateGameState(futureGameState, gameId))
      // .then(
      //   futureGameState =>
      //     futureGameState.winner != 0
      //       ? res(updateGameMessage(`The winner is ${player.userName}`, gameId))
      //       : futureGameState
      // )
      .then(() => getPlayers(gameId))
      .then(players => {
        const key = Object.keys(players).filter(
          key => players[key] != player.uid
        );
        return players[key];
      })
      .then(nextPlayerId => getPlayerProfile(nextPlayerId))
      .then(player => {
        updateGameMessage(`It is ${player.userName}'s turn now.`, gameId);
        return player;
      })
      .then(({ id, userName }) => setNextPlayer(gameId, id, userName))
      .then(() => res())
      .catch(err => rej({ err }))
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
        players.map(({ lost, won, numberOfGamesPlayed, userName }) => ({
          lost,
          won,
          numberOfGamesPlayed,
          userName
        }))
      )
      .then(players => res(players))
      .catch(err => rej({ err }))
  );
const leaveGame = (gameId, playerId) =>
  new Promise((res, rej) =>
    getCurrentGameState(gameId)
      .then(
        gameState =>
          gameState.winner != 0 ? rej("Game already finished") : gameId
      )
      .then(gameId => getPlayers(gameId))
      .then(players => {
        const key = Object.keys(players).filter(
          key => players[key] != playerId
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

      .then(winner => updatePlayerProfile(winner.id, winner))
      .then(winner =>
        updateGameMessage(`${winner.userName} is the winner`, gameId)
          .then(() => getPlayerProfile(playerId))
          .then(loser => {
            loser.lost = loser.lost + 1;
            loser.currentlyPlaying = 0;
            loser.numberOfGamesPlayed = loser.numberOfGamesPlayed + 1;
            return loser;
          })

          .then(loser => updatePlayerProfile(loser.id, loser))
      )
      .then(() => setNextPlayer(gameId, 0, 0))
      .then(() => res())
      .catch(err => rej({ err }))
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
const isWaitingGame = gameId =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/waitingGames/${gameId}`)
      .once("value")
      .then(
        data =>
          data.val() ? res(gameId) : rej({ err: "Game does not exist!" })
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
            ? rej({ err: "Game is still waiting for another player!" })
            : res(gameId)
      )
      .catch(err => rej(err))
  );
const setWinner = winner =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/games/${winner.currentlyPlaying}/public/gameStatus`)
      .update({ winner: winner.userName })
      .then(() => res(winner))
      .catch(err => rej(err))
  );
const updateGameMessage = (message, gameId) =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/games/${gameId}/public`)
      .update({ message: message })
      .then(() => res())
      .catch(err => rej(err))
  );
const addPlayerToGame = (gameId, player) =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/games/${gameId}/private/players`)
      .update({ playerTwo: player.uid })
      .then(() => addPublicPlayerGame(gameId, player))
      .then(() => res())
      .catch(err => rej(err))
  );
const addPublicPlayerGame = (gameId, player) =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/games/${gameId}/public/gameStatus/playerTwo`)
      .update({ name: player.email })
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
      .update({ players: { playerOne: playerId }, nextPlayer: playerId })
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
      .update({ gameName, gameId })
      .then(() => res(gameId))
      .catch(err => rej(err))
  );
//not yet completed
const isWinnerMove = (futureGameState, gameId, playerId) => {
  const winner =
    WinningPosition.find(futureGameState.playerOne.position) ||
    WinningPosition.find(futureGameState.playerOne.position)
      ? playerId
      : 0;

  return new Promise((res, rej) =>
    admin
      .database()
      .ref(`/waitingGames/${gameId}`)
      .update({ winner })
      .then(() => res(gameId))
      .catch(err => rej(err))
  );
};
const getInitialState = playerOneName => ({
  playerOne: {
    position: { x: 0, y: 0 },
    remainingWalls: 6,
    name: playerOneName
  },
  playerTwo: { position: { x: 0, y: 0 }, remainingWalls: 6 },
  wallsPosition: [],
  winner: 0
});
const setNextPlayer = (gameId, playerId, playerName) =>
  new Promise.all(
    new Promise((res, rej) =>
      admin
        .database()
        .ref(`/games/${gameId}/private`)
        .update({ nextPlayer: playerId })
        .then(() => res())
        .catch(err => rej(err))
    ),
    new Promise((res, rej) =>
      admin
        .database()
        .ref(`/games/${gameId}/public`)
        .update({ nextPlayer: playerName })
        .then(() => res())
        .catch(err => rej(err))
    )
  );
const updateGameState = (gameState, gameId) =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/games/${gameId}/public`)
      .update({ gameState })
      .then(() => res(gameState))
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
const isValidMove = (oldMove, newMove) => {
  return Promise.resolve();
};

const createPlayerProfile = ({ data }) =>
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
        id: data.uid
      })
      .catch(err => rej({ err }))
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
const isCurrentlyPlaying = playerId =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/playersProfiles/${playerId}`)
      .once("value")
      .then(
        data =>
          data.val().currentlyPlaying != 0
            ? rej({ err: "You already playing another game!" })
            : res(playerId)
      )
      .catch(err => rej(err))
  );
const setCurrentlyPlaying = (playerId, gameId) =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/playersProfiles/${playerId}`)
      .update({ currentlyPlaying: gameId })
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
module.exports = {
  createGame,
  joinGame,
  createPlayerProfile,
  setMove,
  getLeaderBoard,
  leaveGame,
  getPlayerProfile
};
