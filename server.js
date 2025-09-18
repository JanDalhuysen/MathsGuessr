const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory game state storage
let games = {};
let currentAnswers = {}; // Store current answers for each game

// Function to generate a unique game ID
function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/game/:type', (req, res) => {
    res.render('game', { type: req.params.type });
});

// API endpoint to get math questions
app.get('/api/question/:type', (req, res) => {
    const type = req.params.type;
    const gameId = req.query.gameId || 'default';
    
    let question = '';
    let correctAnswer = null;
    
    // Generate a random math question based on type
    if (type === 'number-line') {
        // Generate a random number line question
        const a = Math.floor(Math.random() * 20) - 10;
        const b = Math.floor(Math.random() * 20) - 10;
        const operation = ['+', '-', '×', '÷'][Math.floor(Math.random() * 4)];
        
        question = `Where is ${a} ${operation} ${b} on the number line?`;
        
        // Calculate correct answer
        switch (operation) {
            case '+': correctAnswer = a + b; break;
            case '-': correctAnswer = a - b; break;
            case '×': correctAnswer = a * b; break;
            case '÷': correctAnswer = a / b; break;
        }
        
        // Store the correct answer for this game
        currentAnswers[gameId] = {
            type,
            answer: correctAnswer,
            timestamp: Date.now()
        };
        
        res.json({ question, correctAnswer, type: 'number-line', gameId });
    } else if (type === 'cartesian-plane') {
        // Generate a random Cartesian plane question
        const x = Math.floor(Math.random() * 20) - 10;
        const y = Math.floor(Math.random() * 20) - 10;
        
        question = `Where is the point (${x}, ${y}) on the Cartesian plane?`;
        
        // For Cartesian plane, we'll represent the answer as {x, y}
        currentAnswers[gameId] = {
            type,
            answer: { x, y },
            timestamp: Date.now()
        };
        
        res.json({ question, correctAnswer: {x, y}, type: 'cartesian-plane', gameId });
    } else {
        res.status(400).json({ error: 'Invalid game type' });
    }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Handle user joining a game
    socket.on('joinGame', (gameId) => {
        socket.join(gameId);
        console.log(`User joined game: ${gameId}`);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
    
    // Handle user's guess submission
    socket.on('submitGuess', (data) => {
        const { gameId, userId, answer } = data;
    
        // Broadcast the guess to other players
        socket.to(gameId).emit('guessReceived', { userId, answer });
    
        // Get the correct answer for this game
        const gameData = currentAnswers[gameId];
        
        if (gameData) {
            const correctAnswer = gameData.answer;
            let distance = 0;
        
            // Calculate distance based on game type
            if (gameData.type === 'number-line') {
                distance = Math.abs(correctAnswer - answer);
            } else if (gameData.type === 'cartesian-plane') {
                distance = calculateDistance(correctAnswer, answer);
            }
        
            const score = calculateScore(distance);
        
            // Emit score to the user
            socket.emit('showScore', { score, correctAnswer, type: gameData.type });
        
            // Store the user's score
            recordScore(gameId, userId, score);
        
            // Broadcast the updated score to all players
            io.to(gameId).emit('updateScores', getGameScores(gameId));
        }
    });
    
    // Handle user's guess submission
    socket.on('submitGuess', (data) => {
        const { gameId, userId, answer } = data;
    
        // Broadcast the guess to other players
        socket.to(gameId).emit('guessReceived', { userId, answer });
    
        // Get the correct answer for this game
        const gameData = currentAnswers[gameId];
        
        if (gameData) {
            const correctAnswer = gameData.answer;
            let distance = 0;
        
            // Calculate distance based on game type
            if (gameData.type === 'number-line') {
                distance = Math.abs(correctAnswer - answer);
            } else if (gameData.type === 'cartesian-plane') {
                distance = calculateDistance(correctAnswer, answer);
            }
        
            const score = calculateScore(distance);
        
            // Emit score to the user
            socket.emit('showScore', { score, correctAnswer, type: gameData.type });
        
            // Store the user's score
            recordScore(gameId, userId, score);
        
            // Broadcast the updated score to all players
            io.to(gameId).emit('updateScores', getGameScores(gameId));
        }
    });
});

// Function to record a user's score
function recordScore(gameId, userId, score) {
    // In a real application, you would store this in a database
    // For simplicity, we're using an in-memory object
    
    // Initialize game if it doesn't exist
    if (!games[gameId]) {
        games[gameId] = {};
    }
    
    // Initialize user scores array if it doesn't exist
    if (!games[gameId][userId]) {
        games[gameId][userId] = [];
    }
    
    games[gameId][userId].push(score);
}

// Function to get scores for a specific game
function getGameScores(gameId) {
    // Return scores for this game
    if (!games[gameId]) {
        return {};
    }
    
    return games[gameId];
}

// API endpoint to get game scores
app.get('/api/scores/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    res.json({ scores: getGameScores(gameId) });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
