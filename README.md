# Billion Dollar Ideas
#### Video Demo:  <https://youtu.be/LWMN1yYc-9c>
#### Description:
It's a web application party game in which players are given a series of prompts (everyday problems), and must come up with a solution to each problem. Then, players vote on whose solutions were best or funniest (or any other criteria, it's up to the players). The app uses Node JS, Express, and Socket.io to run a server through the wifi network of the host device. Any device on that wifi network can join the game using the ip address and portkey in their url.

To start a game, obtain the IP address with the following terminal command:
`ipconfig`
Then, enter the project repository and run the following terminal command, creating a Node JS server:
`node server.js`
This will start the server, and a server running message will be logged in the terminal. On each device, type the following url (insert the IP address into ipAddress): <http://ipAddress:3000/>. This will enter the application on the user's device, then the game can be played as shown in the video.

The repository folder contains the following files:

##### server.js
This script acts as the backend hive which runs the Node server. It first runs commands to listen for client connections. When a client (player) connects, the server emits messages and waits for responses. It assigns each player various characteristics stored in the Player object. For example, when a player joins, this script emits a "go to name page" to the client (this is where the player chooses their name). Then, the server listens for a "name selected" signal, when that is recieved, the server updates that player's information. This cycle of emitting and recieving messages continues through the whole game, acting as a central command, instructing clients where they should be. 

Some smaller functions of this script are:
- server.js imports the prompts from prompts.js, and selects a number of random prompts for each game. 
- Acting as a clock for the game, setting timeouts (pauses) during various non-interactive moments. For example, the 'calculating final results' page is entirely controlled by this script, and clients update to the final results page depending on the timed pause. 
- Keeping various arrays and tallies of each player's vote counts, as well as their responses. All interactive information about each player is stored in server.js and when it is needed on the front end side, it can be emitted to clients.
- Assigning one client to be the VIP, this player is given hosting privileges like starting and restarting the game.

Finally, at the end of the game, the server runs a function to reset all tallies, counts, player lists, and other aspects to restart the game.

##### prompts.js
This file is very straightforward, it simply stores and exports the list of 100 prompts, as well as a prompt count. It is completely seperate from all functionality, and is a compile-time program. All functions performed with the prompts (selecting random ones) are done in other files such as server.js

##### index.html (/public)
This file displays the frontend portion of the web application using a single container. It links the needed styles, fonts, socket software, and client script to update the user interface page. The file is automatically accessed by server.js (it looks for /public/index.html and runs that as a client page). 

##### styles.css (/public)
Defines the styleguide for index.html.

##### client.js (/public)
This script runs for each index.html page opened. It acts as a middleman, connecting the backend server.js to the frontend index.html. Its main function is listening for server emits, performing the necessary function, and emitting signals back to the server. The entire application is just a constant back and forth between server.js and client.js. 

Furthermore, the script is a finite state machine which contains a function for each major HTML page display. For example, there is a name-page function, results page function, responses page function, etc. Each page is built entirely from scratch, and the states are updated to build new pages upon the recieval of new information. For example, when the server emits "go to name page", the client will run the name page function. Then, when a user inputs their name, the client will emit "name selected" to the server. 

Note that relatively no information is actually stored in this script (relative to the amount of information stored in the server script). When game information must be presented, the server emits the information, and the client recieves/presents it. For example, once a client sends their response in, it no longer exists in the client script, the server holds all responses.