const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const {
  isAuthenticated,
  checkTurn,
  isPlayingGame,
  getPlayerInfo
} = require("./auth");
const {
  createGame,
  joinGame,
  setMove,
  createPlayerProfile,
  getLeaderBoard,
  leaveGame,
  getPlayerProfile,
  timeout
} = require("./game");
const corsOptions = {
  origin: "http://localhost:8080", //"https://quoridor-swe681.firebaseapp.com",
  optionsSuccessStatus: 200
};
const helmet = require("helmet");
const app = express();
app.use(
  helmet.hsts({
    maxAge: 7776000000,
    includeSubdomains: true
  })
);
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  })
);
app.use(cors(corsOptions));

app.put("/setMove", (req, res) => {
  const params = JSON.parse(req.body);
  isAuthenticated(params.token)
    .then(player => checkTurn(params.gameId, player))
    .then(player => setMove(player, params.gameId, params.move))
    .then(() => res.json(params.gameId))
    .catch(err => res.send({ err }));
});
app.put("/timeout", (req, res) => {
  const params = JSON.parse(req.body);
  isAuthenticated(params.token)
    .then(player => isPlayingGame(params.gameId, player))
    .then(player => timeout(player, params.gameId))
    .then(() => res.send())
    .catch(err => res.send({ err }));
});

app.post("/createGame", (req, res) => {
  const params = JSON.parse(req.body);
  isAuthenticated(params.token)
    .then(player => createGame(params.gameName, player))
    .then(gameId => res.json(gameId))
    .catch(err => res.send({ err }));
});

app.put("/joinGame", (req, res) => {
  const params = JSON.parse(req.body);
  isAuthenticated(params.token)
    .then(player => joinGame(params.gameId, player))
    .then(gameId => res.json(gameId))
    .catch(err => res.send(err));
});
app.put("/leaveGame", (req, res) => {
  const params = JSON.parse(req.body);
  isAuthenticated(params.token)
    .then(player => isPlayingGame(params.gameId, player))
    .then((player) => leaveGame(params.gameId, player.uid))
    .then(gameId => res.json(gameId))
    .catch(err => res.send({ err }));
});
app.get("/leaderBoard", (req, res) => {
  const token = req.query.token;
  var seconds = Date.now();
  isAuthenticated(token)
    .then(getLeaderBoard)
    .then(leaderBoard => res.send(leaderBoard))
    .catch(err => res.send({ err }));
  // setTimeout(() => console.log(Date.now() - seconds), 60 * 1000);
});
app.get("/getPlayerProfile", (req, res) => {
  const token = req.query.token;
  isAuthenticated(token)
    .then(player => getPlayerProfile(player.uid))
    .then(playerProfile => res.send(playerProfile))
    .catch(err => res.send({ err }));
});
app.all("**", (req, res) => {
  res.sendStatus(404);
});
exports.creatUserProfile = functions.auth.user().onCreate(createPlayerProfile);

exports.api = functions.https.onRequest(app);
