const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

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

function generateQuestion(type) {
    if (type === 'number-line') {
        const a = Math.floor(Math.random() * 11) - 5;
        const b = Math.floor(Math.random() * 11) - 5;
        return { text: `What is ${a} + ${b}?`, answer: a + b };
    } else if (type === 'cartesian-plane') {
        const x = Math.floor(Math.random() * 11) - 5;
        const y = Math.floor(Math.random() * 11) - 5;
        return { text: `Find the point (${x}, ${y})`, answer: { x, y } };
    }
}

function startGameLoop(roomId) {
    const room = rooms[roomId];
    if (!room || room.interval) return;

    const broadcastNewQuestion = () => {
        const newQuestion = generateQuestion(room.gameType);
        room.question = newQuestion;
        room.submittedAnswers = [];
        io.to(roomId).emit('newQuestion', { text: newQuestion.text });
    };

    broadcastNewQuestion();
    room.interval = setInterval(broadcastNewQuestion, 10000);
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
            socket.emit('newQuestion', { text: room.question.text });
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

        room.submittedAnswers.push(socket.id);

        let distance = 0;
        if (room.gameType === 'number-line') {
            distance = Math.abs(room.question.answer - guess.x);
        } else {
            distance = calculateDistance(room.question.answer, guess);
        }
        const score = calculateScore(distance);
        player.score += score;

        socket.emit('guessResult', { score, correctAnswer: room.question.answer });
        io.to(roomId).emit('updateLeaderboard', room.players);
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                if (Object.keys(room.players).length === 0) {
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
