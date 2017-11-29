import firebase from "firebase";
import { config } from "./dbconfig";
import PubSub from "pubsub-js";
export class api {
  // @required subscribe:
  //1.newWaitingGames -> waiting games list.
  constructor() {
    firebase.initializeApp(config);
    this.database = firebase.database();
    this.newWaitingGameSubscription();
  }
  createNewWaitingGame(gameName, token) {
    return new Promise((res, rej) =>
      fetch(
        "http://localhost:5001/quoridor-swe681/us-central1/api/creategame",
        {
          method: "POST",
          body: JSON.stringify({
            token,
            gameName
          })
        }
      )
        .then(payload => payload.json())
        .then(payload => (payload.err ? Promise.reject(payload.err) : payload))
        .then(payload => res(payload.gameId))
        .catch(err => rej(err))
    );
  }

  getLeaderBoard(token) {
    return new Promise((res, rej) =>
      fetch(
        `http://localhost:5001/quoridor-swe681/us-central1/api/leaderboard?token=${
          token
        }`,
        {
          method: "GET"
        }
      )
        .then(payload => payload.json())
        .then(payload => (payload.err ? Promise.reject() : payload))
        .then(players => res(players))
        .catch(err => rej(err))
    );
  }

  joinExistingGame(gameId, token) {
    return new Promise((res, rej) =>
      fetch("http://localhost:5001/quoridor-swe681/us-central1/api/joingame", {
        method: "put",
        body: JSON.stringify({
          token,
          gameId
        })
      })
        .then(payload => payload.json())
        .then(payload => (payload.err ? Promise.reject(payload.err) : payload))
        .then(payload => res(payload.gameId))
        .catch(err => rej(err))
    );
  }
  leaveGame(gameId, token) {
    return new Promise((res, rej) =>
      fetch("http://localhost:5001/quoridor-swe681/us-central1/api/leavegame", {
        method: "put",
        body: JSON.stringify({
          token,
          gameId
        })
      })
        .then(payload => payload.json())
        .then(payload => (payload.err ? Promise.reject(payload.err) : payload))
        .then(gameId => res(gameId))
        .catch(err => rej(err))
    );
  }
  setMove(gameId, token) {
    return new Promise((res, rej) =>
      fetch("http://localhost:5001/quoridor-swe681/us-central1/api/setmove", {
        method: "put",
        body: JSON.stringify({
          token,
          gameId
        })
      })
        .then(payload => payload.json())
        .then(payload => (payload.err ? Promise.reject(payload.err) : payload))
        .then(payload => res(payload.gameId))
        .catch(err => rej(err))
    );
  }
  getPlayerProfile(token) {
    return new Promise((res, rej) =>
      fetch(
        `http://localhost:5001/quoridor-swe681/us-central1/api/getPlayerProfile?token=${
          token
        }`,
        {
          method: "GET"
        }
      )
        .then(payload => (payload.err ? Promise.reject() : payload))
        .then(payload => payload.json())
        .then(players => res(players))
        .catch(err => rej(err))
    );
  }
  //@scope:private
  newWaitingGameSubscription() {
    this.database
      .ref("waitingGames")
      .on("value", snapshot => this.publish("newWaitingGames", snapshot.val()));
  }
  GameSubscription(gameId) {
    this.database
      .ref(`games/${gameId}/public`)
      .on("value", snapshot => this.publish("gameChange", snapshot.val()));
  }
  cancelGamesSubscription(gameId) {
    this.database.ref(`games/${gameId}/public`).off();
  }
  //@scope:private
  cancelWaitingGamesSubscription() {
    this.database.ref("waitingGames").off();
  }
  publish(message, data) {
    PubSub.publish(message, data);
  }
}
