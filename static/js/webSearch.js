// Web Search Functionality
class WebSearch {
    constructor() {
        // Header search elements
        this.headerSearchInput = document.getElementById('header-search-input');
        this.headerSearchBtn = document.getElementById('header-search-btn');
        
        this.init();
    }
    
    init() {
        // Bind header search event listeners
        this.headerSearchBtn.addEventListener('click', () => this.performHeaderSearch());
        this.headerSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performHeaderSearch();
            }
        });
    }
    
    async performHeaderSearch() {
        const query = this.headerSearchInput.value.trim();
        
        if (!query) {
            this.showNotification('Please enter a search query', 'error');
            return;
        }
        
        // Show loading in chat area
        this.showChatLoading(query);
        
        try {
            const response = await fetch('/search-web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: query })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.displayChatResults(data.results, query);
                this.headerSearchInput.value = ''; // Clear input after search
            } else {
                this.showChatError(data.error || 'Search failed');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showChatError('Network error. Please try again.');
        }
    }
    

    

    
    showChatLoading(query) {
        const chatContainer = document.getElementById('chat-container');
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'message ai-message';
        loadingMessage.id = 'web-search-loading';
        loadingMessage.innerHTML = `
            <div class="message-content">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-spinner" style="animation: spin 1s linear infinite; color: var(--accent);"></i>
                    <span>Searching the web for "${query}"...</span>
                </div>
            </div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        chatContainer.appendChild(loadingMessage);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    showChatError(message) {
        // Remove loading message if exists
        const loadingMessage = document.getElementById('web-search-loading');
        if (loadingMessage) {
            loadingMessage.remove();
        }
        
        const chatContainer = document.getElementById('chat-container');
        const errorMessage = document.createElement('div');
        errorMessage.className = 'message ai-message';
        errorMessage.innerHTML = `
            <div class="message-content">
                <div style="display: flex; align-items: center; gap: 10px; color: #ff6b6b;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>${message}</span>
                </div>
            </div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        chatContainer.appendChild(errorMessage);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    displayChatResults(results, query) {
        // Remove loading message if exists
        const loadingMessage = document.getElementById('web-search-loading');
        if (loadingMessage) {
            loadingMessage.remove();
        }
        
        if (!results || results.length === 0) {
            this.showChatError('No results found for your search');
            return;
        }
        
        // Check if results is an array of objects or a single error message
        if (typeof results[0] === 'string') {
            this.showChatError(results[0]);
            return;
        }
        
        const chatContainer = document.getElementById('chat-container');
        const resultsMessage = document.createElement('div');
        resultsMessage.className = 'message ai-message';
        
        let resultsHTML = `
            <div class="message-content">
                <h3 style="color: var(--accent); margin-bottom: 15px;">
                    <i class="fas fa-search"></i> Web Search Results for "${query}"
                </h3>
        `;
        // Show abstract/infobox at the top
        results.forEach((result) => {
            if (result.type === 'abstract' && result.text) {
                resultsHTML += `<div style="margin-bottom: 15px; font-size: 16px; color: var(--text-light);"><strong>Answer:</strong> ${result.text}</div>`;
            }
            if (result.type === 'infobox' && result.label && result.value) {
                resultsHTML += `<div style="margin-bottom: 8px; font-size: 14px;"><strong>${result.label}:</strong> ${result.value}</div>`;
            }
        });
        // Show related topics as clickable links
        let relatedCount = 0;
        results.forEach((result) => {
            if (result.type === 'related' && result.text && result.url) {
                relatedCount++;
                resultsHTML += `
                    <div style="background: rgba(42, 34, 99, 0.3); border: 1px solid rgba(170, 126, 238, 0.2); border-radius: 8px; padding: 15px; margin-bottom: 12px;">
                        <div style="font-weight: 600; color: var(--accent); margin-bottom: 5px;">
                            <a href="${result.url}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">
                                ${result.text}
                            </a>
                        </div>
                        <div style="font-size: 12px; color: rgba(240, 240, 240, 0.7); margin-bottom: 8px; word-break: break-all;">
                            <i class="fas fa-link"></i> ${result.url}
                        </div>
                    </div>
                `;
            }
        });
        if (relatedCount === 0) {
            resultsHTML += `<div style="margin-bottom: 10px; color: #aaa;">No related topics found.</div>`;
        }
        resultsHTML += `</div>`;
        resultsMessage.innerHTML = resultsHTML + `<div class="message-time">${new Date().toLocaleTimeString()}</div>`;
        chatContainer.appendChild(resultsMessage);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    

    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}-notification`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize web search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize web search functionality
    const webSearch = new WebSearch();
    
    // Add to global scope for debugging
    window.webSearch = webSearch;
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSearch;
} 