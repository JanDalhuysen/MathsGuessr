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

// Function to calculate score based on distance
function calculateScore(distance) {
    // Simple scoring system - closer = higher score
    // Max score of 1000 for perfect guess, decreasing exponentially
    return Math.max(0, Math.floor(1000 * Math.exp(-0.001 * distance)));
}
