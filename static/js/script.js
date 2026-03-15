document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const sidebar = document.querySelector('.sidebar');
    const navItems = document.querySelectorAll('.nav-item');
    const featurePanels = document.querySelectorAll('.feature-panel');
    const closePanelBtns = document.querySelectorAll('.close-panel');
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const aboutBtn = document.getElementById('about-btn');
    const recordBtn = document.getElementById('record-btn');
    const transcriptText = document.getElementById('transcript-text');
    const clearTranscriptBtn = document.getElementById('clear-transcript');
    const copyTranscriptBtn = document.getElementById('copy-transcript');
    const generateSlidesBtn = document.getElementById('generate-slides');
    const slidePreview = document.getElementById('slide-preview');

    // Feature Panel Elements
    const runCodeBtn = document.getElementById('runCodeBtn');
    const codeInput = document.getElementById('codeInput');
    const codeExplanation = document.getElementById('codeExplanation');
    const languageSelect = document.getElementById('languageSelect');
    const htmlPreview = document.getElementById('htmlPreview');
    const previewFrame = document.getElementById('previewFrame');
    const flashcard = document.getElementById('flashcard');
    const prevFlashcardBtn = document.getElementById('prev-flashcard');
    const nextFlashcardBtn = document.getElementById('next-flashcard');
    const flipFlashcardBtn = document.getElementById('flip-flashcard');
    const generateFlashcardsBtn = document.querySelector('.add-task-btn');
    const mathInput = document.querySelector('#math-panel textarea');
    const solveMathBtn = document.querySelector('#math-panel .run-code');
    const mathSolution = document.querySelector('#math-panel .code-output');
    const mathSymbolBtns = document.querySelectorAll('.math-symbol-btn');
    const pdfUploadBtn = document.querySelector('#pdf-panel .add-task-btn');
    const citationGenerateBtn = document.querySelector('#citations-panel .run-code');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskList = document.getElementById('taskList');
    const completedCount = document.getElementById('completed-count');
    const pendingCount = document.getElementById('pending-count');
    const plannerNavBtns = document.querySelectorAll('.planner-nav-btn');

    // State Variables
    let isRecording = false;
    let recognition;
    let flashcardIndex = 0;
    let flashcards = [];
    let currentTasks = [];
    let transcriptSessionId = null;
    let lastTaskAddedDesc = null;
    let lastTaskAddedTime = 0;

    // Initialize all modules
    initSidebar();
    initChat();
    initVoiceInput();
    initCodePlayground();
    initFlashcards();
    initMathSolver();
    initPDFSummarizer();
    initStudyPlanner();
    initLectureTranscriber();
    initAttendanceTracker();
    initWebSocket();

    // ===== Sidebar Navigation =====
    // ===== Sidebar Navigation =====
    function initSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        
        // Create the dark overlay for mobile
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        document.body.appendChild(overlay);

        // Open sidebar on mobile
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.add('active');
                overlay.classList.add('active');
            });
        }

        // NEW: Close sidebar when clicking the X button
        if (closeSidebarBtn) {
            closeSidebarBtn.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        // Close sidebar when clicking the dark overlay
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });

        // Handle navigation item clicks
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(navItem => navItem.classList.remove('active'));
                item.classList.add('active');
                const panelId = item.getAttribute('data-panel') + '-panel';
                showPanel(panelId);
                
                // Auto-close sidebar on mobile after clicking a link
                if (window.innerWidth <= 992) {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                }
            });
        });

        closePanelBtns.forEach(btn => {
            btn.addEventListener('click', closeAllPanels);
        });

        aboutBtn.addEventListener('click', () => showPanel('about-panel'));
    }

    function showPanel(panelId) {
        featurePanels.forEach(panel => panel.classList.remove('active'));
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');

        if (window.innerWidth <= 992) sidebar.classList.remove('active');
    }

    function closeAllPanels() {
        featurePanels.forEach(panel => panel.classList.remove('active'));
    }

    // ===== Chat Functionality =====
    function initChat() {
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        // Auto-resize textarea
        messageInput.addEventListener('input', autoResize);
        messageInput.addEventListener('focus', autoResize);
    }

    function autoResize() {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    }

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            // Check if message contains code patterns
            const codePatterns = [
                /```[\s\S]*?```/, // Code blocks
                /def\s+\w+\s*\(/, // Python functions
                /function\s+\w+\s*\(/, // JavaScript functions
                /#include\s*</, // C includes
                /<html/i, // HTML tags
                /console\.log/, // JavaScript console
                /print\s*\(/, // Python print
                /printf\s*\(/, // C printf
                /int\s+main\s*\(/, // C main function
                /class\s+\w+/, // Classes
                /import\s+/, // Imports
                /const\s+|let\s+|var\s+/, // Variable declarations
            ];
            
            const containsCode = codePatterns.some(pattern => pattern.test(message));
            
            if (welcomeScreen.style.display !== 'none') welcomeScreen.style.display = 'none';
            addMessage(message, 'user');
            messageInput.value = '';
            showTypingIndicator();
            
            // Auto-open code playground if code is detected
            if (containsCode) {
                setTimeout(() => {
                    const codePanel = document.getElementById('code-panel');
                    if (codePanel) {
                        codePanel.classList.add('active');
                        // Set focus to code input
                        setTimeout(() => {
                            const codeInput = document.getElementById('codeInput');
                            const languageSelect = document.getElementById('languageSelect');
                            if (codeInput) {
                                codeInput.value = message;
                                // Auto-format pasted code according to selected language
                                let language = 'python';
                                if (languageSelect) language = languageSelect.value;
                                if (language === 'python') {
                                    codeInput.value = formatPythonCode(codeInput.value);
                                } else if (language === 'javascript') {
                                    codeInput.value = formatJavaScriptCode(codeInput.value);
                                } else if (language === 'html') {
                                    codeInput.value = formatHTMLCode(codeInput.value);
                                } else if (language === 'c') {
                                    codeInput.value = formatCCode(codeInput.value);
                                }
                                codeInput.focus();
                            }
                        }, 100);
                    }
                }, 500);
            }
            
            fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            })
            .then(response => response.json())
            .then(data => {
                hideTypingIndicator();
                if (data.error) {
                    showError(data.error);
                    return;
                }
                addMessage(data.response, 'ai');
                scrollToBottom();
            })
            .catch(error => {
                hideTypingIndicator();
                showError("Sorry, I encountered an error. Please try again.");
                console.error('Error:', error);
            });
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Clean up markdown formatting if present
        const cleanedText = cleanMarkdownFormatting(text);
        
        messageDiv.innerHTML = `${cleanedText}<div class="message-time">Today, ${timeString}</div>`;
        chatContainer.insertBefore(messageDiv, chatContainer.lastElementChild);
        // --- New: Add Execute in Playground button for code blocks from AI ---
        if (sender === 'ai') {
            // Try to find code blocks (triple backticks or <code> tags)
            // We'll use a regex to extract code and language
            // Supported: python, javascript, html, c
            const supportedLangs = ['python', 'javascript', 'html', 'c'];
            // Try to match markdown code block: ```lang\ncode\n```
            const codeBlockRegex = /```(python|javascript|html|c)\n([\s\S]*?)```/i;
            const match = text.match(codeBlockRegex);
            if (match) {
                const lang = match[1].toLowerCase();
                const code = match[2];
                if (supportedLangs.includes(lang)) {
                    const execBtn = document.createElement('button');
                    execBtn.textContent = `Execute in Playground (${lang})`;
                    execBtn.className = 'execute-playground-btn';
                    execBtn.style.marginTop = '10px';
                    execBtn.style.background = 'var(--accent, #764ba2)';
                    execBtn.style.color = 'white';
                    execBtn.style.border = 'none';
                    execBtn.style.padding = '8px 16px';
                    execBtn.style.borderRadius = '6px';
                    execBtn.style.cursor = 'pointer';
                    execBtn.onclick = function() {
                        // Open code playground, set language, paste code, format, and execute
                        const codePanel = document.getElementById('code-panel');
                        const codeInput = document.getElementById('codeInput');
                        const languageSelect = document.getElementById('languageSelect');
                        const runCodeBtn = document.getElementById('runCodeBtn');
                        if (codePanel && codeInput && languageSelect && runCodeBtn) {
                            codePanel.classList.add('active');
                            languageSelect.value = lang;
                            // Trigger change event to update example, if needed
                            const event = new Event('change');
                            languageSelect.dispatchEvent(event);
                            setTimeout(() => {
                                codeInput.value = code;
                                // Auto-format
                                if (lang === 'python') {
                                    codeInput.value = formatPythonCode(codeInput.value);
                                } else if (lang === 'javascript') {
                                    codeInput.value = formatJavaScriptCode(codeInput.value);
                                } else if (lang === 'html') {
                                    codeInput.value = formatHTMLCode(codeInput.value);
                                } else if (lang === 'c') {
                                    codeInput.value = formatCCode(codeInput.value);
                                }
                                codeInput.focus();
                                // Execute
                                runCodeBtn.click();
                            }, 100);
                        }
                    };
                    messageDiv.appendChild(execBtn);
                }
            }
        }
        scrollToBottom();
    }

    function showTypingIndicator() {
        let typingIndicator = document.querySelector('.typing-indicator');
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            typingIndicator.innerHTML = `
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            `;
            chatContainer.appendChild(typingIndicator);
        }
        typingIndicator.style.display = 'flex';
    }

    function hideTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) typingIndicator.style.display = 'none';
    }

   function cleanMarkdownFormatting(text) {
        if (!text) return '';
        
        let html = text
            // Headers
            .replace(/^### (.*$)/gm, '<h3 style="color:var(--accent); margin-top:15px; margin-bottom:10px;">$1</h3>')
            .replace(/^## (.*$)/gm, '<h2 style="color:var(--accent); margin-top:15px; margin-bottom:10px;">$1</h2>')
            .replace(/^# (.*$)/gm, '<h1 style="color:var(--accent); margin-top:15px; margin-bottom:10px;">$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '<em>$1</em>')
            // Code blocks
            .replace(/`(.*?)`/g, '<code style="background:rgba(170, 126, 238, 0.15); color:#d4b3ff; padding:2px 6px; border-radius:4px;">$1</code>')
            // Turn * or - at the start of a line into list items
            .replace(/^[\*\-]\s+(.*)$/gm, '<li>$1</li>')
            // Turn numbers (1., 2.) at the start of a line into list items
            .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');

        // Wrap consecutive <li> tags in a nice <ul> circle list
        html = html.replace(/(<li>.*<\/li>(?:\s*<li>.*<\/li>)*)/g, '<ul style="margin-left: 20px; margin-bottom: 15px; list-style-type: disc;">$1</ul>');

        // Handle line breaks (double break = paragraph, single break = normal line break)
        html = html.replace(/\n\n/g, '</p><p style="margin-bottom: 10px;">');
        html = html.replace(/\n/g, '<br>');
        
        // Clean up ugly extra breaks inside lists
        html = html.replace(/<\/li><br>/g, '</li>');
        html = html.replace(/<ul(.*?)><br>/g, '<ul$1>');
        html = html.replace(/<br><li/g, '<li'); 
        html = html.replace(/<br><\/ul>/g, '</ul>');

        // Ensure text starts wrapped in a paragraph if it doesn't have an HTML tag
        if (!html.startsWith('<')) {
            html = '<p style="margin-bottom: 10px;">' + html + '</p>';
        }

        // Remove empty paragraphs
        html = html.replace(/<p[^>]*>\s*<\/p>/g, '');
        
        return html;
    }
    
    function scrollToBottom() {
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    }

    // ===== Voice Input =====
    function initVoiceInput() {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            
            voiceInputBtn.addEventListener('click', () => {
                if (voiceInputBtn.classList.contains('recording')) {
                    recognition.stop();
                    voiceInputBtn.classList.remove('recording');
                    voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                } else {
                    recognition.start();
                    voiceInputBtn.classList.add('recording');
                    voiceInputBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                }
            });

            recognition.onresult = (event) => {
                messageInput.value = event.results[0][0].transcript;
                voiceInputBtn.classList.remove('recording');
                voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                voiceInputBtn.classList.remove('recording');
                voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                showError('Voice input error: ' + event.error);
            };
        } else {
            voiceInputBtn.style.display = 'none';
            console.log('Speech recognition not supported');
        }
    }

    // ===== Code Playground =====
    function initCodePlayground() {
        runCodeBtn.addEventListener('click', runCode);
        
        // Add format button functionality
        const formatCodeBtn = document.getElementById('formatCodeBtn');
        if (formatCodeBtn) {
            formatCodeBtn.addEventListener('click', formatCode);
        }
        
        // Add language change handler
        languageSelect.addEventListener('change', loadLanguageExample);
        
        // Add code editor enhancements
        codeInput.addEventListener('keydown', handleCodeEditorKeydown);
        codeInput.addEventListener('input', handleCodeEditorInput);
        
        // Set up proper indentation
        setupCodeEditor();
        
        // Load initial example for Python
        loadLanguageExample();
    }
    
    function loadLanguageExample() {
        const language = languageSelect.value;
        const examples = {
            python: `# Welcome to Raiden AI Code Playground
# Professional Python Compiler Environment

def fibonacci(n):
    """Calculate the nth Fibonacci number using recursion"""
    if n <= 1:
        return n
    else:
        return fibonacci(n-1) + fibonacci(n-2)

# Test the function
print("Fibonacci sequence (first 10 numbers):")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")

# Calculate factorial
def factorial(n):
    """Calculate factorial using recursion"""
    if n == 0:
        return 1
    else:
        return n * factorial(n-1)

print(f"\\nFactorial of 5: {factorial(5)}")

# List comprehension example
squares = [x**2 for x in range(1, 11)]
print(f"\\nSquares of numbers 1-10: {squares}")`,

            javascript: `// Welcome to Raiden AI Code Playground
// Professional JavaScript Compiler Environment

// Fibonacci function using recursion
function fibonacci(n) {
    if (n <= 1) {
        return n;
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}

// Test the function
console.log("Fibonacci sequence (first 10 numbers):");
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}

// Calculate factorial
function factorial(n) {
    if (n === 0) {
        return 1;
    } else {
        return n * factorial(n - 1);
    }
}

console.log(\`\\nFactorial of 5: \${factorial(5)}\`);

// Array methods example
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const squares = numbers.map(x => x ** 2);
const evenNumbers = numbers.filter(x => x % 2 === 0);
const sum = numbers.reduce((acc, curr) => acc + curr, 0);

console.log(\`\\nOriginal numbers: \${numbers}\`);
console.log(\`Squares: \${squares}\`);
console.log(\`Even numbers: \${evenNumbers}\`);
console.log(\`Sum of all numbers: \${sum}\`);`,

            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Raiden AI Code Playground - HTML Example</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            padding: 30px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        .feature-card {
            background: rgba(255, 255, 255, 0.2);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            transition: transform 0.3s ease;
        }
        .feature-card:hover {
            transform: translateY(-5px);
        }
        .feature-icon {
            font-size: 2em;
            margin-bottom: 15px;
        }
        button {
            background: rgba(255, 255, 255, 0.3);
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            color: white;
            cursor: pointer;
            margin: 5px;
            transition: background 0.3s ease;
        }
        button:hover {
            background: rgba(255, 255, 255, 0.5);
        }
        .counter {
            font-size: 2em;
            font-weight: bold;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Raiden AI Code Playground</h1>
        <p style="text-align: center; font-size: 1.2em; margin-bottom: 30px;">
            Welcome to the professional HTML development environment!
        </p>
        
        <div style="text-align: center; margin-bottom: 30px;">
            <button onclick="incrementCounter()">Click Me!</button>
            <button onclick="resetCounter()">Reset</button>
            <div class="counter" id="counter">0</div>
        </div>
        
        <div class="feature-grid">
            <div class="feature-card">
                <div class="feature-icon">💻</div>
                <h3>Code Execution</h3>
                <p>Run your code in a safe, isolated environment</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🎨</div>
                <h3>Live Preview</h3>
                <p>See your HTML rendered in real-time</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <h3>Fast Compilation</h3>
                <p>Instant feedback and error detection</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🔧</div>
                <h3>Code Formatting</h3>
                <p>Automatically format your code for readability</p>
            </div>
        </div>
    </div>

    <script>
        let count = 0;
        
        function incrementCounter() {
            count++;
            document.getElementById('counter').textContent = count;
        }
        
        function resetCounter() {
            count = 0;
            document.getElementById('counter').textContent = count;
        }
        
        // Add some interactive effects
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('click', () => {
                card.style.background = 'rgba(255, 255, 255, 0.4)';
                setTimeout(() => {
                    card.style.background = 'rgba(255, 255, 255, 0.2)';
                }, 200);
            });
        });
    </script>
</body>
</html>`,

            c: `// Welcome to Raiden AI Code Playground
// Professional C Compiler Environment

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Function to calculate Fibonacci number
int fibonacci(int n) {
    if (n <= 1) {
        return n;
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}

// Function to calculate factorial
int factorial(int n) {
    if (n == 0) {
        return 1;
    } else {
        return n * factorial(n - 1);
    }
}

// Function to check if a number is prime
int isPrime(int n) {
    if (n <= 1) return 0;
    if (n <= 3) return 1;
    if (n % 2 == 0 || n % 3 == 0) return 0;
    
    for (int i = 5; i * i <= n; i += 6) {
        if (n % i == 0 || n % (i + 2) == 0) {
            return 0;
        }
    }
    return 1;
}

// Function to reverse a string
void reverseString(char* str) {
    int length = strlen(str);
    for (int i = 0; i < length / 2; i++) {
        char temp = str[i];
        str[i] = str[length - 1 - i];
        str[length - 1 - i] = temp;
    }
}

int main() {
    printf("=== Raiden AI C Code Playground ===\\n\\n");
    
    // Test Fibonacci
    printf("Fibonacci sequence (first 10 numbers):\\n");
    for (int i = 0; i < 10; i++) {
        printf("F(%d) = %d\\n", i, fibonacci(i));
    }
    
    // Test factorial
    printf("\\nFactorial of 5: %d\\n", factorial(5));
    
    // Test prime numbers
    printf("\\nPrime numbers between 1 and 20:\\n");
    for (int i = 1; i <= 20; i++) {
        if (isPrime(i)) {
            printf("%d ", i);
        }
    }
    printf("\\n");
    
    // Test string reversal
    char str[] = "Hello, Raiden AI!";
    printf("\\nOriginal string: %s\\n", str);
    reverseString(str);
    printf("Reversed string: %s\\n", str);
    
    // Array operations
    int arr[] = {64, 34, 25, 12, 22, 11, 90};
    int n = sizeof(arr) / sizeof(arr[0]);
    
    printf("\\nArray before sorting: ");
    for (int i = 0; i < n; i++) {
        printf("%d ", arr[i]);
    }
    
    // Simple bubble sort
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
    
    printf("\\nArray after sorting: ");
    for (int i = 0; i < n; i++) {
        printf("%d ", arr[i]);
    }
    printf("\\n");
    
    return 0;
}`
        };
        
        codeInput.value = examples[language] || examples.python;
    }
    
    function setupCodeEditor() {
        // Set tab size
        codeInput.style.tabSize = '4';
        codeInput.style.webkitTabSize = '4';
        codeInput.style.mozTabSize = '4';
    }
    
    function handleCodeEditorKeydown(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            const value = codeInput.value;
            if (e.shiftKey) {
                // Handle shift+tab (unindent)
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = value.indexOf('\n', end);
                const lineEndPos = lineEnd === -1 ? value.length : lineEnd;
                const line = value.substring(lineStart, lineEndPos);
                if (line.startsWith('    ')) {
                    const newLine = line.substring(4);
                    const newValue = value.substring(0, lineStart) + newLine + value.substring(lineEndPos);
                    codeInput.value = newValue;
                    codeInput.selectionStart = Math.max(start - 4, lineStart);
                    codeInput.selectionEnd = Math.max(end - 4, lineStart);
                }
            } else {
                // Handle tab (indent)
                const newValue = value.substring(0, start) + '    ' + value.substring(end);
                codeInput.value = newValue;
                codeInput.selectionStart = codeInput.selectionEnd = start + 4;
            }
        } else if (e.key === 'Enter') {
            // Auto-indent on Enter, language-aware
            const start = codeInput.selectionStart;
            const value = codeInput.value;
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const currentLine = value.substring(lineStart, start);
            const indentMatch = currentLine.match(/^(\s*)/);
            const currentIndent = indentMatch ? indentMatch[1] : '';
            const language = languageSelect.value;
            let shouldIndent = false;
            if (language === 'python') {
                shouldIndent = /:\s*$/.test(currentLine.trim()) ||
                    /^\s*(def|class|if|elif|else|try|except|finally|with|for|while)\b/.test(currentLine.trim());
            } else if (language === 'javascript' || language === 'c') {
                shouldIndent = /{\s*$/.test(currentLine.trim());
            } else if (language === 'html') {
                shouldIndent = /<[^\/!][^>]*?>\s*$/.test(currentLine.trim()) && !/\/>\s*$/.test(currentLine.trim());
            }
            if (shouldIndent) {
                const newIndent = currentIndent + '    ';
                const newValue = value.substring(0, start) + '\n' + newIndent + value.substring(end);
                codeInput.value = newValue;
                codeInput.selectionStart = codeInput.selectionEnd = start + 1 + newIndent.length;
                e.preventDefault();
            }
        }
    }
    
    function handleCodeEditorInput(e) {
        // Auto-format code on input, language-aware
        const value = codeInput.value;
        const language = languageSelect.value;
        let formattedValue = value;
        if (language === 'python') {
            formattedValue = formatPythonCode(value);
        } else if (language === 'javascript') {
            formattedValue = formatJavaScriptCode(value);
        } else if (language === 'html') {
            formattedValue = formatHTMLCode(value);
        } else if (language === 'c') {
            formattedValue = formatCCode(value);
        }
        if (formattedValue !== value) {
            const cursorPos = codeInput.selectionStart;
            codeInput.value = formattedValue;
            codeInput.selectionStart = codeInput.selectionEnd = cursorPos;
        }
    }
    
    function formatCode() {
        const language = languageSelect.value;
        let code = codeInput.value;
        
        if (language === 'python') {
            code = formatPythonCode(code);
        } else if (language === 'javascript') {
            code = formatJavaScriptCode(code);
        } else if (language === 'html') {
            code = formatHTMLCode(code);
        } else if (language === 'c') {
            code = formatCCode(code);
        }
        
        codeInput.value = code;
        
        // Show a brief success message
        const formatBtn = document.getElementById('formatCodeBtn');
        const originalText = formatBtn.innerHTML;
        formatBtn.innerHTML = '<i class="fas fa-check"></i>';
        formatBtn.style.background = 'rgba(76, 209, 55, 0.2)';
        formatBtn.style.borderColor = '#4cd137';
        formatBtn.style.color = '#4cd137';
        
        setTimeout(() => {
            formatBtn.innerHTML = originalText;
            formatBtn.style.background = '';
            formatBtn.style.borderColor = '';
            formatBtn.style.color = '';
        }, 1000);
    }
    
    function formatPythonCode(code) {
        const lines = code.split('\n');
        let indentLevel = 0;
        const formattedLines = [];
        for (let i = 0; i < lines.length; i++) {
            let originalLine = lines[i];
            let line = originalLine.replace(/\s+$/, ''); // Only trim trailing spaces
            // Skip empty lines
            if (!line.trim()) {
                formattedLines.push('');
                continue;
            }
            // Handle comments
            if (line.trim().startsWith('#')) {
                formattedLines.push(line);
                continue;
            }
            // Do not forcibly re-indent; just preserve user indentation
            formattedLines.push(line);
        }
        return formattedLines.join('\n');
    }
    
    function formatJavaScriptCode(code) {
        // Basic JavaScript formatting
        const lines = code.split('\n');
        let indentLevel = 0;
        const formattedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (!line) {
                formattedLines.push('');
                continue;
            }
            
            // Handle comments
            if (line.startsWith('//') || line.startsWith('/*')) {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
                continue;
            }
            
            // Handle indentation changes
            if (line.includes('{')) {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
                indentLevel++;
            } else if (line.includes('}')) {
                indentLevel = Math.max(0, indentLevel - 1);
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
            } else {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
            }
        }
        
        return formattedLines.join('\n');
    }
    
    function formatHTMLCode(code) {
        // Basic HTML formatting
        const lines = code.split('\n');
        let indentLevel = 0;
        const formattedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (!line) {
                formattedLines.push('');
                continue;
            }
            
            // Handle comments
            if (line.startsWith('<!--')) {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
                continue;
            }
            
            // Handle indentation changes
            if (line.startsWith('</')) {
                indentLevel = Math.max(0, indentLevel - 1);
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
            } else if (line.includes('<') && !line.includes('</') && !line.endsWith('/>')) {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
                indentLevel++;
            } else {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
            }
        }
        
        return formattedLines.join('\n');
    }
    
    function formatCCode(code) {
        // Basic C formatting
        const lines = code.split('\n');
        let indentLevel = 0;
        const formattedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (!line) {
                formattedLines.push('');
                continue;
            }
            
            // Handle comments
            if (line.startsWith('//') || line.startsWith('/*')) {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
                formattedLines.push('');
                continue;
            }
            
            // Handle indentation changes
            if (line.includes('{')) {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
                indentLevel++;
            } else if (line.includes('}')) {
                indentLevel = Math.max(0, indentLevel - 1);
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
            } else {
                formattedLines.push(' '.repeat(indentLevel * 4) + line);
            }
        }
        
        return formattedLines.join('\n');
    }

    async function runCode() {
        const code = codeInput.value.trim();
        const language = languageSelect.value;
        
        if (!code) {
            codeExplanation.innerHTML = '<div style="color: #aaa;">Please enter some code to execute</div>';
            return;
        }

        runCodeBtn.disabled = true;
        runCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Compiling...';
        
        // Hide HTML preview for non-HTML code
        if (language !== 'html') {
            htmlPreview.style.display = 'none';
        }
        
        try {
            const response = await fetch('/code_playground/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language })
            });
            
            const data = await response.json();
            
            if (data.error) {
                // Enhanced error display
                let cleanError = data.error
                    .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
                    .replace(/\\"/g, '"') // Unescape quotes
                    .replace(/\\'/g, "'") // Unescape single quotes
                    .replace(/\*\*/g, '') // Remove markdown bold markers
                    .replace(/''/g, '') // Remove double single quotes
                    .replace(/""/g, '') // Remove double quotes
                    .trim();
                
                codeExplanation.innerHTML = `
                    <div style="margin-bottom: 20px;">
                        <div style="color: #ff4757; font-weight: 600; font-size: 15px; margin-bottom: 8px;">
                            <i class="fas fa-exclamation-triangle"></i> Compilation Error:
                        </div>
                        <div style="white-space: pre-wrap; line-height: 1.5; font-family: 'Courier New', monospace; background: rgba(255, 71, 87, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 71, 87, 0.3); font-size: 14px; color: #ff6b6b;">${cleanError}</div>
                    </div>
                `;
            } else {
                // Enhanced output formatting for professional compiler-like experience
                let outputSections = [];
                
                // Compilation status
                const compilationStatus = data.error ? 'Failed' : 'Successful';
                const statusColor = data.error ? '#ff4757' : '#4cd137';
                const statusIcon = data.error ? 'fa-exclamation-triangle' : 'fa-check-circle';
                
                outputSections.push(`
                    <div style="margin-bottom: 15px;">
                        <div style="color: ${statusColor}; font-weight: 600; font-size: 15px; margin-bottom: 8px;">
                            <i class="fas ${statusIcon}"></i> Compilation Status: ${compilationStatus}
                        </div>
                    </div>
                `);
                
                // Program output (if any)
                if (data.output && data.output.trim()) {
                    // Clean up the output by removing unwanted quotes and formatting
                    let cleanOutput = data.output
                        .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
                        .replace(/\\"/g, '"') // Unescape quotes
                        .replace(/\\'/g, "'") // Unescape single quotes
                        .replace(/\*\*/g, '') // Remove markdown bold markers
                        .replace(/''/g, '') // Remove double single quotes
                        .replace(/""/g, '') // Remove double quotes
                        .trim();
                    
                    outputSections.push(`
                    <div style="margin-bottom: 15px;">
                        <div style="color: var(--accent); font-weight: 600; font-size: 15px; margin-bottom: 8px;">
                                <i class="fas fa-terminal"></i> Program Output:
                        </div>
                            <div style="white-space: pre-wrap; line-height: 1.5; font-family: 'Courier New', monospace; background: rgba(30, 30, 45, 0.8); padding: 12px; border-radius: 8px; border: 1px solid rgba(170, 126, 238, 0.3); font-size: 14px; color: #e0e0e0; max-height: 200px; overflow-y: auto;">${cleanOutput}</div>
                    </div>
                    `);
                }
                
                // Return value (if any)
                if (data.return_value !== null && data.return_value !== undefined) {
                    // Clean up the return value
                    let cleanReturnValue = String(data.return_value)
                        .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
                        .replace(/\\"/g, '"') // Unescape quotes
                        .replace(/\\'/g, "'") // Unescape single quotes
                        .replace(/\*\*/g, '') // Remove markdown bold markers
                        .replace(/''/g, '') // Remove double single quotes
                        .replace(/""/g, '') // Remove double quotes
                        .trim();
                    
                    outputSections.push(`
                        <div style="margin-bottom: 15px;">
                            <div style="color: #4cd137; font-weight: 600; font-size: 15px; margin-bottom: 8px;">
                                <i class="fas fa-arrow-right"></i> Return Value:
                            </div>
                            <div style="white-space: pre-wrap; line-height: 1.5; font-family: 'Courier New', monospace; background: rgba(76, 209, 55, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(76, 209, 55, 0.3); font-size: 14px; color: #4cd137;">${cleanReturnValue}</div>
                        </div>
                    `);
                }
                
                // Result statement
                if (data.result_statement) {
                    // Clean up the result statement
                    let cleanResultStatement = data.result_statement
                        .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
                        .replace(/\\"/g, '"') // Unescape quotes
                        .replace(/\\'/g, "'") // Unescape single quotes
                        .replace(/\*\*/g, '') // Remove markdown bold markers
                        .replace(/''/g, '') // Remove double single quotes
                        .replace(/""/g, '') // Remove double quotes
                        .trim();
                    
                    outputSections.push(`
                        <div style="margin-bottom: 15px;">
                            <div style="color: var(--accent); font-weight: 600; font-size: 15px; margin-bottom: 8px;">
                                <i class="fas fa-info-circle"></i> Execution Summary:
                            </div>
                            <div style="white-space: pre-wrap; line-height: 1.5; font-family: 'Courier New', monospace; background: rgba(30, 30, 45, 0.8); padding: 12px; border-radius: 8px; border: 1px solid rgba(170, 126, 238, 0.3); font-size: 14px; color: #e0e0e0;">${cleanResultStatement}</div>
                        </div>
                    `);
                }
                
                // Code analysis
                if (data.explanation) {
                    // Clean up the explanation
                    let cleanExplanation = data.explanation
                        .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
                        .replace(/\\"/g, '"') // Unescape quotes
                        .replace(/\\'/g, "'") // Unescape single quotes
                        .replace(/\*\*/g, '') // Remove markdown bold markers
                        .replace(/''/g, '') // Remove double single quotes
                        .replace(/""/g, '') // Remove double quotes
                        .trim();
                    
                    outputSections.push(`
                        <div style="margin-bottom: 15px;">
                            <div style="color: var(--accent); font-weight: 600; font-size: 15px; margin-bottom: 8px;">
                                <i class="fas fa-lightbulb"></i> Code Analysis:
                            </div>
                            <div style="white-space: pre-wrap; line-height: 1.6; font-size: 15px; color: rgba(255, 255, 255, 0.9); background: rgba(30, 30, 45, 0.5); padding: 15px; border-radius: 8px; border: 1px solid rgba(170, 126, 238, 0.2);">${cleanExplanation}</div>
                        </div>
                    `);
                }
                
                // Combine all sections
                codeExplanation.innerHTML = outputSections.join('');
                
                // Show HTML preview for HTML code
                if (language === 'html') {
                    htmlPreview.style.display = 'block';
                    const blob = new Blob([code], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    previewFrame.src = url;
                }
            }
        } catch (error) {
            console.error('Error:', error);
            codeExplanation.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <div style="color: #ff4757; font-weight: 600; font-size: 15px; margin-bottom: 8px;">
                        <i class="fas fa-exclamation-triangle"></i> System Error:
                    </div>
                    <div style="white-space: pre-wrap; line-height: 1.5; font-family: 'Courier New', monospace; background: rgba(255, 71, 87, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 71, 87, 0.3); font-size: 14px; color: #ff6b6b;">Failed to execute code. Please try again.</div>
                </div>
            `;
        } finally {
            runCodeBtn.disabled = false;
            runCodeBtn.innerHTML = 'Compile & Run';
        }
    }

    // ===== Math Solver =====
    function initMathSolver() {
        solveMathBtn.addEventListener('click', solveMath);
        
        mathSymbolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                mathInput.value += btn.textContent;
            });
        });
    }

    function solveMath() {
        const equation = mathInput.value.trim();
        if (!equation) {
            document.getElementById('math-result-block').innerHTML = '<div style="color: #aaa;">Please enter an equation</div>';
            document.getElementById('math-explanation-block').innerHTML = '';
            return;
        }

        solveMathBtn.disabled = true;
        solveMathBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Solving...';

        fetch('/solve_math', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equation })
        })
        .then(response => response.json())
        .then(data => {
            const resultBlock = document.getElementById('math-result-block');
            const explanationBlock = document.getElementById('math-explanation-block');
            if (data.error) {
                resultBlock.innerHTML = `<div style="background: rgba(255, 71, 87, 0.15); color: #ff4757; border: 1px solid #ff4757; border-radius: 8px; padding: 12px 24px; font-weight: 600; display: inline-block; text-align: center;">${data.error}</div>`;
                explanationBlock.innerHTML = '';
            } else {
                // Format result as a single green block, centered
                const formattedSolution = data.solution || 'No solution available';
                const formattedExplanation = data.explanation || '';
                const isError = formattedSolution.includes('Calculation Error') || formattedSolution.includes('Error');
                resultBlock.innerHTML = `<div style="background: ${isError ? 'rgba(255, 71, 87, 0.15)' : 'rgba(76, 209, 55, 0.15)'}; color: ${isError ? '#ff4757' : '#4cd137'}; border: 1px solid ${isError ? '#ff4757' : '#4cd137'}; border-radius: 8px; padding: 12px 24px; font-weight: 600; display: inline-block; text-align: center;">${formattedSolution}</div>`;
                // Remove 'Detailed Solution' header and bring 'Problem Analysis' to top
                let explanationHTML = formattedExplanation;
                explanationHTML = explanationHTML.replace(/<div[^>]*class=["']?math-explanation-header["']?[^>]*>.*?<\/div>/gi, ''); // Remove header if present
                explanationHTML = explanationHTML.replace(/<h3>Detailed Solution<\/h3>/gi, ''); // Remove header if present
                // Move 'Problem Analysis' to top if not already
                explanationBlock.innerHTML = explanationHTML;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('math-result-block').innerHTML = '<div style="color: #ff4757;">Failed to solve equation</div>';
            document.getElementById('math-explanation-block').innerHTML = '';
        })
        .finally(() => {
            solveMathBtn.disabled = false;
            solveMathBtn.innerHTML = 'Solve';
        });
    }

    // ===== PDF Summarizer =====
    function initPDFSummarizer() {
        pdfUploadBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.pdf';
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const formData = new FormData();
                formData.append('file', file);
                
                pdfUploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                
                fetch('/summarize_pdf', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        showError(data.error);
                    } else {
                        // Format the summary with proper structure
                        const formattedSummary = data.summary || 'No summary generated';
                        addMessage(`
                            <div style="margin-bottom: 15px;">
                                <h3 style="color: var(--accent); margin-bottom: 15px;">
                                    <i class="fas fa-file-pdf"></i> PDF Summary: ${file.name}
                                </h3>
                                <div style="white-space: pre-wrap; line-height: 1.6;">
                                    ${formattedSummary}
                                </div>
                            </div>
                        `, 'ai');
                        scrollToBottom();
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showError('Failed to summarize PDF');
                })
                .finally(() => {
                    pdfUploadBtn.innerHTML = '<i class="fas fa-file-upload"></i> Upload PDF';
                });
            });
            
            fileInput.click();
        });
    }

    // ===== Study Planner =====
    function initStudyPlanner() {
        loadTasks('today');
        
        addTaskBtn.addEventListener('click', showAddTaskModal);
        
        plannerNavBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                plannerNavBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadTasks(btn.dataset.period);
            });
        });
    }

    function loadTasks(period) {
        taskList.innerHTML = '<div class="loading">Loading tasks...</div>';
        
        fetch(`/study_planner/tasks?period=${period}`)
            .then(response => response.json())
            .then(data => {
                currentTasks = data.tasks || [];
                renderTasks(currentTasks);
                updateTaskStats();
            })
            .catch(error => {
                console.error('Error loading tasks:', error);
                taskList.innerHTML = '<div class="error-message">Failed to load tasks</div>';
            });
    }

    function renderTasks(tasks) {
        if (tasks.length === 0) {
            taskList.innerHTML = `
                <div class="no-tasks">
                    <i class="fas fa-calendar-plus"></i>
                    <p>No tasks found</p>
                    <button class="add-first-task" id="addFirstTask">Add Your First Task</button>
                </div>
            `;
            document.getElementById('addFirstTask').addEventListener('click', showAddTaskModal);
            return;
        }

        taskList.innerHTML = '';
        tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${task.completed ? 'task-completed' : ''}`;
            taskElement.innerHTML = `
                <div class="task-info">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                        data-task-id="${task.id}">
                    <div class="task-details">
                        <div class="task-title">${task.task}</div>
                        <div class="task-due">Due: ${formatDate(task.due_date)}</div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn delete-task" data-task-id="${task.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            taskList.appendChild(taskElement);
        });

        // Add event listeners
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', toggleTaskCompletion);
        });

        document.querySelectorAll('.delete-task').forEach(btn => {
            btn.addEventListener('click', deleteTask);
        });
    }

    function toggleTaskCompletion(e) {
        const taskId = e.target.dataset.taskId;
        const completed = e.target.checked;
        const taskTitle = e.target.closest('.task-item').querySelector('.task-title').textContent;
        
        fetch(`/study_planner/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.message) {
                loadTasks(document.querySelector('.planner-nav-btn.active').dataset.period);
                showTaskNotification(`Task marked as ${completed ? 'completed' : 'pending'}: "${taskTitle}"`, 'success');
            }
        })
        .catch(error => {
            console.error('Error updating task:', error);
            showError('Failed to update task');
            e.target.checked = !completed; // Revert checkbox
        });
    }

    function deleteTask(e) {
        const taskId = e.currentTarget.dataset.taskId;
        const taskTitle = e.currentTarget.closest('.task-item').querySelector('.task-title').textContent;
        
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        fetch(`/study_planner/tasks/${taskId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                loadTasks(document.querySelector('.planner-nav-btn.active').dataset.period);
                showTaskNotification(`Task deleted: "${taskTitle}"`, 'success');
            }
        })
        .catch(error => {
            console.error('Error deleting task:', error);
            showError('Failed to delete task');
        });
    }

    function showAddTaskModal() {
        const existingModal = document.querySelector('.task-modal');
        if (existingModal) existingModal.remove();

        const modalHTML = `
            <div class="task-modal">
                <div class="modal-content">
                    <h3>Add New Task</h3>
                    <div class="form-group">
                        <label>Task Description</label>
                        <input type="text" id="taskDescription" placeholder="What needs to be done?">
                    </div>
                    <div class="form-group">
                        <label>Due Date & Time</label>
                        <input type="datetime-local" id="taskDueDate">
                    </div>
                    <div class="form-group">
                        <label>Priority</label>
                        <select id="taskPriority">
                            <option value="1">Low</option>
                            <option value="2">Medium</option>
                            <option value="3">High</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button class="modal-btn cancel-btn" id="cancelTask">Cancel</button>
                        <button class="modal-btn confirm-btn" id="saveTask">Save Task</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('cancelTask').addEventListener('click', () => {
            document.querySelector('.task-modal').remove();
        });

        document.getElementById('saveTask').addEventListener('click', saveTask);
    }

    function saveTask() {
        const description = document.getElementById('taskDescription').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const priority = document.getElementById('taskPriority').value;
        if (!description || !dueDate) {
            showError('Please fill in all required fields');
            return;
        }
        fetch('/study_planner/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                task: description, 
                due_date: dueDate, 
                priority 
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                document.querySelector('.task-modal').remove();
                loadTasks(document.querySelector('.planner-nav-btn.active').dataset.period);
                // Set flag for last added task
                lastTaskAddedDesc = description;
                lastTaskAddedTime = Date.now();
            }
        })
        .catch(error => {
            console.error('Error adding task:', error);
            showError('Failed to add task');
        });
    }

    function updateTaskStats() {
        const completed = currentTasks.filter(task => task.completed).length;
        const pending = currentTasks.length - completed;
        
        completedCount.textContent = completed;
        pendingCount.textContent = pending;
    }

    function formatDate(dateString) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
        };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // ===== Lecture Transcriber =====
    function initLectureTranscriber() {
        const clearBtn = document.getElementById('clear-transcript');
        const copyBtn = document.getElementById('copy-transcript');
        const generateSlidesBtn = document.getElementById('generate-slides');
        const recordingStatus = document.getElementById('recording-status');
        const statusIndicator = recordingStatus?.querySelector('.status-indicator');
        const statusText = recordingStatus?.querySelector('.status-text');

        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const transcriptText = document.getElementById('transcript-text');
                if (finalTranscript || interimTranscript) {
                    transcriptText.innerHTML = finalTranscript + interimTranscript;
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                stopRecording();
                showError('Voice input error: ' + event.error);
            };

            recognition.onend = () => {
                if (isRecording) {
                    recognition.start();
                }
            };

            recordBtn.addEventListener('click', toggleRecording);
            clearBtn.addEventListener('click', clearTranscript);
            copyBtn.addEventListener('click', copyTranscript);
            generateSlidesBtn.addEventListener('click', generateSlidesFromTranscript);
        } else {
            recordBtn.style.display = 'none';
            const transcriptText = document.getElementById('transcript-text');
            transcriptText.innerHTML = `
                <div class="transcript-placeholder">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Speech recognition not supported in your browser. Please try Chrome or Edge.</p>
                </div>
            `;
        }
    }

    function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    function startRecording() {
        isRecording = true;
        recordBtn.classList.add('recording');
        recordBtn.innerHTML = '<i class="fas fa-stop"></i><span class="btn-text">Stop Recording</span>';
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        if (statusIndicator) statusIndicator.classList.add('recording');
        if (statusText) statusText.textContent = 'Recording...';
        
        const transcriptText = document.getElementById('transcript-text');
        transcriptText.innerHTML = '<div style="color: var(--accent);">Listening... (Recording in progress)</div>';
        
        recognition.start();
        
        fetch('/transcribe/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            transcriptSessionId = data.session_id;
        })
        .catch(error => {
            console.error('Error starting transcription:', error);
        });
    }

    function stopRecording() {
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '<i class="fas fa-microphone"></i><span class="btn-text">Start Recording</span>';
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        if (statusIndicator) statusIndicator.classList.remove('recording');
        if (statusText) statusText.textContent = 'Ready to record';
        
        recognition.stop();
        
        if (transcriptSessionId) {
            fetch('/transcribe/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: transcriptSessionId })
            })
            .catch(error => {
                console.error('Error stopping transcription:', error);
            });
        }
    }

    function clearTranscript() {
        const transcriptText = document.getElementById('transcript-text');
        transcriptText.innerHTML = `
            <div class="transcript-placeholder">
                <i class="fas fa-microphone-slash"></i>
                <p>Click "Start Recording" to begin transcription...</p>
            </div>
        `;
        
        const slidePreview = document.getElementById('slide-preview');
        slidePreview.innerHTML = `
            <div class="slide-preview-placeholder">
                <i class="fas fa-file-powerpoint"></i>
                <p>Generated slides will appear here...</p>
            </div>
        `;
    }

    function copyTranscript() {
        const transcript = document.getElementById('transcript-text').textContent;
        if (!transcript || transcript.includes('Click "Start Recording"')) {
            showError('No transcript to copy');
            return;
        }
        
        navigator.clipboard.writeText(transcript)
            .then(() => {
                const copyBtn = document.getElementById('copy-transcript');
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => { 
                    copyBtn.innerHTML = originalHTML; 
                }, 2000);
                showNotification('Transcript copied to clipboard!', 'success');
            })
            .catch(error => {
                console.error('Failed to copy transcript:', error);
                showError('Failed to copy transcript');
            });
    }

    function generateSlidesFromTranscript() {
        const transcript = document.getElementById('transcript-text').textContent;
        if (!transcript || transcript.includes('Click "Start Recording"')) {
            showError('Please record some audio first');
            return;
        }

        generateSlidesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        generateSlidesBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('transcript', transcript);
        
        fetch('/transcribe/generate_slides', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
            } else {
                slidePreview.innerHTML = `
                    <div class="slides-preview-header">
                        <h3><i class="fas fa-file-powerpoint"></i> Generated Slides Preview</h3>
                        <div class="slides-actions">
                            <button class="slide-action-btn" onclick="exportSlides()">
                                <i class="fas fa-download"></i> Export
                            </button>
                            <button class="slide-action-btn" onclick="copySlides()">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                    <div class="slides-container">
                        ${formatSlides(data.slides)}
                    </div>
                `;
                showNotification('Slides generated successfully!', 'success');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('Failed to generate slides');
        })
        .finally(() => {
            generateSlidesBtn.innerHTML = '<i class="fas fa-file-powerpoint"></i> Generate Slides';
            generateSlidesBtn.disabled = false;
        });
    }

    function formatSlides(slidesText) {
        // Split the text into slides based on markdown headers
        const slides = slidesText.split(/(?=^#\s+)/m).filter(slide => slide.trim());
        
        return slides.map((slide, index) => {
            const lines = slide.trim().split('\n');
            const title = lines[0].replace(/^#\s+/, '');
            const content = lines.slice(1).join('\n');
            
            return `
                <div class="slide" data-slide="${index + 1}">
                    <div class="slide-header">
                        <div class="slide-number">Slide ${index + 1}</div>
                        <div class="slide-title">${title}</div>
                    </div>
                    <div class="slide-content">
                        ${formatSlideContent(content)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function formatSlideContent(content) {
        if (!content.trim()) return '<p class="slide-empty">No content</p>';
        
        return content
            .replace(/^-\s+(.*$)/gm, '<li>$1</li>')
            .replace(/^•\s+(.*$)/gm, '<li>$1</li>')
            .replace(/^(\d+\.)\s+(.*$)/gm, '<li>$1 $2</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/<li>.*?<\/li>/g, match => {
                // Group consecutive list items
                const items = match.match(/<li>.*?<\/li>/g);
                if (items && items.length > 1) {
                    return `<ul>${items.join('')}</ul>`;
                }
                return `<ul>${match}</ul>`;
            })
            .replace(/^(?!<[uo]l>|<li>)(.*?)(?=<[uo]l>|<li>|$)/gm, '<p>$1</p>')
            .replace(/<p><\/p>/g, '')
            .replace(/<p>(.*?)<\/p>/g, (match, content) => {
                if (content.trim()) return match;
                return '';
            });
    }

    // Add global functions for slide actions
    window.exportSlides = function() {
        const slidesContent = document.querySelector('.slides-container').innerText;
        const blob = new Blob([slidesContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lecture-slides.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('Slides exported successfully!', 'success');
    };

    window.copySlides = function() {
        const slidesContent = document.querySelector('.slides-container').innerText;
        navigator.clipboard.writeText(slidesContent)
            .then(() => {
                showNotification('Slides copied to clipboard!', 'success');
            })
            .catch(error => {
                console.error('Failed to copy slides:', error);
                showError('Failed to copy slides');
            });
    };

    // ===== Attendance Tracker =====
    function initAttendanceTracker() {
        const calendarContainer = document.querySelector('.attendance-calendar');
        const exportBtn = document.querySelector('.attendance-actions button:first-child');
        const addRecordBtn = document.querySelector('.attendance-actions button:last-child');
        const statsContainer = document.querySelector('.attendance-stats');
        const currentMonthDisplay = document.getElementById('current-month');
        const prevMonthBtn = document.getElementById('prev-month');
        const nextMonthBtn = document.getElementById('next-month');
        
        let currentDate = new Date();
        let attendanceRecords = [];
        
        // Initialize calendar with current month
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
        
        // Add navigation event listeners
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
        });
        
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
        });
        
        exportBtn.addEventListener('click', exportAttendance);
        addRecordBtn.addEventListener('click', showAddRecordModal);
        
        const socket = io();
        socket.on('attendance_update', handleAttendanceUpdate);
        
        function renderCalendar(year, month) {
            calendarContainer.innerHTML = '';
            
            // Update month display
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                               'July', 'August', 'September', 'October', 'November', 'December'];
            currentMonthDisplay.textContent = `${monthNames[month - 1]} ${year}`;
            
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            days.forEach(day => {
                const header = document.createElement('div');
                header.className = 'calendar-header';
                header.textContent = day;
                calendarContainer.appendChild(header);
            });
            
            const firstDay = new Date(year, month - 1, 1).getDay();
            const daysInMonth = new Date(year, month, 0).getDate();
            
            for (let i = 0; i < firstDay; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'calendar-day empty';
                calendarContainer.appendChild(emptyCell);
            }
            
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const dayCell = document.createElement('div');
                dayCell.className = 'calendar-day';
                dayCell.textContent = day;
                dayCell.dataset.date = dateStr;
                
                const today = new Date();
                if (year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate()) {
                    dayCell.classList.add('today');
                }
                
                const record = attendanceRecords.find(r => r.date === dateStr);
                if (record) {
                    dayCell.classList.add(record.status);
                    dayCell.title = record.notes || record.status;
                }
                
                dayCell.addEventListener('click', () => showDayDetails(dateStr));
                calendarContainer.appendChild(dayCell);
            }
            
            loadAttendanceData(year, month);
        }
        
        function loadAttendanceData(year, month) {
            fetch(`/attendance?year=${year}&month=${month}`)
                .then(response => response.json())
                .then(data => {
                    attendanceRecords = data.attendance;
                    updateStats(data.stats);
                    highlightCalendarDays();
                })
                .catch(error => {
                    console.error('Error loading attendance data:', error);
                });
        }
        
        function updateStats(stats) {
            const total = stats.total || 0;
            const present = stats.present || 0;
            const absent = stats.absent || 0;
            const late = stats.late || 0;
            
            const presentPercentage = total > 0 ? Math.round((present / total) * 100) : 0;
            const absentPercentage = total > 0 ? Math.round((absent / total) * 100) : 0;
            
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${presentPercentage}%</div>
                    <div class="stat-label">Present</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${absentPercentage}%</div>
                    <div class="stat-label">Absent</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${late}</div>
                    <div class="stat-label">Late</div>
                </div>
            `;
        }
        
        function highlightCalendarDays() {
            document.querySelectorAll('.calendar-day').forEach(dayCell => {
                const dateStr = dayCell.dataset.date;
                if (dateStr) {
                    const record = attendanceRecords.find(r => r.date === dateStr);
                    if (record) {
                        dayCell.classList.add(record.status);
                        dayCell.title = record.notes || record.status;
                    } else {
                        dayCell.className = 'calendar-day';
                        if (dayCell.classList.contains('today')) {
                            dayCell.classList.add('today');
                        }
                    }
                }
            });
        }
        
        function showDayDetails(dateStr) {
            const record = attendanceRecords.find(r => r.date === dateStr);
            const date = new Date(dateStr);
            const dateFormatted = date.toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            });
            
            const modalHTML = `
                <div class="attendance-modal">
                    <div class="modal-content">
                        <h3>Attendance for ${dateFormatted}</h3>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="attendance-status">
                                <option value="present" ${record?.status === 'present' ? 'selected' : ''}>Present</option>
                                <option value="absent" ${record?.status === 'absent' ? 'selected' : ''}>Absent</option>
                                <option value="late" ${record?.status === 'late' ? 'selected' : ''}>Late</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="attendance-notes">${record?.notes || ''}</textarea>
                        </div>
                        <div class="modal-actions">
                            ${record ? `<button class="modal-btn delete-btn" id="delete-attendance">Delete Record</button>` : ''}
                            <button class="modal-btn cancel-btn" id="cancel-attendance">Cancel</button>
                            <button class="modal-btn confirm-btn" id="save-attendance">Save</button>
                        </div>
                    </div>
                </div>
            `;
            
            const existingModal = document.querySelector('.attendance-modal');
            if (existingModal) existingModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            document.getElementById('cancel-attendance').addEventListener('click', () => {
                document.querySelector('.attendance-modal').remove();
            });
            
            document.getElementById('save-attendance').addEventListener('click', () => {
                saveAttendanceRecord(dateStr);
            });
            
            if (record) {
                document.getElementById('delete-attendance').addEventListener('click', () => {
                    deleteAttendanceRecord(record.id);
                });
            }
        }
        
        function saveAttendanceRecord(dateStr) {
            const status = document.getElementById('attendance-status').value;
            const notes = document.getElementById('attendance-notes').value;
            
            fetch('/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: dateStr, status, notes })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                document.querySelector('.attendance-modal').remove();
                const message = data.message || 'Attendance record saved successfully';
                showNotification(message, 'success');
            })
            .catch(error => {
                console.error('Error saving attendance:', error);
                showError('Failed to save attendance record');
            });
        }
        
        function deleteAttendanceRecord(recordId) {
            if (!confirm('Are you sure you want to delete this attendance record?')) return;
            
            fetch(`/attendance/${recordId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                document.querySelector('.attendance-modal').remove();
                const message = data.message || 'Attendance record deleted successfully';
                showNotification(message, 'success');
            })
            .catch(error => {
                console.error('Error deleting attendance:', error);
                showError('Failed to delete attendance record');
            });
        }
        
        function exportAttendance() {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            window.open(`/attendance/export?year=${year}&month=${month}&format=csv`, '_blank');
        }
        
        function showAddRecordModal() {
            const today = new Date().toISOString().split('T')[0];
            
            const modalHTML = `
                <div class="attendance-modal">
                    <div class="modal-content">
                        <h3>Add New Attendance Record</h3>
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" id="attendance-date" value="${today}">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="attendance-status">
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="late">Late</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="attendance-notes"></textarea>
                        </div>
                        <div class="modal-actions">
                            <button class="modal-btn cancel-btn" id="cancel-attendance">Cancel</button>
                            <button class="modal-btn confirm-btn" id="save-attendance">Save</button>
                        </div>
                    </div>
                </div>
            `;
            
            const existingModal = document.querySelector('.attendance-modal');
            if (existingModal) existingModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            document.getElementById('cancel-attendance').addEventListener('click', () => {
                document.querySelector('.attendance-modal').remove();
            });
            
            document.getElementById('save-attendance').addEventListener('click', () => {
                const dateStr = document.getElementById('attendance-date').value;
                saveAttendanceRecord(dateStr);
            });
        }
        
        function handleAttendanceUpdate(data) {
            if (data.action === 'added' || data.action === 'updated') {
                const index = attendanceRecords.findIndex(r => r.id === data.record.id);
                if (index >= 0) {
                    attendanceRecords[index] = data.record;
                } else {
                    attendanceRecords.push(data.record);
                }
            } else if (data.action === 'deleted') {
                attendanceRecords = attendanceRecords.filter(r => r.id !== data.record_id);
            }
            
            const recordDate = data.action !== 'deleted' ? new Date(data.record.date) : null;
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;
            
            if (!recordDate || (recordDate.getFullYear() === currentYear && recordDate.getMonth() + 1 === currentMonth)) {
                loadAttendanceData(currentYear, currentMonth);
            }
        }
    }

    // ===== WebSocket Notifications =====
    function initWebSocket() {
        const socket = io(window.location.origin);
        
        socket.on('connect', () => {
            console.log('Connected to WebSocket server');
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
            setTimeout(initWebSocket, 5000);
        });
        
        socket.on('connect_error', (error) => {
            console.log('WebSocket connection error:', error);
        });
        
        socket.on('task_update', (data) => {
            console.log('Task update:', data);
            switch(data.action) {
                case 'added':
                    // Only show notification if not just added by this client
                    if (!(lastTaskAddedDesc && data.task && data.task.task === lastTaskAddedDesc && Date.now() - lastTaskAddedTime < 2000)) {
                        showTaskNotification(`New task added: "${data.task.task}"`, 'success');
                    }
                    break;
                case 'updated':
                    showTaskNotification(`Task marked as ${data.task.completed ? 'completed' : 'pending'}: "${data.task.task}"`, 'success');
                    break;
                case 'deleted':
                    showTaskNotification(`Task deleted`, 'success');
                    break;
            }
        });
        
        socket.on('task_reminder', (data) => {
            console.log('Received reminder:', data);
            if (data.is_due) {
                showDueNotification(`Task is due now: "${data.task}"`, data.task_id);
            } else {
                const dueTime = new Date(data.due_date);
                const timeString = dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                showNotification(`Reminder: "${data.task}" is due at ${timeString}`, data.task_id);
            }
        });
    }

    function showTaskNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type === 'due' ? 'due-notification' : type === 'success' ? 'success-notification' : ''}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'due' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    function showDueNotification(message, taskId) {
        document.querySelectorAll('.notification').forEach(notification => {
            if (notification.dataset.taskId === taskId?.toString()) {
                notification.remove();
            }
        });
        
        const notification = document.createElement('div');
        notification.className = 'notification due-notification';
        notification.dataset.taskId = taskId;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
                <button class="mark-complete-btn">Mark Complete</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        notification.querySelector('.mark-complete-btn').addEventListener('click', () => {
            markTaskComplete(taskId);
            notification.remove();
        });
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.classList.add('fade-out');
                setTimeout(() => notification.remove(), 500);
            }
        }, 30000);
    }

    function markTaskComplete(taskId) {
        fetch(`/study_planner/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                loadTasks(document.querySelector('.planner-nav-btn.active').dataset.period);
            }
        })
        .catch(error => {
            console.error('Error updating task:', error);
            showError('Failed to update task');
        });
    }

    // ===== Helper Functions =====
    function showError(message) {
        // Show notification instead of adding to chat
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

    // Remove the typing cursor CSS if present
    const styleTags = document.querySelectorAll('style');
    styleTags.forEach(tag => {
        if (tag.innerHTML.includes('.ai-cursor')) {
            tag.remove();
        }
    });
});
// Add this at the very bottom of script.js
document.addEventListener('DOMContentLoaded', function() {
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    
    if (quickActionBtns.length >= 4) {
        // Button 1: Solve Math
        quickActionBtns[0].addEventListener('click', () => {
            // Click the Math nav item
            document.querySelector('.nav-item[data-panel="math"]').click();
            // Wait for panel to open, then insert equation and solve
            setTimeout(() => {
                const mathInput = document.getElementById('math-input');
                const solveBtn = document.querySelector('#math-panel .run-code');
                if (mathInput && solveBtn) {
                    mathInput.value = '2x + 5 = 15';
                    solveBtn.click();
                }
            }, 300);
        });

        // Button 2: Generate APA citation
        quickActionBtns[1].addEventListener('click', () => {
            document.querySelector('.nav-item[data-panel="citations"]').click();
        });

        // Button 3: Create study plan
        quickActionBtns[2].addEventListener('click', () => {
            document.querySelector('.nav-item[data-panel="planner"]').click();
        });

        // Button 4: Explain quantum physics
        quickActionBtns[3].addEventListener('click', () => {
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput && sendBtn) {
                messageInput.value = 'Explain quantum physics in simple terms.';
                sendBtn.click();
            }
        });
    }
});
