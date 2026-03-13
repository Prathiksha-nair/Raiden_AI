@echo off
echo Starting Raiden AI Full Edition API...
echo.
echo If you haven't set up your Groq API key yet, please:
echo 1. Go to https://console.groq.com/
echo 2. Sign up or log in
echo 3. Create a new API key
echo 4. Set it as an environment variable: set GROQ_API_KEY=your_key_here
echo.
echo Starting server...
python server.py
pause 