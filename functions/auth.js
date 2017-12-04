const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

const isAuthenticated = idToken =>
  new Promise((res, rej) =>
    admin
      .auth()
      .verifyIdToken(idToken)
      .then(decodedToken => res(decodedToken))
      .catch(err => rej({ err }))
  );
const checkTurn = (gameId, player) =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/games/${gameId}/private`)
      .once("value")
      .then(
        data =>
          data.val().nextPlayer === player.uid ? res(player) : rej("Not Authorized!")
      )
      .catch(err => rej({ err: "Unauthorized Access" }))
  );
const isPlayingGame = (gameId, player) =>
  new Promise((res, rej) =>
    admin
      .database()
      .ref(`/games/${gameId}/private/players`)
      .once("value")
      .then(
        data =>
          data.val().playerOne === player.uid || data.val().playerTwo === player.uid
            ? res(player)
            : rej("Not playing this game!")
      )
      .catch(err => rej({ err: "Unauthorized Access" }))
  );
const getPlayerInfo = playerId =>
  new Promise((res, rej) =>
    admin
      .auth()
      .getUser(playerId)
      .then(player => res(player))
      .catch(err => rej({ err: "Failed to Authenticate" }))
  );
module.exports = { isAuthenticated, checkTurn, getPlayerInfo, isPlayingGame };
