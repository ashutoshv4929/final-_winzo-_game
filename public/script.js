document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const walletBalanceEl = document.getElementById('wallet-balance');
    const score1El = document.getElementById('score-1');
    const score2El = document.getElementById('score-2');
    const scoreBar1El = document.getElementById('score-bar-1');
    const scoreBar2El = document.getElementById('score-bar-2');
    const history1El = document.getElementById('history-1');
    const history2El = document.getElementById('history-2');
    const player1Panel = document.getElementById('player1-panel');
    const player2Panel = document.getElementById('player2-panel');
    const roundCounterEl = document.getElementById('round-counter');
    const diceCubeEl = document.getElementById('dice-cube');
    const turnIndicatorEl = document.getElementById('turn-indicator');
    const rollBtn = document.getElementById('roll-btn');
    const chatMessages = document.getElementById('chat-messages');

    // --- Modals & Popups ---
    const resultModal = document.getElementById('result-modal');
    const finalScore1El = document.getElementById('final-score-1');
    const finalScore2El = document.getElementById('final-score-2');
    const winnerTextEl = document.getElementById('winner-text');
    const prizeTextEl = document.getElementById('prize-text');
    const playAgainBtn = document.getElementById('play-again-btn');
    const watchAdBtn = document.getElementById('watch-ad-btn');
    const adModal = document.getElementById('ad-modal'); 
    const adTimerEl = document.getElementById('ad-timer');
    const winBonusPopup = document.getElementById('win-bonus-popup');

    // --- How-To-Play Modal (HTML से लिया गया) ---
    const howToPlayModal = document.getElementById('how-to-play-modal');
    const startGameBtn = document.getElementById('start-game-btn');


    // --- Game Constants ---
    const TOTAL_TURNS = 3;
    const MAX_SCORE = TOTAL_TURNS * 6;
    const WIN_AMOUNT = 10;
    const AD_BONUS = 5;
    const TIE_REWARD = 5; 

    let walletBalance = 85;

    // --- Colyseus Client Setup ---
    const client = new Colyseus.Client("ws://localhost:2567");
    let room;
    let myPlayerId;

    // --- Audio ---
    let audioContext;
    const audioBuffers = {};
    const bgMusic = new Audio('bg_music.mp3'); 
    bgMusic.loop = true; 
    bgMusic.volume = 0.4; 

    function initAudioOnce() {
        initAudio();
        // पहले उपयोगकर्ता इंटरैक्शन के बाद बैकग्राउंड म्यूजिक चलाएं
        if (bgMusic.paused) {
            bgMusic.play().catch(e => console.error("Background music autoplay failed:", e));
        }
        document.removeEventListener('click', initAudioOnce);
    }
    // ऑडियो कॉन्टेक्स्ट को इनिशियलाइज़ करने और म्यूजिक चलाने के लिए पहले उपयोगकर्ता इंटरैक्शन को सुनें
    document.addEventListener('click', initAudioOnce);

    function initAudio() {
        if (!audioContext) { // केवल एक बार इनिशियलाइज़ करें
            audioContext = new(window.AudioContext || window.webkitAudioContext)();
            loadSound('button_click.mp3');
            loadSound('dice_roll.mp3');
        }
    }

    async function loadSound(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            audioContext.decodeAudioData(arrayBuffer, (buffer) => {
                audioBuffers[url] = buffer;
            });
        } catch (e) {
            console.error(`Error loading sound ${url}:`, e);
        }
    }

    function playSound(url) {
        if (audioContext && audioBuffers[url]) {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffers[url];
            source.connect(audioContext.destination);
            source.start(0);
        }
    }

    // --- Colyseus Connection Function ---
    async function connectToColyseus() {
        try {
            room = await client.joinOrCreate("my_dice_room");
            console.log("Joined room successfully:", room.sessionId);
            appendChatMessage(`You (${room.sessionId}) joined the game.`);
            rollBtn.disabled = true;

            // --- STATE CHANGE LISTENER (Main UI Update Logic) ---
            room.onStateChange((state) => {
                console.log("Server state updated:", state);
                const myPlayerStateInRoom = state.players.get(room.sessionId);
                if (myPlayerStateInRoom) {
                    myPlayerId = myPlayerStateInRoom.playerNumber;
                    updatePlayerUI(myPlayerId);
                    if (!chatMessages.textContent.includes(`You are Player ${myPlayerId}!`)) {
                        appendChatMessage(`You are Player ${myPlayerId}!`);
                    }
                }
                
                // "Starting Pop" / Chat Messages
                if (state.players.size === 2 && !chatMessages.textContent.includes("Both players joined! Game Starting!")) {
                    appendChatMessage("Both players joined! Game Starting!");
                } else if (state.players.size < 2 && !chatMessages.textContent.includes("Waiting for players...")) {
                    appendChatMessage(`Waiting for players... (${state.players.size}/${room.maxClients})`);
                }
                
                // Update non-score UI elements immediately
                updateNonScoreUI(state); // Separate UI update for non-score elements
            });

            // --- PLAYER-SPECIFIC SCORE LISTENERS ---
            room.state.players.onAdd = (player, sessionId) => {
                // यह सुनिश्चित करता है कि जब कोई खिलाड़ी नया जुड़ता है तो उसके स्कोर पर लिसनर लगे
                player.listen("score", (currentScore) => {
                    // जब भी सर्वर पर किसी खिलाड़ी का स्कोर अपडेट होता है, तब यह कॉल होता है
                    console.log(`Player ${player.playerNumber} score updated to: ${currentScore}`);
                    updateScoreboard(player.playerNumber, currentScore);
                });

                // हिस्ट्री अपडेट के लिए भी लिसनर जोड़ें
                player.history.onAdd = (item, index) => {
                    updateDiceHistory(player.playerNumber, player.history);
                };
                player.history.onRemove = (item, index) => {
                    updateDiceHistory(player.playerNumber, player.history);
                };
                player.history.onChange = (changes) => {
                    updateDiceHistory(player.playerNumber, player.history);
                };
            };

            // --- MESSAGES FROM SERVER ---
            room.onMessage("dice_rolled", (message) => {
                console.log("Dice roll from server:", message);
                // केवल पासा एनीमेशन चलाएं, स्कोर अपडेट नहीं
                animateDiceRoll(message.roll, message.player).then(() => {
                    // एनीमेशन पूरा होने पर सर्वर को बताएं
                    if (room.sessionId === message.sessionId) { // Only send if it was MY roll
                        room.send("animation_completed", { roll: message.roll });
                    }
                });
            });

            room.onMessage("game_over", (message) => {
                console.log("Game Over message from server:", message);
                endGame(message.finalScores, message.winnerId);
            });

            room.onMessage("chat", (message) => {
                appendChatMessage(`${message.senderName}: ${message.text}`);
            });

            room.onLeave((code) => {
                console.log("Left room:", code);
                appendChatMessage("You left the game.");
                alert("Disconnected from server. Please refresh to rejoin.");
                rollBtn.disabled = true;
                rollBtn.textContent = 'Disconnected';
            });

            room.onError((code, message) => {
                console.error("Room error:", code, message);
                appendChatMessage(`Error: ${message}`);
                alert(`Server error: ${message}`);
            });

        } catch (e) {
            console.error("Error joining room:", e);
            appendChatMessage(`Error connecting to server: ${e.message}. Please ensure the server is running.`);
            alert("Could not connect to game server. Please ensure the server is running (npm start) and try again.");
            rollBtn.disabled = true;
            rollBtn.textContent = 'Server Offline';
        }
    }

    // --- Game Initialization (UPDATED) ---
    function initGame() {
        console.log("DEBUG: initGame function chalu hua!"); 
        loadWallet();
        resultModal.classList.add('hidden');
        prizeTextEl.classList.add('hidden');
        rollBtn.disabled = true;
        player1Panel.classList.add('active-player');
        player2Panel.classList.remove('active-player');
        chatMessages.innerHTML = '';
        score1El.textContent = 0; // Reset scores
        score2El.textContent = 0;
        scoreBar1El.style.width = `0%`; // Reset score bars
        scoreBar2El.style.width = `0%`;
        history1El.innerHTML = '<span>-</span><span>-</span><span>-</span>'; // Reset history
        history2El.innerHTML = '<span>-</span><span>-</span><span>-</span>';
        
        if (!localStorage.getItem('tutorialShown')) {
            howToPlayModal.classList.remove('hidden');
            startGameBtn.onclick = () => { 
                howToPlayModal.classList.add('hidden');
                playSound('button_click.mp3');
                localStorage.setItem('tutorialShown', 'yes'); 
                appendChatMessage("Connecting to game server...");
                connectToColyseus();
            };
        } else {
            howToPlayModal.classList.add('hidden'); 
            appendChatMessage("Connecting to game server...");
            connectToColyseus();
        }
    }

    function loadWallet() {
        const savedBalance = localStorage.getItem('diceBattleBalance');
        if (savedBalance) {
            walletBalance = parseInt(savedBalance, 10);
        }
        walletBalanceEl.textContent = walletBalance;
    }

    function updateWallet(amount) {
        walletBalance += amount;
        localStorage.setItem('diceBattleBalance', walletBalance);
        walletBalanceEl.textContent = walletBalance;
    }

    // --- Multiplayer Game Logic Functions ---
    function handleRoll() {
        if (!room || !myPlayerId) {
            console.error("Not connected to room or player ID not assigned.");
            appendChatMessage("Not connected to server. Please try again.");
            return;
        }
        if (room.state && room.state.currentPlayerId !== room.sessionId) {
            appendChatMessage("It's not your turn!");
            return;
        }
        playSound('button_click.mp3');
        rollBtn.disabled = true;
        appendChatMessage(`Player ${myPlayerId} is rolling...`);
        room.send("roll_dice");
    }

    // --- UI Update Functions ---
    function animateDiceRoll(roll, playerWhoRolled) {
        return new Promise(resolve => { // Make this function return a Promise
            diceCubeEl.classList.add('rolling');
            playSound('dice_roll.mp3');
            const randomX = (Math.floor(Math.random() * 6) + 4) * 360;
            const randomY = (Math.floor(Math.random() * 6) + 4) * 360;
            diceCubeEl.style.transform = `rotateX(${randomX}deg) rotateY(${randomY}deg)`;
            const rollingAnimationDuration = 1500; 
            const finalSnapTransitionDuration = 500; 
            setTimeout(() => {
                diceCubeEl.classList.remove('rolling');
                const rotations = {
                    1: 'rotateX(0deg) rotateY(0deg)',
                    2: 'rotateY(180deg) rotateX(0deg)',
                    3: 'rotateY(-90deg) rotateX(0deg)',
                    4: 'rotateY(90deg) rotateX(0deg)',
                    5: 'rotateX(90deg) rotateY(0deg)',
                    6: 'rotateX(-90deg) rotateY(0deg)'
                };
                diceCubeEl.style.transform = rotations[roll];
                
                // After the final snap transition, resolve the promise
                setTimeout(() => {
                    appendChatMessage(`Player ${playerWhoRolled} rolled a ${roll}!`);
                    resolve(); // Animation is visually complete, resolve the promise
                }, finalSnapTransitionDuration + 150); // Add a small buffer after final snap
            }, rollingAnimationDuration);
        });
    }

    // New function to update scores based on state listeners
    function updateScoreboard(playerNumber, score) {
        const scoreEl = document.getElementById(`score-${playerNumber}`);
        const scoreBarEl = document.getElementById(`score-bar-${playerNumber}`);

        if (scoreEl) {
            scoreEl.textContent = score;
        }
        if (scoreBarEl) {
            scoreBarEl.style.width = `${(score / (MAX_SCORE || 1)) * 100}%`;
        }
    }

    // New function to update dice history based on state listeners
    function updateDiceHistory(playerNumber, historyArray) {
        const historyEl = document.getElementById(`history-${playerNumber}`);
        if (historyEl) {
            historyEl.innerHTML = historyArray.map(r => `<span>${r}</span>`).join('') + '<span>-</span>'.repeat(TOTAL_TURNS - historyArray.length);
        }
    }

    // Modified updateUI to only handle non-score/history UI elements
    function updateNonScoreUI(state) {
        if (!state || !state.players) return;
        
        roundCounterEl.textContent = `Round ${state.currentRound === 0 ? 1 : state.currentRound} of ${TOTAL_TURNS}`;
        
        const currentPlayerSessionId = state.currentPlayerId;
        let currentActivePlayerNumber = 0;
        state.players.forEach((player) => {
            if (player.sessionId === currentPlayerSessionId) {
                currentActivePlayerNumber = player.playerNumber;
            }
        });
        turnIndicatorEl.textContent = `Player ${currentActivePlayerNumber}'s Turn`;
        rollBtn.textContent = `🎲 Player ${currentActivePlayerNumber} Roll`;
        player1Panel.classList.toggle('active-player', currentActivePlayerNumber === 1);
        player2Panel.classList.toggle('active-player', currentActivePlayerNumber === 2);
        
        rollBtn.disabled = !(myPlayerId && currentPlayerSessionId === room.sessionId && !state.gameOver);
        if (state.gameOver) {
            rollBtn.disabled = true;
            rollBtn.textContent = 'Game Over';
        }
    }

    function updatePlayerUI(playerNum) {
        if (playerNum === 1) {
            player1Panel.querySelector('h2').textContent = 'Player 1 (You)';
            player2Panel.querySelector('h2').textContent = 'Player 2';
        } else if (playerNum === 2) {
            player1Panel.querySelector('h2').textContent = 'Player 1';
            player2Panel.querySelector('h2').textContent = 'Player 2 (You)';
        }
    }

    function appendChatMessage(message) {
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message';
        msgEl.textContent = message;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function endGame(finalScores, winnerId) {
        console.log("DEBUG: endGame function chalu hua!"); 
        rollBtn.disabled = true;
        rollBtn.textContent = 'Game Over';
        // finalScores अब एक MapSchema नहीं बल्कि एक Object है क्योंकि सर्वर से Object.fromEntries का उपयोग किया गया है
        finalScore1El.textContent = finalScores["1"] || 0; 
        finalScore2El.textContent = finalScores["2"] || 0;
        prizeTextEl.classList.add('hidden'); 

        let winnerPlayerNumber = null;
        if (winnerId) {
            const playersMap = room.state.players;
            for (let [sessionId, playerState] of playersMap) {
                if (sessionId === winnerId) {
                    winnerPlayerNumber = playerState.playerNumber;
                    break;
                }
            }
        }

        const score1 = finalScores["1"] || 0;
        const score2 = finalScores["2"] || 0;

        if (winnerPlayerNumber === 1) {
            winnerTextEl.innerHTML = `🏆 Player 1 Wins!`;
            if (myPlayerId === 1) {
                prizeTextEl.classList.remove('hidden');
                prizeTextEl.textContent = `आपको ₹${WIN_AMOUNT} मिले!`;
                updateWallet(WIN_AMOUNT);
                showWinBonus();
            }
        } else if (winnerPlayerNumber === 2) {
            winnerTextEl.textContent = 'Player 2 Wins!';
            if (myPlayerId === 2) {
                prizeTextEl.classList.remove('hidden');
                prizeTextEl.textContent = `आपको ₹${WIN_AMOUNT} मिले!`;
                updateWallet(WIN_AMOUNT);
                showWinBonus();
            }
        } else {
            winnerTextEl.textContent = '🤝 It\'s a Tie!';
            // टाई रिवॉर्ड लॉजिक
            prizeTextEl.textContent = `दोनों खिलाड़ियों को ₹${TIE_REWARD} मिले!`;
            prizeTextEl.classList.remove('hidden');
            if (myPlayerId === 1 || myPlayerId === 2) { 
                 updateWallet(TIE_REWARD);
                 showWinBonus(); 
            }
        }
        setTimeout(() => resultModal.classList.remove('hidden'), 500);
    }

    function showWinBonus() {
        if (winBonusPopup) { 
            winBonusPopup.classList.remove('hidden');
            setTimeout(() => {
                winBonusPopup.classList.add('hidden');
            }, 3000);
        } else {
            console.warn("Win bonus popup element not found.");
        }
    }

    function handleWatchAd() {
        resultModal.classList.add('hidden');
        if (adModal) { 
            adModal.classList.remove('hidden');
            let timeLeft = 10;
            if (adTimerEl) adTimerEl.textContent = timeLeft; 
            const adInterval = setInterval(() => {
                timeLeft--;
                if (adTimerEl) adTimerEl.textContent = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(adInterval);
                    adModal.classList.add('hidden');
                    updateWallet(AD_BONUS);
                }
            }, 1000);
        } else {
            console.warn("Ad modal element not found.");
            updateWallet(AD_BONUS);
        }
    }

    // --- Event Listeners ---
    rollBtn.addEventListener('click', () => {
        if (!audioContext || audioContext.state === 'suspended') {
            initAudio(); 
            if (audioContext.state === 'suspended') {
                 audioContext.resume().then(() => handleRoll());
            } else {
                 handleRoll();
            }
        } else {
            handleRoll();
        }
    });

    playAgainBtn.addEventListener('click', () => {
        if (!audioContext) initAudio();
        playSound('button_click.mp3');
        if (room) {
            room.send("reset_game");
            resultModal.classList.add('hidden');
            appendChatMessage("New game requested. Waiting for server to reset...");
        } else {
            initGame(); 
        }
    });

    watchAdBtn.addEventListener('click', () => {
        if (!audioContext) initAudio();
        playSound('button_click.mp3');
        handleWatchAd();
    });
    
    // --- Initial Game Setup ---
    initGame();
});