document.addEventListener('DOMContentLoaded', () => {
    const playerName = localStorage.getItem('playerName');
    if (!playerName) {
        window.location.href = '/';
        return;
    }

    const socket = io();

    const createRoomBtn = document.getElementById('create-room-btn');
    const gameTypeSelect = document.getElementById('game-type-select');
    const roomList = document.getElementById('room-list');

    createRoomBtn.addEventListener('click', () => {
        const gameType = gameTypeSelect.value;
        socket.emit('createRoom', { gameType, playerName });
    });

    socket.on('updateRooms', (rooms) => {
        roomList.innerHTML = '';
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const roomEl = document.createElement('div');
            roomEl.className = 'room-item';
            roomEl.innerHTML = `
                <span>${roomId} (${room.gameType})</span>
                <span>${room.playerCount} player(s)</span>
                <button class="join-btn" data-room-id="${roomId}">Join</button>
            `;
            roomList.appendChild(roomEl);
        }
    });

    roomList.addEventListener('click', (e) => {
        if (e.target.classList.contains('join-btn')) {
            const roomId = e.target.dataset.roomId;
            socket.emit('joinRoom', { roomId, playerName });
        }
    });

    socket.on('joinSuccess', (roomId) => {
        window.location.href = `/game?room=${roomId}`;
    });

    socket.on('joinError', (message) => {
        alert(message);
    });

    // Request initial room list
    socket.emit('getRooms');
});
