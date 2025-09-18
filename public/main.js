// Client-side game logic
document.addEventListener('DOMContentLoaded', () => {
    // Initialize game when page loads
    initializeGame();
});

// Function to initialize game
function initializeGame() {
    // Get game type from URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('type') || 'number-line';
    
    // Set up game container
    const gameContainer = document.getElementById('game-container');
    gameContainer.dataset.gameType = gameType;
    
    // Fetch and display a math question
    fetchQuestion(gameType);
    
    // Set up event listeners based on game type
    setupInputHandlers(gameType);
}

// Function to fetch a question from the server
function fetchQuestion(gameType) {
    fetch(`/api/question/${gameType}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('question-display').textContent = data.question;
            
            // Set current game ID
            if (data.gameId) {
                window.currentGameId = data.gameId;
            }
            
            // Set current correct answer
            if (data.correctAnswer) {
                setCurrentCorrectAnswer(gameType, data.correctAnswer);
            }
        });
}

// Function to set up input handlers based on game type
function setupInputHandlers(gameType) {
    const gameContainer = document.getElementById('game-container');
    
    if (gameType === 'number-line') {
        // For number line, handle clicks along the line
        gameContainer.addEventListener('click', (event) => {
            const rect = gameContainer.getBoundingClientRect();
            const x = event.clientX - rect.left;
            
            // Convert x-coordinate to number line value (assuming the line is horizontal)
            const width = rect.right - rect.left;
            const numberLineValue = (x / width) * 20 - 10; // Maps to -10 to 10 range
            
            // Create coordinates object that submitGuess can use
            const coordinates = {
                x: event.clientX,
                y: event.clientY
            };
            
            // Submit the guess
            submitGuess(coordinates);
        });
    } else if (gameType === 'cartesian-plane') {
        // For Cartesian plane, handle form submission
        const form = document.getElementById('answer-form');
        if (form) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                
                // Get coordinates from form
                const coordinates = {
                    x: parseInt(document.getElementById('x-input').value),
                    y: parseInt(document.getElementById('y-input').value)
                };
                
                // Submit the guess
                submitGuess(coordinates);
                
                // Clear the inputs
                document.getElementById('x-input').value = '';
                document.getElementById('y-input').value = '';
                
                return false;
            });
        }
    }
}

// Function to calculate distance between two points
function calculateDistance(point1, point2) {
    if (point1 && point2) {
        // Cartesian distance formula
        return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
    }
    return 0;
}

// Function to get current correct answer based on game type
function getCurrentCorrectAnswer(gameType) {
    // For simplicity, we'll use a global variable to store the current answer
    // In a real game, this would be retrieved from the server
    return window.currentCorrectAnswer;
}

// Function to set current correct answer
function setCurrentCorrectAnswer(gameType, answer) {
    window.currentCorrectAnswer = answer;
}

// Function to calculate score based on distance
function calculateScore(distance) {
    // Simple scoring system - closer = higher score
    // Max score of 1000 for perfect guess, decreasing exponentially
    return Math.max(0, Math.floor(1000 * Math.exp(-0.001 * distance)));
}

// Function to handle user's guess submission
function submitGuess(coordinates) {
    const gameType = document.getElementById('game-container').dataset.gameType;
    const answer = normalizeCoordinates(gameType, coordinates);
    
    // Send the guess to the server
    socket.emit('submitGuess', {
        gameId: window.currentGameId,
        userId: window.currentUserId,
        answer: answer
    });
    
    // Show the user's guess on the game container
    const guessMarker = document.createElement('div');
    guessMarker.className = 'guess-marker';
    
    if (gameType === 'number-line') {
        // For number line, show the guess on the number line container
        guessMarker.style.left = `${coordinates.x}px`;
        guessMarker.style.top = '50%';
    } else if (gameType === 'cartesian-plane') {
        // For Cartesian plane, show the guess on the plane
        guessMarker.style.left = `${coordinates.x}px`;
        guessMarker.style.top = `${coordinates.y}px`;
    }
    
    guessMarker.style.transform = 'translate(-50%, -50%)';
    guessMarker.style.position = 'absolute';
    
    document.getElementById('game-container').appendChild(guessMarker);
    
    // Return false to prevent default form submission if used in a form
    return false;
}

// Function to normalize click coordinates based on game type
function normalizeCoordinates(gameType, coordinates) {
    const gameContainer = document.getElementById('game-container');
    const rect = gameContainer.getBoundingClientRect();
    
    if (gameType === 'number-line') {
        // For number line, we'll use the x-coordinate and map it to a -10 to 10 range
        const width = rect.right - rect.left;
        const x = coordinates.x - rect.left;
        return (x / width) * 20 - 10; // Maps to -10 to 10 range
    } else if (gameType === 'cartesian-plane') {
        // For Cartesian plane, we'll use both x and y coordinates
        const width = rect.right - rect.left;
        const height = rect.bottom - rect.top;
        const x = coordinates.x - rect.left;
        const y = coordinates.y - rect.top;
        
        return {
            x: (x / width) * 20 - 10, // Maps x to -10 to 10 range
            y: (y / height) * 20 - 10 // Maps y to -10 to 10 range
        };
    }
    
    return null;
}
