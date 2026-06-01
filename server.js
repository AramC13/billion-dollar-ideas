// number_prompts can be edited to determine how many prompts are needed, nothing else should be 
// timeouts should be edited depending on the number of players

// Set up server
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public")); // find frontend code in public folder

// Server listen
server.listen(3000, "0.0.0.0", function() {
    console.log("server running on 3000 on wifi network")
});

// Set up game
let room_is_empty = true;
let player_count = 0;
let player_arr = []; // starts empty
let locked_player_count = 0;
let locked_player_arr = [];
let names = [];
let lobby_locked = false;
let players_ready = 0; // this variable will track players ready to start game, and players ready to move to reveal stage, and ready to move to next question after voting stage
let qIndex = 0; // tracks which question the results/voting is being done for

// Get info from prompts.js -> select random prompts
const number_prompts = 3;
let prompts = [];
const { number_all_prompts, all_prompts } = require("./prompts.js"); // will grab the two exported things (number_all_prompts, all_prompts in that order) from prompts.js (compiletime)
selectPrompts();

// The timeout waits depend on player count, for now use these:
let timeoutOne = 3000; // no edit, One: wait from when all responses are in before the Q1 responses are revealed (stage: start of response reveal, only called once/no overlap)
let timeoutTwo = 5000; // no edit, Two: wait from start of one results page until the next question's responses are begun to be displayed (called at results page of each q/no overlap)
let timeoutThree = 6000; // no edit, Three: time after last results shown before final results shown (called at last results page) (only called once/overlaps -> three - two = calculating final results page (i think))
let timeoutFour = 0; // edit, Four: wait from when the question is displayed until votes are to be revealed, make this one (player_count + 1) x timeoutFive () -> time for all responses to fully display, +1 bc there should be time from question display to first answer, and last answer to voting (called on each q's question display/overlaps, must include all of timeoutFive (time between response reveals during results for each q))
let timeoutFive = 1000; // no edit, Five: time in between revealing responses (called on each response/no overlap)
let timeoutSix = 1500; // no edit, time from prompt display before making interaction available (still in prompt/answering phase, no overlap)



// Class for a player/client, store info about the client like their name, points, etc.
class Player {
    constructor(socketID) {
        // Decide if they're the vip
        if (room_is_empty) {
            this.is_vip = true;
            room_is_empty = false;
        }
        else {
            this.is_vip = false;
        }

        this.name = "Obi-Wan Kenobi";

        this.socket_id = socketID;

        if (!lobby_locked) {
            this.index = player_count;
            player_count ++;
        }
        else {
            this.index = locked_player_count;
            locked_player_count ++;
        }

        this.responses = [];
        this.number_responses = 0;

        this.local_votes = 0; // for each question
        this.global_votes = 0; // for overall game
        this.global_wins = 0; // wins per question

        this.already_stored = false; // if true, selection sort won't take it to rank_arr
    }
}

io.on("connection", function(socket) {
    console.log("user has connected");
    
    // Before doing anything, check if lobby locked, if so, emit instructions to the client to wait
    if (lobby_locked) {
        io.to(socket.id).emit("lobby is locked");
    }

    // Update the player list
    let this_player = new Player(socket.id); // this line takes care of player counts, vip status, and socket id
    if (!lobby_locked) {
        player_arr.push(this_player); // newupdate123 THIS COULD BE MAKE OR BREAK
        
        // emit this player's index to store in client
        io.to(socket.id).emit("your index", this_player.index);
    }
    else locked_player_arr.push(this_player);
    console.log("with that user, player_count =", player_count);
    
    // locked players don't send any signals so they are only stored in the array, they dont affect anything until a new game

    // Set disconnection condition
    socket.on("disconnect", function() {
        console.log("user has disconnected");

        if (!lobby_locked) { // edit all actual things here

            names.splice(this_player.index, 1); // remove this player from the names list (splice shifts the list down like a queue)
            io.emit("new name", names); // reset the list to display

            player_count --;
            if (player_count == 0) room_is_empty = true;
            
            player_arr.splice(this_player.index, 1); // removes this_player.index in the array

            // Update vip info if that player was vip
            if (this_player.is_vip && player_count > 0) {
                player_arr[0].is_vip = true; 
                io.to(player_arr[0].socket_id).emit("are you first", true);
            }

            //delete this_player; this is not necessary, JS garbage collector will free the memory

            // also update indices (note that the actual indexes have been changed, these are the stored indices in each player object)
            for (let i = this_player.index + 1; i < player_count; i ++) {

                player_arr[i].index --;
                io.to(player_arr[i].socket_id).emit("your index", player_arr[i].index);

            }

        }   

        // if they are a lobbylocked player, update the lobbylocked stuff
        else {
            locked_player_count --;

            locked_player_arr.splice(this_player.index, 1);

            for (let i = this_player.index + 1; i < locked_player_count; i ++) {
                locked_player_arr[i].index --;
            }
        }
        
        
    });

    // On this player's name setting, send them vip status, update thisPlayer
    socket.on("name chosen", function(name) {
        console.log("user set their name:", name);

        io.to(socket.id).emit("are you first", this_player.is_vip);

        // Append the names list and send the new list
        names.push(name);
        this_player.name = name;
        io.emit("new name", names);
    });

    // On start game, send start game signal to all players
    socket.on("goto instructions", function() {
        console.log("vip clicked start, going to instructions, sending game info package, player count: ", player_count)
        
        io.emit("goto instructions", prompts, number_prompts, player_count); // send info about this game specifically now that the lobby is locked

        lobby_locked = true; // tell other players to wait once game is started

        // Now that the lobby is locked, update the waits depending on player count
        timeoutFour = (player_count + 1) * timeoutFive;
    });

    // On a ready signal, check if all players are ready
    socket.on("ready", function() {
        players_ready ++;

        if (players_ready == player_count) {
            console.log("question round game started");

            io.emit("start game");

            players_ready = 0; // reset for next round

            // emit to each client when to make visible the text box and answer button (after timeout)
            setTimeout(() => {

                io.emit("interaction available");

            }, timeoutSix);
        }
    });

    //let i = 0;

    // If they send a question answer, update it in their player class
    socket.on("question answer", function(answer) {
        this_player.responses.push(answer); // push the answer to the responses array
        this_player.number_responses ++;

        if (this_player.number_responses == number_prompts) {
            console.log("client is ready");
            players_ready ++;

            if (players_ready == player_count) {
                players_ready = 0; // reset to use in voting

                console.log("all clients ready");
                io.emit("wait for reveal");

                // Set timer to wait 5 seconds so users can gather their nerves before actually revealing
                setTimeout(() => {
                    io.emit("goto reveal");

                    nextQ(0); // call the first question

                }, timeoutOne); 
            }
        }

        else { // if not, set a timer to make interaction available for the next q  (only do this for this socket)

            setTimeout(() => {

                io.to(socket.id).emit("interaction available");

            }, timeoutSix); // timeoutSix is the time from when a prompt is shown to when the inputs are visible to user

        }
    });

    // This is condition to check if a vote is complete for a question, where the results can be entered
    socket.on("player voted", function(vote) {
        player_arr[vote].local_votes ++;
        player_arr[vote].global_votes ++;
        players_ready ++;

        //console.log(player_arr[vote].name, "'s  local:  ", player_arr[vote].local_votes, "  global:  ", player_arr[vote].global_votes);

        if (players_ready == player_count) {
            console.log("players are all done voting");
            players_ready = 0;

            // Get scores, create rank_arr to pass to client
            let could_be_tie = true;
            let rank_arr = [];

            // Perform reverse selection sort (find maximum, put in next slot -> highest at front)
            for (let i = 0; i < player_count; i ++) {
                let local_max = -1; // so that even players with scores of 0 will beat it
                let local_index = 0;

                for (let j = 0; j < player_count; j ++) {
                    const this_score = player_arr[j].local_votes;

                    //console.log("player: ", player_arr[j].name, " already stored: ", player_arr[j].already_stored);

                    if (this_score > local_max && player_arr[j].already_stored == false) {
                        //console.log(player_arr[j].name, "alr sort: ", player_arr[j].already_stored);

                        local_max = this_score;
                        local_index = j;
                        //console.log("found score: ", player_arr[j].name, ": ", this_score);
                    }
                }

                // Now, local_index stores the index of the next player to put in rank_arr
                rank_arr.push(player_arr[local_index]);
                player_arr[local_index].already_stored = true;
                //console.log("adding this player: ", player_arr[local_index].name, "  ", player_arr[local_index].local_votes);

                // Now check for a tie to update the winners: first entry in rank || following entries that equal first
                if (i == 0 || could_be_tie && rank_arr[i].local_votes == rank_arr[0].local_votes) {
                    player_arr[local_index].global_wins ++;
                }
                else if (could_be_tie && rank_arr[i].local_votes < rank_arr[0].local_votes) {
                    could_be_tie = false;
                }

            }

            // Now send it to the results stage, client knows the question
            io.emit("goto results", rank_arr); // send the whole rank array so local votes can be done properly

            // Reset all globals for the next round
            for (let i = 0; i < player_count; i ++) {
                player_arr[i].local_votes = 0;
                player_arr[i].already_stored = false;
            }

            // Then perform a wait, then call the next question
            setTimeout(() => {
                qIndex ++;

                if (qIndex == number_prompts) {

                    // Tell them to go to the final waiting page
                    io.emit("goto final results"); // now they are told the computer is calculating final results, which is funny because its actually true

                    // Use rank_arr[] to store winners (first is wins, global votes is tiebreaker)
                    rank_arr = [];
                    for (let i = 0; i < player_count; i ++) {

                        let local_wins = -1;
                        let local_votes = -1;
                        let local_index = 0;

                        for (let j = 0; j < player_count; j ++) {

                            const this_wins = player_arr[j].global_wins;
                            const this_votes = player_arr[j].global_votes;

                            if (player_arr[j].already_stored || this_wins < local_wins) continue; // skip this one -> it either is already sorted or is less than the current max

                            if (this_wins > local_wins) {
            
                                local_wins = this_wins;
                                local_votes = this_votes;
                                local_index = j;
                            }

                            else if (this_wins == local_wins && this_votes > local_votes) {
                                local_votes = this_votes;
                                local_index = j;
                            }

                            // if its sorted or wins are less then its gone, if wins are greater its updated, if wins are equal and votes are greater its updated, if wins are equal and votes are equal or less then it doesnt matter, results will show the list
                        }

                        // Now push this entry to the rank array
                        rank_arr.push(player_arr[local_index]);
                        player_arr[local_index].already_stored = true;

                        // no need for tie win update here
                    }

                    // Set wait to build anticipation, then tell them to reveal
                    setTimeout(() => {
                        io.emit("reveal final results", rank_arr); // rank_arr stores the rankings
                    }, timeoutThree); 
                }
                else {
                    nextQ(qIndex); // if not final results time, call the next question
                }
            }, timeoutTwo); 
        }
    });

    socket.on("vip reset the game", function() { // newupdate123

        resetGame();

    });
});



// Other functions

function selectPrompts() {

    for (let k = 0; k < number_prompts; k ++) {

        let index;
        let this_entry;
        let index_used = false; // assume this one isn't, change if it is

        do {
            index = Math.floor(Math.random() * number_all_prompts);
            this_entry = all_prompts[index];

            // Check if this_entry is already here
            index_used = false; // reset
            for (let h = 0; h < k; h ++) {
                if (this_entry == prompts[h]) {
                    index_used = true;
                    break;
                }
            }

        } while (index_used);

        // random and floor explanation:
        // random() returns a number with a lot of decimal points between [0,1)
        // so say random returns 0.7490204234723847 and there are 1000 all_prompts
        // -> index = floor(749.0204...) = 749, so the index will be 749
        // edge cases: random can return 0 -> index = 0, and it can return 0.99999... -> index = 999 (it cant return 1)

        // Now push all_prompts[index] to prompts
        prompts.push(this_entry);
    }

}

function nextQ(qIndex) {

    // First display the page
    io.emit("display question", qIndex);
    revealA(qIndex, 0); 

    // Now page is displayed, wait a bit, then start the vote
    setTimeout(() => {

        io.emit("start vote"); // this will display the necessary buttons page in client.js

    }, timeoutFour); 
}

function revealA(qIndex, pIndex) {
    // For this qIndex (question), sequentially send signals to display each player's answer

    // Base case, if true then start the vote 
    if (pIndex == player_count) return;

    // If not recurse inside timeout
    setTimeout(function() {

        console.log(player_arr[pIndex].name, "'s answer:", player_arr[pIndex].responses[qIndex]);

        io.emit("display answer", player_arr[pIndex].responses[qIndex]);

        revealA(qIndex, pIndex + 1);

    }, timeoutFive); 
}

function resetGame() {

    console.log("game restarted");

    // Right now, the players array is filled with previous game's players, all players statistics can be reset by going through them

    for (let i = 0; i < player_count; i ++) { // player_count only counts players in the game (not lobbylocked players)

        // variables to keep the same: is_vip, name (they can change if they want), socket_id, index

        player_arr[i].responses = [];
        player_arr[i].number_responses = 0;

        player_arr[i].local_votes = 0;
        player_arr[i].global_votes = 0;
        player_arr[i].global_wins = 0;

        player_arr[i].already_stored = false;

        // no need to send new indices, they will stay the same

    }

    // Now all players have been reset, player_arr stores non lobbylocked players and should not be reset
    // lobbylocked players are stored in a seperate array called locked_player_arr, append them to the player_arr list
    // they will have all the same characteristics as a real player, except that the player count doesn't include them
    
    for (let i = 0; i < locked_player_count; i ++) {

        const this_player = locked_player_arr[i];

        this_player.index += player_count; // this is the only thing thats different for a lobbylocked player
        player_arr.push(this_player);
        
        // send these players their new indices
        io.to(this_player.socket_id).emit("your index", this_player.index);
    }

    // Now locked data can be erased
    player_count += locked_player_count;
    locked_player_count = 0;
    locked_player_arr = [];

    // Now all global variables of server.js can be reset, dont reset: room_is_empty (it will set itself if needed), player_count, player_arr, and the timeouts
    names = [];
    lobby_locked = false;
    players_ready = 0;
    qIndex = 0;

    // Now select new prompts to update that list
    selectPrompts();

    // ok now server should be reset and signals will work so game can be reset, hope ftb
    

    io.emit("game reset");

    

}