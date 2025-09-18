// Client-side game logic
document.addEventListener('DOMContentLoaded', () => {
    // Initialize game when page loads
    initializeGame();
    
    // Initialize the game visualization
    initializeGameVisualization();
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

// Function to initialize game visualization
function initializeGameVisualization() {
    const gameContainer = document.getElementById('game-container');
    const type = gameContainer.dataset.gameType;
    
    if (type === 'number-line') {
        // Create a simple number line visualization
        createNumberLine();
    } else if (type === 'cartesian-plane') {
        // Create a Cartesian plane visualization
        createCartesianPlane();
    }
}

// Function to create a number line visualization
function createNumberLine() {
    const gameContainer = document.querySelector('.number-line-container');
    if (!gameContainer) return;
    
    // Create the number line
    const numberLine = document.createElement('div');
    numberLine.className = 'number-line';
    numberLine.style.position = 'absolute';
    numberLine.style.left = '0';
    numberLine.style.right = '0';
    numberLine.style.top = '50%';
    numberLine.style.transform = 'translateY(-50%)';
    numberLine.style.height = '5px';
    numberLine.style.backgroundColor = '#333';
    
    gameContainer.appendChild(numberLine);
    
    // Add ticks and labels
    for (let i = -10; i <= 10; i++) {
        const tick = document.createElement('div');
        tick.className = 'tick';
        tick.style.position = 'absolute';
        tick.style.left = `${(i + 10) * 100 / 20}%`;
        tick.style.top = '50%';
        tick.style.transform = 'translateY(-50%)';
        tick.style.width: '1px';
        tick.style.height: '10px';
        tick.style.backgroundColor = '#333';
        
        // Create label
        const label = document.createElement('span');
        label.className = 'label';
        label.style.position = 'absolute';
        label.style.left = '50%';
        label.style.transform = 'translateX(-50%)';
        label.style.top = '15px';
        label.style.fontSize = '12px';
        label.style.color = '#333';
        label.textContent = i;
        
        tick.appendChild(label);
        gameContainer.appendChild(tick);
    }
}

// Function to create a Cartesian plane visualization
function createCartesianPlane() {
    const gameContainer = document.querySelector('.cartesian-plane-container');
    if (!gameContainer) return;
    
    // Create the Cartesian plane
    const plane = document.createElement('div');
    plane.className = 'cartesian-plane';
    plane.style.position = 'relative';
    plane.style.width = '100%';
    plane.style.height = '100%';
    plane.style.border = '1px solid #333';
    
    gameContainer.appendChild(plane);
    
    // Add grid lines
    for (let i = 0; i <= 20; i++) {
        // Horizontal lines
        const hLine = document.createElement('div');
        hLine.className = 'grid-line horizontal';
        hLine.style.position = 'absolute';
        hLine.style.left = '0';
        hLine.style.right = '0';
        hLine.style.top = `${i * 100 / 20}%`;
        hLine.style.borderTop = '1px dashed #ccc';
        plane.appendChild(hLine);
        
        // Vertical lines
        const vLine = document.createElement('div');
        vLine.className = 'grid-line vertical';
        vLine.style.position = 'absolute';
        vLine.style.left = `${i * 100 / 20}%`;
        vLine.style.top = '0';
        vLine.style.bottom = '0';
        vLine.style.borderLeft = '1px dashed #ccc';
        plane.appendChild(vLine);
    }
    
    // Add axis lines
    const xAxis = document.createElement('div');
    xAxis.className = 'axis x-axis';
    xAxis.style.position = 'absolute';
    xAxis.style.left = '0';
    xAxis.style.right = '0';
    xAxis.style.top = '50%';
    xAxis.style.transform = 'translateY(-50%)';
    xAxis.style.borderTop = '2px solid #000';
    plane.appendChild(xAxis);
    
    const yAxis = document.createElement('div');
    yAxis.className = 'axis y-axis';
    yAxis.style.position = 'absolute';
    yAxis.style.left = '50%';
    yAxis.style.top = '0';
    yAxis.style.bottom = '0';
    yAxis.style.transform = 'translateX(-50%)';
    yAxis.style.borderLeft = '2px solid #000';
    plane.appendChild(yAxis);
    
    // Add axis labels
    for (let i = -10; i <= 10; i++) {
        // Add x-axis labels
        if (i !== 0) { // Skip origin label, it will be added separately
            const xAxisLabel = document.createElement('div');
            xAxisLabel.className = 'axis-label x-axis';
            xAxisLabel.style.position = 'absolute';
            xAxisLabel.style.left = `${(i + 10) * 100 / 20}%`;
            xAxisLabel.style.top = '50%';
            xAxisLabel.style.transform = 'translate(-50%, 10px)';
            xAxisLabel.style.fontSize = '12px';
            xAxisLabel.style.color = '#333';
            xAxisLabel.textContent = i;
            plane.appendChild(xAxisLabel);
        }
        
        // Add y-axis labels
        if (i !== 10) { // Skip duplicate label
            const yAxisLabel = document.createElement('div');
            yAxisLabel.className = 'axis-label y-axis';
            yAxisLabel.style.position = 'absolute';
            yAxisLabel.style.left = '50%';
            yAxisLabel.style.top = `${(i + 10) * 100 / 20}%`;
            yAxisLabel.style.transform = 'translate(10px, -50%)';
            yAxisLabel.style.fontSize = '12px';
            yAxisLabel.style.color = '#333';
            yAxisLabel.textContent = 10 - i; // Invert y-axis labels
            plane.appendChild(yAxisLabel);
        }
    }
    
    // Add origin label
    const originLabel = document.createElement('div');
    originLabel.className = 'axis-label origin';
    originLabel.style.position = 'absolute';
    originLabel.style.left = '50%';
    originLabel.style.top = '50%';
    originLabel.style.transform = 'translate(-50%, -50%)';
    originLabel.style.fontSize = '12px';
    originLabel.style.color = '#333';
    originLabel.textContent = '0';
    plane.appendChild(originLabel);
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
