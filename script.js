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
    const allGoodBtn = document.getElementById('all-good-btn');
    const chatMessages = document.getElementById('chat-messages');

    // Modals & Popups
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

    // --- Game State ---
    const TOTAL_TURNS = 3;
    const MAX_SCORE = TOTAL_TURNS * 6;
    const WIN_AMOUNT = 10;
    const AD_BONUS = 5;

    let walletBalance = 85;
    let scores = { 1: 0, 2: 0 };
    let history = { 1: [], 2: [] };
    let currentPlayer = 1;
    let turns = 0;
    let gameActive = true;

    // --- Audio ---
    let audioContext;
    const audioBuffers = {};

    function initAudioOnce() {
        initAudio();
        document.removeEventListener('click', initAudioOnce);
    }

    document.addEventListener('click', initAudioOnce);

    function initAudio() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        loadSound('button_click.mp3');
        loadSound('dice_roll.mp3');
    }

    async function loadSound(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            audioContext.decodeAudioData(arrayBuffer, (buffer) => {
                audioBuffers[url] = buffer;
            });
        } catch(e) {
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

    function initGame() {
        scores = { 1: 0, 2: 0 };
        history = { 1: [], 2: [] };
        currentPlayer = 1;
        turns = 0;
        gameActive = true;

        loadWallet();
        updateUI();
        resultModal.classList.add('hidden');
        prizeTextEl.classList.add('hidden');
        rollBtn.disabled = false;
        player1Panel.classList.add('active-player');
        player2Panel.classList.remove('active-player');
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

    function handleRoll() {
        if (!gameActive) return;
        playSound('button_click.mp3');

        gameActive = false;
        rollBtn.disabled = true;
        chatMessages.innerHTML = '';

        diceCubeEl.classList.add('rolling');
        playSound('dice_roll.mp3');

        const randomX = (Math.floor(Math.random() * 6) + 4) * 360;
        const randomY = (Math.floor(Math.random() * 6) + 4) * 360;
        diceCubeEl.style.transform = `rotateX(${randomX}deg) rotateY(${randomY}deg)`;

        setTimeout(() => {
            diceCubeEl.classList.remove('rolling');
            const roll = Math.ceil(Math.random() * 6);

            const rotations = {
                1: 'rotateX(0deg) rotateY(0deg)',
                2: 'rotateY(180deg) rotateX(0deg)',
                3: 'rotateY(-90deg) rotateX(0deg)',
                4: 'rotateY(90deg) rotateX(0deg)',
                5: 'rotateX(90deg) rotateY(0deg)',
                6: 'rotateX(-90deg) rotateY(0deg)'
            };
            diceCubeEl.style.transform = rotations[roll];

            setTimeout(() => {
                scores[currentPlayer] += roll;
                history[currentPlayer].push(roll);

                if (currentPlayer === 1) {
                    turns++;
                }

                updateUI();

                const nextPlayer = currentPlayer === 1 ? 2 : 1;
                const message = document.createElement('div');
                message.className = `chat-message`;
                message.textContent = `Please wait for Player ${nextPlayer}`;
                chatMessages.appendChild(message);
                chatMessages.scrollTop = chatMessages.scrollHeight;

                setTimeout(() => {
                    switchPlayer();
                    gameActive = true;
                    rollBtn.disabled = false;
                    updateUI();
                }, 1000);

                if (history[1].length === TOTAL_TURNS && history[2].length === TOTAL_TURNS) {
                    endGame();
                }
            }, 1500);
        }, 1500);
    }

    function switchPlayer() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        updatePlayerUI();
    }

    function updateUI() {
        score1El.textContent = scores[1];
        score2El.textContent = scores[2];
        scoreBar1El.style.width = `${(scores[1] / MAX_SCORE) * 100}%`;
        scoreBar2El.style.width = `${(scores[2] / MAX_SCORE) * 100}%`;

        history1El.innerHTML = history[1].map(r => `<span>${r}</span>`).join('') + '<span>-</span>'.repeat(TOTAL_TURNS - history[1].length);
        history2El.innerHTML = history[2].map(r => `<span>${r}</span>`).join('') + '<span>-</span>'.repeat(TOTAL_TURNS - history[2].length);

        updatePlayerUI();

        if (turns <= TOTAL_TURNS) {
            roundCounterEl.textContent = `Round ${turns === 0 ? 1 : turns} of ${TOTAL_TURNS}`;
        }
    }

    function updatePlayerUI() {
        turnIndicatorEl.textContent = `Player ${currentPlayer}'s Turn`;
        rollBtn.textContent = `🎲 Player ${currentPlayer} Roll`;
        if(currentPlayer === 1) {
            player1Panel.classList.add('active-player');
            player2Panel.classList.remove('active-player');
        } else {
            player1Panel.classList.remove('active-player');
            player2Panel.classList.add('active-player');
        }
    }

    function endGame() {
        gameActive = false;
        rollBtn.disabled = true;
        rollBtn.textContent = 'Game Over';

        finalScore1El.textContent = scores[1];
        finalScore2El.textContent = scores[2];
        prizeTextEl.classList.add('hidden');

        if (scores[1] > scores[2]) {
            winnerTextEl.innerHTML = `🏆 Player 1 Wins!`;
            prizeTextEl.classList.remove('hidden');
            updateWallet(WIN_AMOUNT);
            showWinBonus();
        } else if (scores[2] > scores[1]) {
            winnerTextEl.textContent = 'Player 2 Wins!';
        } else {
            winnerTextEl.textContent = '🤝 It\'s a Tie!';
        }

        setTimeout(() => resultModal.classList.remove('hidden'), 500);
    }

    function showWinBonus() {
        winBonusPopup.classList.remove('hidden');
        setTimeout(() => {
            winBonusPopup.classList.add('hidden');
        }, 3000);
    }

    function handleWatchAd() {
        resultModal.classList.add('hidden');
        adModal.classList.remove('hidden');
        let timeLeft = 10;
        adTimerEl.textContent = timeLeft;
        const adInterval = setInterval(() => {
            timeLeft--;
            adTimerEl.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(adInterval);
                adModal.classList.add('hidden');
                updateWallet(AD_BONUS);
                initGame();
            }
        }, 1000);
    }

    // --- Event Listeners ---
    rollBtn.addEventListener('click', () => {
        if (!audioContext) {
            initAudio();
            setTimeout(handleRoll, 200);
        } else {
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => handleRoll());
            } else {
                handleRoll();
            }
        }
    });

    playAgainBtn.addEventListener('click', () => {
        if (!audioContext) initAudio();
        playSound('button_click.mp3');
        initGame();
    });

    watchAdBtn.addEventListener('click', () => {
        if (!audioContext) initAudio();
        playSound('button_click.mp3');
        handleWatchAd();
    });

    initGame();
});
