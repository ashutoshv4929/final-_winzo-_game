// ✅ Feature 1: Tie reward of ₹5 to both players
// ✅ Feature 2: Background music added
// ✅ Feature 3: Show tutorial popup on first game only

document.addEventListener('DOMContentLoaded', () => {
    const TIE_REWARD = 5;
    const bgMusic = new Audio('bg_music.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.4;

    const tutorialPopup = document.createElement('div');
    tutorialPopup.id = 'tutorial-popup';
    tutorialPopup.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <h2>कैसे खेलें</h2>
                <p>दो खिलाड़ी बारी-बारी से पासा फेंकते हैं। 3 राउंड के बाद जिसका स्कोर ज़्यादा होगा, वह जीतेगा।</p>
                <p>जीतने पर ₹10 मिलते हैं, और टाई पर दोनों को ₹5 मिलते हैं।</p>
                <button id="close-tutorial">शुरू करें</button>
            </div>
        </div>`;
    document.body.appendChild(tutorialPopup);

    document.getElementById('close-tutorial').addEventListener('click', () => {
        tutorialPopup.remove();
        localStorage.setItem('tutorialShown', 'yes');
    });

    if (!localStorage.getItem('tutorialShown')) {
        tutorialPopup.style.display = 'block';
    }

    if (bgMusic.paused) {
        bgMusic.play().catch(() => {
            document.body.addEventListener('click', () => bgMusic.play(), { once: true });
        });
    }

    // --- Update endGame function to reward ₹5 to both players on tie ---
    const originalEndGame = window.endGame;
    window.endGame = function() {
        originalEndGame();

        const score1 = parseInt(document.getElementById('final-score-1').textContent);
        const score2 = parseInt(document.getElementById('final-score-2').textContent);
        const prizeTextEl = document.getElementById('prize-text');

        if (score1 === score2) {
            prizeTextEl.textContent = 'दोनों खिलाड़ियों को ₹5 मिले!';
            prizeTextEl.classList.remove('hidden');
            updateWallet(TIE_REWARD); // Player 1
            setTimeout(() => updateWallet(TIE_REWARD), 100); // Player 2
        }
    }
});