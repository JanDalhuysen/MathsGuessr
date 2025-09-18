// Client-side game logic
document.addEventListener('DOMContentLoaded', () => {
    // Fetch and display a math question based on game type
    fetch('/api/question/number-line')
        .then(response => response.json())
        .then(data => {
            document.getElementById('question-display').textContent = data.question;
        });
});

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
}
