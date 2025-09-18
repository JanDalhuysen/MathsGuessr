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
        
        // For number line, we'll represent the answer as a single number
        setCurrentCorrectAnswer(type, correctAnswer);
        res.json({ question, correctAnswer, type: 'number-line' });
    } else if (type === 'cartesian-plane') {
        // Generate a random Cartesian plane question
        const x = Math.floor(Math.random() * 20) - 10;
        const y = Math.floor(Math.random() * 20) - 10;
        
        question = `Where is the point (${x}, ${y}) on the Cartesian plane?`;
        
        // For Cartesian plane, we'll represent the answer as {x, y}
        setCurrentCorrectAnswer(type, {x, y});
        res.json({ question, correctAnswer: {x, y}, type: 'cartesian-plane' });
    } else {
        res.status(400).json({ error: 'Invalid game type' });
    }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
    
    // Handle user's guess submission
    socket.on('submitGuess', (data) => {
        const { gameId, userId, answer } = data;
    
        // Broadcast the guess to other players
        socket.to(gameId).emit('guessReceived', { userId, answer });
    
        // Get the correct answer for this game
        const correctAnswer = getCurrentCorrectAnswer(gameId);
    
        // Calculate score
        if (correctAnswer) {
            let distance = 0;
        
            // Calculate distance based on game type
            if (gameId === 'number-line') {
                distance = Math.abs(correctAnswer - answer);
            } else if (gameId === 'cartesian-plane') {
                distance = calculateDistance(correctAnswer, answer);
            }
        
            const score = calculateScore(distance);
        
            // Emit score to the user
            socket.emit('showScore', { score, correctAnswer });
        
            // Store the user's score
            recordScore(userId, score);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
