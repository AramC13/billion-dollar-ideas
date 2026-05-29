// nothing here ever needs to be edited, all needed info is imported from server.js

const socket = io();

const container = document.getElementById("container");



// Lobby characteristics
let curr_state = 0;
let lobby_locked = false; // this is used to track when nothing in the socket should be edited (either lobby is locked or game is over)
let names = [];
let qIndex = 0;

// This socket's charactersitics
let is_first = false;
let this_index;

// Get the following from server.js, through an event listener
let number_prompts;
let prompts = [];
let player_count;



// Render function: load/reload page

function render() {
    container.innerHTML = ""; // clear old UI

    if (curr_state == -1) lobbyLocked();
    else if (curr_state == 0) nameSelect();
    else if (curr_state == 1) waitRoom();
    else if (curr_state == 2) instructionPage();
    else if (curr_state == 3) promptPage();
    else if (curr_state == 4 || curr_state == 5) waitPage();
    else if (curr_state == 6) reveal();
    else if (curr_state == 7) results();
    else if (curr_state == 8) finalResults();
    else if (curr_state == 9) revealFinalResults();

}



// Each of following function represents a page, the variables in front are for that function

function nameSelect() {

    // Construct page

    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = "Choose your name";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Enter name";

    const nameButton = document.createElement("button");
    nameButton.textContent = "Submit";

    container.appendChild(headerDiv);
    container.appendChild(nameInput);
    nameInput.focus();
    container.appendChild(document.createElement("br"));
    container.appendChild(nameButton);

    // Add interactive portion

    nameButton.addEventListener("click", function() {
        socket.emit("name chosen", nameInput.value);

        curr_state = 1; // update to wait room state
        render();
    });

    nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            nameButton.click();
        }
    }); // this will often be seen in this doc, it just means enter key activates the button

}

function waitRoom() {
    
    // Construct page
    
    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = "Waiting room ...";

    const namesExp = document.createElement("div");
    namesExp.className = "small-text";
    namesExp.textContent = "The following people are here: ";

    container.appendChild(headerDiv);
    container.appendChild(document.createElement("br"));
    container.appendChild(document.createElement("br"));
    container.appendChild(namesExp);
    container.appendChild(document.createElement("br"));
    container.appendChild(document.createElement("br"));

    const names_length = names.length;
    for (let nameIndex = 0; nameIndex < names_length; nameIndex ++) {

        const nameDiv = document.createElement("div");
        nameDiv.className = "med-text";
        nameDiv.textContent = names[nameIndex];

        container.appendChild(nameDiv);
        container.appendChild(document.createElement("br"));
    }

    if (is_first) {
        const startButton = document.createElement("button");
        startButton.textContent = "Start game";

        container.appendChild(document.createElement("br"));
        container.appendChild(startButton);

        // Add interactive portion for VIP

        startButton.addEventListener("click", function() {
            socket.emit("goto instructions");
        });
    }
}

function instructionPage() {

    // Construct page

    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = "How to play";

    const mainText = document.createElement("div");
    mainText.className = "small-text";
    mainText.textContent = "A series of problems (prompts) are presented, you must come up with a billion dollar idea to solve each problem. Solutions are compared with one another, and players vote on which solution they would support most. At the end of the game, the player with the most solution wins will win the game. Note that a win is awarded to a solution with the most votes."

    const readyButton = document.createElement("button");
    readyButton.textContent = "Ready";

    container.appendChild(headerDiv);
    container.appendChild(document.createElement("br"));
    container.appendChild(mainText);
    container.appendChild(document.createElement("br"));
    container.appendChild(document.createElement("br"));
    container.appendChild(readyButton);

    // Add interactive part -> send ready signal to server

    readyButton.addEventListener("click", function() {
        socket.emit("ready");

        readyButton.remove();
    });
}

function promptPage() { 

    // Construct page

    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = `Prompt #${qIndex + 1}`;

    const promptDiv = document.createElement("div");
    promptDiv.className = "med-text";
    promptDiv.textContent = prompts[qIndex];

    container.appendChild(headerDiv);
    container.appendChild(document.createElement("br"));
    container.appendChild(promptDiv);
    container.appendChild(document.createElement("br"));

}

function waitPage() {
    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    
    if (curr_state == 4) headerDiv.textContent = "Waiting for responses ...";
    else if (curr_state == 5) headerDiv.textContent = "Now for the results ...";

    container.appendChild(headerDiv);
}

let curr_answers = []; // will be filled with answers to be made into buttons (filled when the answers come in)
let voting = false; // tracks when to enter voting state in reveal()
function reveal() {

    // The tunnel listeners for display question and display answer construct this page

    // If the voting stage is entered, the page must be reconstructed with buttons

    if (voting) {

        // Construct page

        const headerDiv = document.createElement("div");
        headerDiv.className = "main-header";
        headerDiv.textContent = "Time to vote!"
        // headerDiv.textContent = `Prompt #${qIndex + 1}`;

        const questionDiv = document.createElement("div");
        questionDiv.className = "small-text";
        questionDiv.textContent = prompts[qIndex];

        container.appendChild(headerDiv);
        container.appendChild(document.createElement("br"));
        container.appendChild(questionDiv);
        container.appendChild(document.createElement("br"));

        for (let pIndex = 0; pIndex < player_count; pIndex ++) {

            if (this_index == pIndex) continue; // cant vote for urself

            const answerButton = document.createElement("button");
            answerButton.textContent = curr_answers[pIndex];

            container.appendChild(document.createElement("br"));
            container.appendChild(answerButton);
            container.appendChild(document.createElement("br"));

            // Interactive part

            answerButton.addEventListener("click", function() {
    
                // Now go back to waiting for responses page
                curr_state = 4;
                curr_answers = []; // UPDATE
                voting = false;
                render(); // will not reset anything, it will only erase the UI and enter the current state function

                // Also send signal that this player has voted
                socket.emit("player voted", pIndex);

            });

        }

    }
}

let curr_rank = []; // array of players in order of rank
function results() { // THIS FUNCTION DOESNT USE CURR_ANSWERS, IT TAKES ANSWERS FROM THE PLAYER RANK ARRAY DIRECTLY
    
    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = `Prompt #${qIndex + 1} Results`;

    const promptDiv = document.createElement("div");
    promptDiv.className = "small-text";
    promptDiv.textContent = prompts[qIndex];

    container.appendChild(headerDiv);
    container.appendChild(document.createElement("br"));
    container.appendChild(promptDiv);
    container.appendChild(document.createElement("br"));

    // To create the actual ranking display, take from curr_rank in a loop, access only name, local votes, and answers
    for (let i = 0; i < player_count; i ++) {

        const rankDiv = document.createElement("div");
        rankDiv.className = "med-text";
        rankDiv.textContent = `#${i + 1}: ${curr_rank[i].name} with ${curr_rank[i].local_votes} votes`;

        const newDiv = document.createElement("div");
        newDiv.className = "small-text";
        newDiv.textContent = `Their answer: ${curr_rank[i].responses[qIndex]}`;

        container.appendChild(document.createElement("br"));
        container.appendChild(rankDiv);
        container.appendChild(document.createElement("br"));
        container.appendChild(newDiv);
        container.appendChild(document.createElement("br"));
    }

    // Now reset array for next results phase
    curr_rank = [];

}

function finalResults() {
    
    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = "Calculating final results ...";

    container.appendChild(headerDiv);

}

function revealFinalResults() {

    // curr_rank can be reused because it was reset in the goto final results event listener

    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = "Final Results";

    container.appendChild(headerDiv);

    // Show the top player in larger text
    const firstplaceDiv = document.createElement("div");
    firstplaceDiv.className = "med-text";
    firstplaceDiv.style.backgroundColor = "#420080";
    firstplaceDiv.textContent = `#1. ${curr_rank[0].name} with ${curr_rank[0].global_wins} wins and ${curr_rank[0].global_votes} votes`;

    container.appendChild(document.createElement("br"));
    container.appendChild(document.createElement("br"));
    container.appendChild(firstplaceDiv);
    container.appendChild(document.createElement("br"));

    // To create the actual ranking display, take from curr_rank in a loop, access only name, local votes, and answers
    for (let i = 1; i < player_count; i ++) {

        const player = curr_rank[i];

        const nextDiv = document.createElement("div");
        nextDiv.className = "small-text";
        nextDiv.textContent = `#${i + 1}. ${player.name} with ${player.global_wins} wins and ${player.global_votes} votes`;

        container.appendChild(nextDiv);
        container.appendChild(document.createElement("br"));
    }

    // Now reset array for no reason
    curr_rank = [];

    // And thank them for playing
    const thankyouDiv = document.createElement("div");
    thankyouDiv.className = "small-text";
    thankyouDiv.textContent = "Thanks for playing!";

    container.appendChild(document.createElement("br"));
    container.appendChild(thankyouDiv);
    container.appendChild(document.createElement("br"));

    if (is_first) { //newupdate123

        const restartButton = document.createElement("button");
        restartButton.textContent = "New game";

        container.appendChild(document.createElement("br"));
        container.appendChild(restartButton);

        restartButton.addEventListener("click", function() {

            socket.emit("vip reset the game");

        });

    }
}

function lobbyLocked() {

    // Build page

    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = "Game has started";

    const expDiv = document.createElement("div");
    expDiv.className = "small-text";
    expDiv.textContent = "Please wait for next round to start.";

    container.appendChild(headerDiv);
    container.appendChild(document.createElement("br"));
    container.appendChild(expDiv);

}

function resetGame() { //newupdate123

    // Reset all variables
    curr_state = 0;
    lobby_locked = false;
    names = [];
    qIndex = 0;

    is_first = false; // DOUBLE CHECK
    // dont reset this_index, that is updated by server.js

    number_prompts = 0;
    prompts = [];
    player_count = 0;

    curr_answers = [];
    voting = false;
    curr_rank = [];

    render();

}



// Global .on event listeners (server.js can send these at random times, to avoid collisions, make them global)

socket.on("are you first", function(are_they_first) { // are_they_first is their vip status passed by server.js

    if (lobby_locked) return;

    console.log("vip status:", are_they_first);
    
    is_first = are_they_first;

    render(); // refreshes the page, whatever state we are currently in will update with the new vip info (if it's waitroom the start button should appear)
});

socket.on("new name", function(names_list) {

    if (lobby_locked) return;

    names = names_list;

    render();
});

socket.on("your index", function(i) {
    this_index = i;
    console.log("my index:", this_index);
});

socket.on("goto instructions", function(server_prompts, server_number_prompts, server_player_count) {
    if (lobby_locked) return; // do this for all socket event listeners, it shouldn't respond if the lobby is locked

    // Update game specific info
    prompts = server_prompts;
    number_prompts = server_number_prompts;
    player_count = server_player_count;

    curr_state = 2;
    render();
});

socket.on("start game", function() {
    if (lobby_locked) return;
    curr_state = 3;
    render();
});

socket.on("interaction available", function() {

    // build onto the current page with an input and button 

    const responseInput = document.createElement("input");
    responseInput.type = "text";
    responseInput.placeholder = "Enter solution";

    const responseButton = document.createElement("button");
    responseButton.textContent = "Submit answer";

    container.appendChild(responseInput);
    responseInput.focus();
    container.appendChild(document.createElement("br"));
    container.appendChild(responseButton);

    responseButton.addEventListener("click", function() {
        socket.emit("question answer", responseInput.value); // send the answer to hive, it will store the answers sequentially

        qIndex ++; // set up for next question
        
        if (qIndex == number_prompts) {
            curr_state = 4;
            //qIndex = 0; // reset to use in results
        }
        
        render();
    });

    responseInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            responseButton.click();
        }
    });

    // Do not render, we merely build on what is already on the page
});

socket.on("wait for reveal", function() {
    if (lobby_locked) return;
    curr_state = 5;
    render();
});

socket.on("goto reveal", function() {
    if (lobby_locked) return;
    curr_state = 6;
    render();
});

socket.on("display question", function(qindex) {

    if (lobby_locked) return;

    curr_state = 6; // reset from wtv
    render();
    
    const headerDiv = document.createElement("div");
    headerDiv.className = "main-header";
    headerDiv.textContent = `Prompt #${qindex + 1}`;

    const questionDiv = document.createElement("div");
    questionDiv.className = "small-text";
    questionDiv.textContent = prompts[qindex];

    container.appendChild(headerDiv);
    container.appendChild(document.createElement("br"));
    container.appendChild(questionDiv);
    container.appendChild(document.createElement("br"));

    qIndex = qindex; // the same global variable is used here and for the prompts page, reset it at each new question display (this is used for both )

    // qindex is incremented in server.js, there is a loop when the vote is ended in client, signal sent to server, q is incremented and next question is claled with qIndex ++;
});

socket.on("display answer", function(text) {

    if (lobby_locked) return;
    
    const answerDiv = document.createElement("div");
    answerDiv.className = "med-text";
    answerDiv.textContent = text;

    container.appendChild(document.createElement("br"));
    container.appendChild(answerDiv);
    container.appendChild(document.createElement("br"));

    // NOTE: render() cant be called for event listeners that build the page (this and display question)

    curr_answers.push(text); // this is used to make a 
});

socket.on("start vote", function() {
    if (lobby_locked) return;

    voting = true;
    render(); // enter voting state where all four questions are buttons
});

socket.on("goto results", function(rank_arr) {

    if (lobby_locked) return;

    curr_rank = rank_arr;

    curr_state = 7;
    render();

});

socket.on("goto final results", function() {

    if (lobby_locked) return;

    curr_state = 8;
    render();

});

socket.on("reveal final results", function(rank_arr) {

    if (lobby_locked) return;

    curr_rank = rank_arr;

    lobby_locked = true; // the page should now only go into the final function and ignore all signals except a GAME RESTART
    curr_state = 9;
    render();

});

socket.on("lobby is locked", () => {
    lobby_locked = true;
    curr_state = -1;
    render();
});

socket.on("game reset", function() { //newupdate123

    // don't check for lobby locked on this one bc this should apply for clients with lobby locked as well

    resetGame();

});


// Finally, load page
render();