import { auth } from "./database/auth";
import { api } from "./database/api";
import { user } from "./user";
import PubSub from "pubsub-js";

class index {
  constructor() {
    this.subscribe();
    this.api = new api();
    this.auth = new auth();
    this.user = new user();
    this.hide(mainPage);
  }

  mainPageRender() {
    gamesDIV.innerHTML = "";
    this.existingGames.forEach(
      game =>
        (gamesDIV.innerHTML += `<br><button id = ${
          game.gameId
        } class = "existingGames" > ${game.gameName}</button>`)
    );
    this.registerEventListeners();
  }
  registerEventListeners() {
    Array.from(document.getElementsByClassName("existingGames")).forEach(ele =>
      ele.addEventListener("click", () => this.joinGame(ele.id))
    );
  }
  manageAuth(action) {
    switch (action) {
      case "logIn":
		var re=/^\w+@([a-zA-Z_]+?\.)+[a-zA-Z]{2,3}$/;
		var re1=/^\w+$/;
		if((re.test(lemail.value))&&(re1.test(lpass.value)))
		{
			this.hide(errMessage);
			this.auth.logIn(lemail.value, lpass.value);
		}
		else if(re.test(lemail.value))
		{
			this.show(errMessage);
			errMessage.textContent ="please enter a alphanumeric password";
			document.getElementById("lemail").value="";
			document.getElementById("lpass").value="";
		}
		else
		{
			this.show(errMessage);
			errMessage.textContent ="please enter a valid email";
			document.getElementById("lemail").value="";
			document.getElementById("lpass").value="";
		}
        break;
      case "logOut":
        this.auth.logout();
		this.hide(mainPage);
		document.getElementById("email").value="";
		document.getElementById("lemail").value="";
		document.getElementById("username").value="";
		document.getElementById("pass").value="";
		document.getElementById("lpass").value="";
		this.hide(login);
		this.show(homePage);
		this.hide(leaderboard);
        break;
      case "signUp":
		var re=/^\w+@([a-zA-Z_]+?\.)+[a-zA-Z]{2,3}$/;
		var re1=/^\w+$/;
		if((re.test(email.value))&&(re1.test(pass.value))&&(re1.test(username.value)))
		{
			this.hide(errMessage1);
			this.auth.signUp(email.value, pass.value, username.value);
		}
		else if(re.test(email.value)&&re1.test(pass.value))
		{
		this.show(errMessage1);
		errMessage1.textContent ="please enter alphanumeric username";
		document.getElementById("email").value="";
		document.getElementById("username").value="";
		document.getElementById("pass").value="";
		}
		else if(re.test(email.value)&&re1.test(username.value))
		{
		this.show(errMessage1);
		errMessage1.textContent ="please enter alphanumeric password";
		document.getElementById("email").value="";
		document.getElementById("username").value="";
		document.getElementById("pass").value="";
		}
		else
		{
		this.show(errMessage1);
		errMessage1.textContent ="please enter valid gmail";
		document.getElementById("email").value="";
		document.getElementById("username").value="";
		document.getElementById("pass").value="";
		}
        break;
      default:
        throw new Error("UnsupportedOperation:manageAuth");
    }
  }
   displayLoginPage() { //added by me
	  this.show(login);
	  this.hide(homePage);
  }
  displaySigninPage(){
	this.show(signin);
	this.hide(homePage);
  }
  createGame() {
    this.api
      .createNewWaitingGame(gameName.value, this.user.token)
      .then(gameId => this.user.setGameId(gameId))
      .then(() => this.api.GameSubscription(this.user.gameId))
      .catch(err => console.log(err));
  }
  joinGame(gameId) {
    this.api
      .joinExistingGame(gameId, this.user.token)
      .then(() => this.user.setGameId(gameId))
      .then(() => this.api.GameSubscription(this.user.gameId))
      .catch(err => console.log(err));
  }
  displaytable() {
		this.hide(mainPage);
		this.show(leaderboard);
		document.
		getElementById("backButton").addEventListener("click",() => {
			this.hide(leaderboard);
			this.show(mainPage);
		
	});
  }
  checkStatus(user) {
    if (user) {
      this.user.setName(user.email);
      setTimeout(
        () =>
          this.auth
            .getIdToken()
            .then(token => this.user.setToken(token))
            .then(() =>
              this.api
                .getPlayerProfile(this.user.token)
                .then(profile => this.user.setGameId(profile.currentlyPlaying))
            )
            .then(
              () =>
                this.user.gameId != 0
                  ? this.api.GameSubscription(this.user.gameId)
                  : this.user.gameId
            )
            .catch(err => console.log(err)),
        5000
      );
	  this.show(lableName);
      this.show(mainPage);
      this.hide(login);
	  this.hide(signin);
      this.hide(errMessage);
	  this.hide(homePage);
      if (user.displayName) this.updateUserName(user.email);
    } else {
      this.user.setToken("");
      this.show(homePage);
      this.hide(labelName);
      this.hide(mainPage);
    }
  }
  subscribe() {
    PubSub.subscribe("newWaitingGames", (mag, data) => {
      if (data) {
        this.existingGames = Object.keys(data).map(key => data[key]);
      } else {
        this.existingGames = [];
      }
      this.mainPageRender();
    });
    PubSub.subscribe("gameChange", (meg, data) => {
      if (data.nextPlayer === 0)
        this.api.cancelGamesSubscription(this.user.gameId);

      console.log(data);
    });
    PubSub.subscribe("authChange", (meg, user) => this.checkStatus(user));
    PubSub.subscribe("error", (msg, data) => {
      this.show(errMessage);
      errMessage.textContent = data;
    });
  }
  hide(element) {
    element.style.display = "none";
  }
  show(element) {
    element.style.display = "";
  }

  updateUserName(name) {
    labelName.textContent = `Welcome: ${name}`;
  }
  leaveGame() {
    this.api.leaveGame(this.user.gameId, this.user.token);
  }
  playMove(){
    this.api.setMove(this.user.gameId, this.user.token);
  }
}


const app = new index();
document
  .getElementById("logInorsignUp")   //added by me
  .addEventListener("click", () => app.displaySigninPage());
  document
  .getElementById("logInorsignUp1")   //added by me
  .addEventListener("click", () => app.displayLoginPage());
document
  .getElementById("logIn")
  .addEventListener("click", () => app.manageAuth("logIn"));
document
  .getElementById("logOut")
  .addEventListener("click", () => app.manageAuth("logOut"));
document
  .getElementById("signUp")
  .addEventListener("click", () => app.manageAuth("signUp"));
document
  .getElementById("createGame")
  .addEventListener("click", () => app.createGame());
document
  .getElementById("leave")
  .addEventListener("click", () => app.leaveGame());
  document
  .getElementById("playMove")
  .addEventListener("click", () => app.playMove());
  document.
	getElementById("gameStats").addEventListener("click",() => app.displaytable());