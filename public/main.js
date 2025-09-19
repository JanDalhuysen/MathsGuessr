document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    const playerName = localStorage.getItem('playerName');

    if (!roomId || !playerName) {
        window.location.href = '/';
        return;
    }

    const socket = io();
    const gameContainer = document.getElementById('game-container');
    const gameType = document.body.dataset.gameType;
    const questionDisplay = document.getElementById('question-display');
    const leaderboard = document.getElementById('leaderboard');
    let hasGuessed = false;

    // Metrics variables
    let questionsAnswered = 0;
    let totalTime = 0;
    let totalErrorDistance = 0;
    let startTime = 0;
    let userGuess = null;

    // Canvas setup for non-trivia games
    let canvas, ctx;
    if (gameType === 'number-line' || gameType === 'cartesian-plane') {
        canvas = document.getElementById(gameType === 'number-line' ? 'number-line-canvas' : 'cartesian-plane-canvas');
        ctx = canvas.getContext('2d');
    }

    // Trivia setup
    let triviaQuestion, triviaAnswers;
    if (gameType === 'trivia') {
        triviaQuestion = document.getElementById('trivia-question');
        triviaAnswers = document.getElementById('trivia-answers');
    }

    const drawFunctions = {
        'number-line': drawNumberLine,
        'cartesian-plane': drawCartesianPlane
    };

    function redrawCanvas() {
        if (drawFunctions[gameType]) {
            drawFunctions[gameType](canvas, ctx);
        }
    }

    // --- Socket Event Handlers ---
    socket.on('connect', () => {
        socket.emit('joinRoom', { roomId, playerName });
    });

    socket.on('newQuestion', (question) => {
        hasGuessed = false;
        startTime = performance.now();
        userGuess = null;
        if (gameType === 'trivia') {
            triviaQuestion.textContent = question.text;
            for (let i = 0; i < 4; i++) {
                const answerBox = document.getElementById(`answer-${i}`);
                answerBox.textContent = question.answers[i];
                answerBox.classList.remove('correct', 'incorrect');
            }
        } else {
            questionDisplay.textContent = question.text;
            redrawCanvas();
        }
    });

    socket.on('updateLeaderboard', (players) => {
        leaderboard.innerHTML = '';
        const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
        sortedPlayers.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.name}: ${player.score}`;
            leaderboard.appendChild(li);
        });
    });

    socket.on('guessResult', ({ score, correctAnswer, correctIndex }) => {
        const elapsedTime = performance.now() - startTime;
        questionsAnswered++;
        totalTime += elapsedTime;

        if (gameType === 'number-line') {
            const distance = Math.abs(correctAnswer - userGuess.x);
            totalErrorDistance += distance;
        } else if (gameType === 'cartesian-plane') {
            const distance = Math.sqrt(Math.pow(correctAnswer.x - userGuess.x, 2) + Math.pow(correctAnswer.y - userGuess.y, 2));
            totalErrorDistance += distance;
        }

        updateMetricsPanel();

        if (gameType === 'trivia') {
            const answerBox = document.getElementById(`answer-${correctIndex}`);
            answerBox.classList.add('correct');
        } else {
            redrawCanvas();
            const { x, y } = drawPoint(correctAnswer, '#98c379', 'Answer');
            showScorePopup(score, x, y);
        }
    });

    // --- UI Event Handlers ---
    if (gameType === 'number-line' || gameType === 'cartesian-plane') {
        canvas.addEventListener('click', (e) => {
            if (hasGuessed) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            let guess;
            if (gameType === 'number-line') {
                const range = 20, padding = 40;
                const unitWidth = (canvas.width - padding * 2) / range;
                guess = { x: (x - padding) / unitWidth - 10 };
            } else {
                const originX = canvas.width / 2, originY = canvas.height / 2, scale = 40;
                guess = { x: (x - originX) / scale, y: -(y - originY) / scale };
            }
            userGuess = guess;
            socket.emit('submitGuess', { roomId, guess });
            hasGuessed = true;
        });
    } else if (gameType === 'trivia') {
        triviaAnswers.addEventListener('click', (e) => {
            if (hasGuessed) return;

            const rect = triviaAnswers.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            const guess = { x, y };
            userGuess = guess;
            socket.emit('submitGuess', { roomId, guess });
            hasGuessed = true;

            showScorePopup(null, e.clientX, e.clientY);
        });
    }

    window.addEventListener('resize', redrawCanvas);

    // --- Drawing & Animation Functions ---
    function showScorePopup(score, x, y) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = score ? `+${score}` : '';
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
        gameContainer.appendChild(popup);

        setTimeout(() => {
            popup.remove();
        }, 1500);
    }

    function updateMetricsPanel() {
        const questionsAnsweredEl = document.getElementById('questions-answered');
        const avgTimeEl = document.getElementById('avg-time');
        const avgDistanceEl = document.getElementById('avg-distance');

        questionsAnsweredEl.textContent = questionsAnswered;

        if (questionsAnswered > 0) {
            const avgTime = (totalTime / questionsAnswered / 1000).toFixed(2);
            avgTimeEl.textContent = `${avgTime}s`;

            if (gameType !== 'trivia') {
                const avgDistance = (totalErrorDistance / questionsAnswered).toFixed(2);
                avgDistanceEl.textContent = avgDistance;
            } else {
                avgDistanceEl.textContent = 'N/A';
            }
        } else {
            avgTimeEl.textContent = '0s';
            avgDistanceEl.textContent = gameType === 'trivia' ? 'N/A' : '0';
        }
    }


    function drawPoint(point, color, label) {
        let canvasX, canvasY;
        if (gameType === 'number-line') {
            const range = 20, padding = 40;
            const unitWidth = (canvas.width - padding * 2) / range;
            canvasX = (point.x + 10) * unitWidth + padding;
            canvasY = canvas.height / 2;
        } else {
            const originX = canvas.width / 2, originY = canvas.height / 2, scale = 40;
            canvasX = originX + point.x * scale;
            canvasY = originY - point.y * scale;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillText(label, canvasX + 10, canvasY - 10);
        return { x: canvasX, y: canvasY }; // Return canvas coordinates for popup
    }

    if (gameType !== 'trivia') {
        redrawCanvas();
    }
});

function drawCartesianPlane(canvas, ctx) {
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    const originX = Math.floor(width / 2) + 0.5;
    const originY = Math.floor(height / 2) + 0.5;
    const scale = 40;

    ctx.strokeStyle = '#4b5263';
    ctx.fillStyle = '#abb2bf';
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';

    // Draw grid lines
    for (let x = originX % scale; x < width; x += scale) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = originY % scale; y < height; y += scale) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#61afef';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Draw numbers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = -Math.floor(originX / scale); i <= Math.floor((width - originX) / scale); i++) {
        if (i === 0) continue;
        ctx.fillText(i, originX + i * scale, originY + 5);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = -Math.floor(originY / scale); i <= Math.floor((height - originY) / scale); i++) {
        if (i === 0) continue;
        ctx.fillText(-i, originX - 5, originY + i * scale);
    }
}

function drawNumberLine(canvas, ctx) {
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width, canvas.height = height;
    const centerY = height / 2, padding = 40, range = 20;
    const unitWidth = (width - padding * 2) / range;
    ctx.strokeStyle = '#61afef', ctx.fillStyle = '#abb2bf', ctx.lineWidth = 2, ctx.font = '14px sans-serif';
    ctx.beginPath(); ctx.moveTo(padding, centerY); ctx.lineTo(width - padding, centerY); ctx.stroke();
    ctx.textAlign = 'center', ctx.textBaseline = 'top';
    for (let i = 0; i <= range; i++) {
        const x = padding + i * unitWidth, num = i - 10;
        ctx.beginPath(); ctx.moveTo(x, centerY - 10); ctx.lineTo(x, centerY + 10); ctx.stroke();
        if (num % 2 === 0) { ctx.fillText(num, x, centerY + 15); }
    }
}
