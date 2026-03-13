# Raiden AI Full Edition API

A comprehensive AI-powered API server built with Flask, featuring multiple AI capabilities including chat, math solving, PDF summarization, flashcards, task management, and more.

## Features

- 🤖 **AI Chat**: Powered by Groq's LLM models
- 📊 **Math Solver**: Advanced mathematical problem solving
- 📄 **PDF Summarization**: Extract and summarize PDF content
- 🗂️ **Flashcards**: Create and manage study flashcards
- 📋 **Task Management**: Study planner with reminders
- 📰 **News API**: Get latest news and headlines
- 🌤️ **Weather API**: Current weather and forecasts
- 🔍 **Web Search**: Search the web for information
- 📝 **Citation Generator**: Generate academic citations
- 📊 **Attendance Tracker**: Track attendance records

## Quick Start

### Option 1: Using the Setup Script (Recommended)

```bash
python setup.py
```

This will guide you through:
- Setting up your Groq API key
- Installing dependencies
- Starting the server

### Option 2: Manual Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Get a Groq API Key**:
   - Go to [https://console.groq.com/](https://console.groq.com/)
   - Sign up or log in
   - Create a new API key
   - Copy the key (starts with `gsk_`)

3. **Set Environment Variable**:
   ```bash
   # Windows
   set GROQ_API_KEY=your_api_key_here
   
   # Linux/Mac
   export GROQ_API_KEY=your_api_key_here
   ```

4. **Run the Server**:
   ```bash
   python server.py
   ```

### Option 3: Windows Batch File

Double-click `run_server.bat` to start the server.

## API Endpoints

### Core AI Features
- `POST /chat` - AI chat interface
- `POST /solve_math` - Mathematical problem solving
- `POST /summarize_pdf` - PDF summarization

### Study Tools
- `GET/POST /flashcards` - Manage flashcards
- `GET/POST /study_planner/tasks` - Task management
- `GET/POST /attendance` - Attendance tracking

### Information Services
- `GET /news` - Latest news
- `GET /weather` - Current weather
- `POST /search-web` - Web search

### Utilities
- `POST /code_playground/run` - Code execution
- `POST /citation/generate` - Citation generation

## Web Interface

Once the server is running, visit:
- **Main Interface**: http://localhost:5000
- **API Documentation**: Available through the web interface

## Configuration

### Environment Variables
- `GROQ_API_KEY`: Your Groq API key (required for AI features)
- `GNEWS_API_KEY`: News API key (pre-configured)
- `OPENWEATHER_API_KEY`: Weather API key (pre-configured)

### Database
The application uses SQLite for data storage. The database file (`raiden.db`) is created automatically.

## Troubleshooting

### Common Issues

1. **"No supported models available"**
   - Check your Groq API key is valid
   - Ensure you have sufficient credits in your Groq account

2. **Port 5000 already in use**
   - Change the port in `server.py` line 2008
   - Or kill the process using port 5000

3. **Import errors**
   - Run `pip install -r requirements.txt` again
   - Check Python version compatibility

### Getting Help

- Check the console output for error messages
- Ensure all dependencies are installed
- Verify your API keys are correct

## License

This project is for educational and personal use.

## Contributing

Feel free to submit issues and enhancement requests! 