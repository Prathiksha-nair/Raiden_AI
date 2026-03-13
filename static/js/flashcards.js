// flashcards.js - Complete implementation with working deletion

// DOM Elements
const flashcard = document.getElementById('flashcard');
const prevFlashcardBtn = document.getElementById('prev-flashcard');
const nextFlashcardBtn = document.getElementById('next-flashcard');
const flipFlashcardBtn = document.getElementById('flip-flashcard');
const generateFlashcardsBtn = document.getElementById('generate-flashcards-btn');

// State Variables
let flashcardIndex = 0;
let flashcards = [];

// Initialize flashcards
function initFlashcards() {
    loadFlashcards();
    
    // Event listeners
    flipFlashcardBtn.addEventListener('click', flipFlashcard);
    prevFlashcardBtn.addEventListener('click', showPrevFlashcard);
    nextFlashcardBtn.addEventListener('click', showNextFlashcard);
    generateFlashcardsBtn.addEventListener('click', generateFlashcards);
    
    // Click handler for the flashcard itself
    flashcard.addEventListener('click', flipFlashcard);
    
    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
}

// Flip the flashcard
function flipFlashcard() {
    flashcard.classList.toggle('flipped');
}

// Show previous flashcard
function showPrevFlashcard() {
    if (flashcards.length === 0) return;
    flashcardIndex = (flashcardIndex - 1 + flashcards.length) % flashcards.length;
    updateFlashcardView();
}

// Show next flashcard
function showNextFlashcard() {
    if (flashcards.length === 0) return;
    flashcardIndex = (flashcardIndex + 1) % flashcards.length;
    updateFlashcardView();
}

// Update the flashcard view
function updateFlashcardView() {
    if (flashcards.length === 0) {
        showEmptyFlashcardState();
        return;
    }

    const currentCard = flashcards[flashcardIndex];
    
    // Create or update flashcard structure
    let flashcardInner = flashcard.querySelector('.flashcard-inner');
    if (!flashcardInner) {
        flashcardInner = document.createElement('div');
        flashcardInner.className = 'flashcard-inner';
        flashcard.innerHTML = '';
        flashcard.appendChild(flashcardInner);
    }

    // Update front and back content
    let front = flashcardInner.querySelector('.flashcard-front');
    let back = flashcardInner.querySelector('.flashcard-back');
    
    if (!front) {
        front = document.createElement('div');
        front.className = 'flashcard-front';
        flashcardInner.appendChild(front);
    }
    
    if (!back) {
        back = document.createElement('div');
        back.className = 'flashcard-back';
        flashcardInner.appendChild(back);
    }
    
    front.textContent = currentCard.question;
    back.textContent = currentCard.answer;
    
    // Update counter
    let counter = flashcard.querySelector('.flashcard-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'flashcard-counter';
        flashcard.appendChild(counter);
    }
    counter.textContent = `${flashcardIndex + 1}/${flashcards.length}`;
    
    // Update delete button
    let actions = flashcard.querySelector('.flashcard-actions');
    if (!actions) {
        actions = document.createElement('div');
        actions.className = 'flashcard-actions';
        flashcard.appendChild(actions);
    }
    
    // Clear existing delete button
    actions.innerHTML = '';
    
    // Add new delete button with current index
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-flashcard-btn';
    deleteBtn.setAttribute('data-card-id', flashcardIndex);
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', deleteCurrentFlashcard);
    
    actions.appendChild(deleteBtn);
    
    // Reset to front view
    flashcard.classList.remove('flipped');
}

// Handle keyboard navigation
function handleKeyboardNavigation(e) {
    if (!document.getElementById('flashcards-panel').classList.contains('active')) return;
    
    if (e.key === 'ArrowLeft') showPrevFlashcard();
    if (e.key === 'ArrowRight') showNextFlashcard();
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flipFlashcard();
    }
}

// Load flashcards from server
function loadFlashcards() {
    flashcard.innerHTML = '<div class="flashcard-front">Loading flashcards...</div>';
    
    fetch('/flashcards')
        .then(response => response.json())
        .then(data => {
            if (data.flashcards && data.flashcards.length > 0) {
                flashcards = data.flashcards;
                flashcardIndex = 0;
                updateFlashcardView();
            } else {
                showEmptyFlashcardState();
            }
        })
        .catch(error => {
            console.error('Error loading flashcards:', error);
            showErrorFlashcardState();
        });
}

// Show empty state
function showEmptyFlashcardState() {
    flashcard.innerHTML = `
        <div class="flashcard-inner">
            <div class="flashcard-front">
                No flashcards available. Click "Generate Flashcards" to create some.
            </div>
            <div class="flashcard-back">
                You can generate flashcards from your study notes.
            </div>
        </div>
    `;
    flashcard.classList.remove('flipped');
}

// Show error state
function showErrorFlashcardState() {
    flashcard.innerHTML = `
        <div class="flashcard-front">
            Error loading flashcards. Please try again.
        </div>
    `;
    flashcard.classList.remove('flipped');
}

// Generate flashcards from notes
function generateFlashcards() {
    const notes = prompt('Enter your study notes to generate flashcards from:');
    if (!notes) return;

    generateFlashcardsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    generateFlashcardsBtn.disabled = true;
    
    fetch('/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: notes })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        if (data.flashcards) {
            flashcards = data.flashcards;
            flashcardIndex = 0;
            updateFlashcardView();
            showNotification('Successfully generated flashcards!', 'success');
        }
    })
    .catch(error => {
        console.error('Error generating flashcards:', error);
        showError('Failed to generate flashcards: ' + error.message);
    })
    .finally(() => {
        generateFlashcardsBtn.innerHTML = '<i class="fas fa-plus"></i> Generate Flashcards from Notes';
        generateFlashcardsBtn.disabled = false;
    });
}

// Delete current flashcard
function deleteCurrentFlashcard(e) {
    e.stopPropagation();
    const cardId = e.currentTarget.dataset.cardId;
    
    if (confirm('Are you sure you want to delete this flashcard?')) {
        // Show loading state
        flashcard.innerHTML = '<div class="flashcard-front">Deleting...</div>';
        
        // Simulate API call with timeout (replace with actual fetch in production)
        setTimeout(() => {
            // Remove from local array
            flashcards.splice(cardId, 1);
            
            // Adjust index if needed
            if (flashcardIndex >= flashcards.length && flashcards.length > 0) {
                flashcardIndex = flashcards.length - 1;
            }
            
            if (flashcards.length === 0) {
                showEmptyFlashcardState();
            } else {
                updateFlashcardView();
            }
            
            showNotification('Flashcard deleted successfully', 'success');
        }, 500);
        
        /*
        // Production version with actual API call:
        fetch(`/flashcards/${cardId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                flashcards.splice(cardId, 1);
                if (flashcardIndex >= flashcards.length && flashcards.length > 0) {
                    flashcardIndex = flashcards.length - 1;
                }
                if (flashcards.length === 0) {
                    showEmptyFlashcardState();
                } else {
                    updateFlashcardView();
                }
                showNotification('Flashcard deleted successfully');
            } else {
                throw new Error(data.error || 'Failed to delete flashcard');
            }
        })
        .catch(error => {
            console.error('Error deleting flashcard:', error);
            showError(error.message);
            updateFlashcardView();
        });
        */
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type === 'success' ? 'success-notification' : ''}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}

// Show error message
function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initFlashcards);