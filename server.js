const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');
const axios = require('axios');
const he = require('he');

// Initialize logging
const LOG_FILE = 'game_metrics.json';
const metrics = {
    games: [],
    players: {}
};

// Load existing metrics if file exists
if (fs.existsSync(LOG_FILE)) {
    try {
        const data = fs.readFileSync(LOG_FILE, 'utf8');
        const loadedMetrics = JSON.parse(data);
        Object.assign(metrics, loadedMetrics);
    } catch (error) {
        console.error('Error loading metrics file:', error);
    }
}

// Save metrics to file
function saveMetrics() {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify(metrics, null, 2));
    } catch (error) {
        console.error('Error saving metrics:', error);
    }
}

// Ensure we save metrics on exit
process.on('SIGINT', () => {
    saveMetrics();
    process.exit();
});
process.on('SIGTERM', () => {
    saveMetrics();
    process.exit();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const ROOM_DELETION_TIMEOUT = 5000; // 5 seconds

function getSanitizedRooms() {
    const roomInfo = {};
    for (const id in rooms) {
        if (!rooms[id].isPendingDeletion) {
            roomInfo[id] = { 
                gameType: rooms[id].gameType, 
                playerCount: Object.keys(rooms[id].players).length 
            };
        }
    }
    return roomInfo;
}

app.get('/', (req, res) => res.render('index'));
app.get('/lobby', (req, res) => res.render('lobby'));
app.get('/game', (req, res) => {
    const roomId = req.query.room;
    if (rooms[roomId]) {
        res.render('game', { type: rooms[roomId].gameType, room: roomId });
    } else {
        res.redirect('/lobby');
    }
});

async function generateQuestion(type) {
    if (type === 'number-line') {
        const a = Math.floor(Math.random() * 11) - 5;
        const b = Math.floor(Math.random() * 11) - 5;
        return { text: `What is ${a} + ${b}?`, answer: a + b };
    } else if (type === 'cartesian-plane') {
        const x = Math.floor(Math.random() * 11) - 5;
        const y = Math.floor(Math.random() * 11) - 5;
        return { text: `Find the point (${x}, ${y})`, answer: { x, y } };
    } else if (type === 'trivia') {
        try {
            const response = await axios.get('https://opentdb.com/api.php?amount=1&category=18&type=multiple');
            const data = response.data.results[0];
            const correctAnswer = he.decode(data.correct_answer);
            const incorrectAnswers = data.incorrect_answers.map(answer => he.decode(answer));
            const allAnswers = [...incorrectAnswers, correctAnswer];
            // Fisher-Yates shuffle
            for (let i = allAnswers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
            }
            const correctIndex = allAnswers.indexOf(correctAnswer);
            return {
                text: he.decode(data.question),
                answers: allAnswers,
                correctIndex: correctIndex
            };
        } catch (error) {
            console.error('Error fetching trivia question:', error);
            return { text: 'Error fetching question', answers: [], correctIndex: -1 };
        }
    }
}

function startGameLoop(roomId) {
    const room = rooms[roomId];
    if (!room || room.interval) return;

    // Initialize game metrics
    if (!metrics.games[roomId]) {
        metrics.games[roomId] = {
            id: roomId,
            gameType: room.gameType,
            startTime: new Date().toISOString(),
            questions: [],
            players: Object.keys(room.players)
        };
    }

    const broadcastNewQuestion = async () => {
        const newQuestion = await generateQuestion(room.gameType);
        room.question = newQuestion;
        room.submittedAnswers = [];
        room.currentQuestionStartTime = performance.now();
        
        // Log new question
        const questionLog = {
            question: newQuestion.text,
            answer: newQuestion.answer,
            timestamp: new Date().toISOString(),
            playerResponses: []
        };
        metrics.games[roomId].questions.push(questionLog);
        
        io.to(roomId).emit('newQuestion', newQuestion);
    };

    broadcastNewQuestion();
    room.interval = setInterval(broadcastNewQuestion, 10000); // Increased for trivia
}

function calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function calculateScore(distance) {
    return Math.max(0, Math.round(100 - distance * 10));
}

io.on('connection', (socket) => {
    socket.on('getRooms', () => {
        socket.emit('updateRooms', getSanitizedRooms());
    });

    socket.on('createRoom', ({ gameType, playerName }) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomId] = {
            gameType,
            players: {},
            question: {},
            submittedAnswers: [],
            interval: null,
            deletionTimeout: null,
            isPendingDeletion: false
        };
        socket.join(roomId);
        rooms[roomId].players[socket.id] = { name: playerName, score: 0 };
        socket.emit('joinSuccess', roomId);
        startGameLoop(roomId);
        io.emit('updateRooms', getSanitizedRooms());
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms[roomId];
        if (room) {
            if (room.deletionTimeout) {
                clearTimeout(room.deletionTimeout);
                room.deletionTimeout = null;
                room.isPendingDeletion = false;
            }
            socket.join(roomId);
            room.players[socket.id] = { name: playerName, score: 0 };
            if (!room.interval) {
                startGameLoop(roomId);
            }
            socket.emit('joinSuccess', roomId);
            socket.emit('newQuestion', room.question);
            io.to(roomId).emit('updateLeaderboard', room.players);
            io.emit('updateRooms', getSanitizedRooms());
        } else {
            socket.emit('joinError', 'Room not found.');
        }
    });

    socket.on('submitGuess', ({ roomId, guess }) => {
        const room = rooms[roomId];
        const player = room?.players[socket.id];
        if (!room || !player || room.submittedAnswers.includes(socket.id)) return;

        // Calculate response time
        const responseTime = performance.now() - room.currentQuestionStartTime;
        
        room.submittedAnswers.push(socket.id);

        let score = 0;
        if (room.gameType === 'number-line') {
            const distance = Math.abs(room.question.answer - guess.x);
            score = calculateScore(distance);
        } else if (room.gameType === 'cartesian-plane') {
            const distance = calculateDistance(room.question.answer, guess);
            score = calculateScore(distance);
        } else if (room.gameType === 'trivia') {
            const { x, y } = guess;
            console.log('Received trivia guess:', guess);
            console.log('x:', x, 'y:', y, 'correctIndex:', room.question.correctIndex);
            const { correctIndex } = room.question;
            const scores = [-1, -1, -1, -1];
            scores[correctIndex] = 1;
            
            const s00 = scores[0]; // Top-left
            const s10 = scores[1]; // Top-right
            const s01 = scores[2]; // Bottom-left
            const s11 = scores[3]; // Bottom-right

            score = s00 * (1 - x) * (1 - y) + s10 * x * (1 - y) + s01 * (1 - x) * y + s11 * x * y;
            score = Math.round(score * 100) / 100; // Round to 2 decimal places
            console.log('Calculated trivia score:', score);
        }
        
        player.score += score;

        // Update player metrics
        if (!metrics.players[socket.id]) {
            metrics.players[socket.id] = {
                playerId: socket.id,
                totalScore: 0,
                questionsAnswered: 0,
                totalResponseTime: 0,
                bestScore: 0,
                questionHistory: [] // Store individual question history
            };
        }
        
        const playerMetrics = metrics.players[socket.id];
        playerMetrics.totalScore += score;
        playerMetrics.questionsAnswered += 1;
        playerMetrics.totalResponseTime += responseTime;
        playerMetrics.bestScore = Math.max(playerMetrics.bestScore, score);
        
        // Add question history with time taken
        playerMetrics.questionHistory.push({
            question: room.question.text,
            responseTime: responseTime,
            score: score,
            timestamp: new Date().toISOString()
        });
        
        // Find the current question in metrics
        const gameMetrics = metrics.games[roomId];
        const currentQuestion = gameMetrics.questions[gameMetrics.questions.length - 1];
        
        // Add response data
        currentQuestion.playerResponses.push({
            playerId: socket.id,
            playerName: player.name,
            guess: guess,
            score: score,
            responseTime: responseTime,
            timestamp: new Date().toISOString()
        });

        // Save metrics periodically
        if (Object.keys(playerMetrics).length % 5 === 0) {
            saveMetrics();
        }

        socket.emit('guessResult', { score, correctAnswer: room.question.answer, correctIndex: room.question.correctIndex });
        io.to(roomId).emit('updateLeaderboard', room.players);
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.players[socket.id]) {
                // Save final metrics before disconnect
                saveMetrics();
                
                delete room.players[socket.id];
                if (Object.keys(room.players).length === 0) {
                    // Mark game as ended
                    if (metrics.games[roomId]) {
                        metrics.games[roomId].endTime = new Date().toISOString();
                        // Save one final time
                        saveMetrics();
                    }
                    
                    room.isPendingDeletion = true;
                    room.deletionTimeout = setTimeout(() => {
                        clearInterval(room.interval);
                        delete rooms[roomId];
                        io.emit('updateRooms', getSanitizedRooms());
                    }, ROOM_DELETION_TIMEOUT);
                }
                io.to(roomId).emit('updateLeaderboard', room.players);
                io.emit('updateRooms', getSanitizedRooms());
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
