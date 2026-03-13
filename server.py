from flask import Flask, request, jsonify, send_from_directory, render_template, g, make_response
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import datetime
import json
from groq import Groq
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr
import PyPDF2
from datetime import datetime, timedelta
from flask_socketio import SocketIO, emit
import threading
from apscheduler.schedulers.background import BackgroundScheduler
import sqlite3
from contextlib import closing
import uuid
import io
import csv
import requests
from bs4 import BeautifulSoup

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# API Keys
GNEWS_API_KEY = "c9b67ec1fd7152753492de6f37f459cf"
OPENWEATHER_API_KEY = "20d24bd6501929128da43c9e11051030"
# Safely get the API key from the environment (Render will provide this)
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')

# Database configuration
DATABASE = 'raiden.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    with app.app_context():
        with closing(get_db()) as db:
            # Create tasks table if not exists
            db.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task TEXT NOT NULL,
                    due_date TEXT NOT NULL,
                    priority INTEGER DEFAULT 2,
                    completed BOOLEAN DEFAULT FALSE,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create flashcards table if not exists
            db.execute("""
                CREATE TABLE IF NOT EXISTS flashcards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create attendance table if not exists
            db.execute("""
                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    status TEXT NOT NULL,  -- 'present', 'absent', 'late'
                    notes TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(date)  -- Ensure only one record per date
                );
            """)
            
            db.commit()

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.start()

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# ==========================================
# RENDER DEPLOYMENT INITIALIZATION
# ==========================================
# Create necessary directories for Render deployment
os.makedirs('static/js', exist_ok=True)
os.makedirs('static/css', exist_ok=True)
os.makedirs('static/images', exist_ok=True)
os.makedirs('templates', exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize database globally so Gunicorn catches it
try:
    with app.app_context():
        init_db()
        print("Database initialized successfully on startup.")
except Exception as e:
    print(f"Error initializing database: {e}")
# ==========================================

"""
Groq client initialization

On platforms like Render the GROQ_API_KEY environment variable might be
missing or network access to the Groq API could be slow. To avoid startup
timeouts and crashes, we:
- Only create the client when a non-empty key is present
- Do NOT make any network calls at import time
- Degrade chat features gracefully when Groq is unavailable
"""
client = None
ACTIVE_MODEL = None

if GROQ_API_KEY:
    try:
        client = Groq(api_key=GROQ_API_KEY)
        # Prefer an override from env, else use a sensible default
        env_model_override = os.getenv('GROQ_MODEL')
        ACTIVE_MODEL = env_model_override or "llama-3.1-8b-instant"
        print(f"Groq client initialized. Using model name: {ACTIVE_MODEL}")
    except Exception as e:
        print(f"WARNING: Failed to initialize Groq client: {e}")
        client = None
        ACTIVE_MODEL = None
else:
    print("WARNING: GROQ_API_KEY not set. Chat features will be disabled.")

# Helper functions
def generate_response(prompt, max_tokens=1024):
    if not client or not ACTIVE_MODEL:
        # Graceful degradation when Groq is not configured on the server
        return (
            "Raiden AI's chat features are currently unavailable because the Groq API key "
            "is not configured on the server. Please contact the administrator to set the "
            "GROQ_API_KEY environment variable."
        )

    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=ACTIVE_MODEL,
            max_tokens=max_tokens,
            temperature=0.7  # Balanced creativity/factuality
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"Error generating response: {str(e)}")
        return (
            "Sorry, I encountered an error while talking to the Groq API. "
            "Please try again in a moment or check the API key configuration."
        )

def extract_text_from_pdf(pdf_path):
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text()
            return text
    except Exception as e:
        return f"Error reading PDF: {str(e)}"

def schedule_task_reminders(task):
    """Schedule all reminders for a task using APScheduler"""
    try:
        due_time = datetime.strptime(task['due_date'], '%Y-%m-%dT%H:%M')
        
        # Remove any existing reminders for this task
        try:
            scheduler.remove_job(f"reminder_{task['id']}_30min")
            scheduler.remove_job(f"reminder_{task['id']}_due")
        except:
            pass  # Jobs might not exist
        
        # Schedule 30-minute reminder if it's in the future
        reminder_time = due_time - timedelta(minutes=30)
        if reminder_time > datetime.now():
            scheduler.add_job(
                send_reminder_notification,
                'date',
                run_date=reminder_time,
                args=[task['id'], False],
                id=f"reminder_{task['id']}_30min"
            )
        
        # Schedule due notification if it's in the future
        if due_time > datetime.now():
            scheduler.add_job(
                send_reminder_notification,
                'date',
                run_date=due_time,
                args=[task['id'], True],
                id=f"reminder_{task['id']}_due"
            )
        print(f"Scheduled reminders for task {task['id']} (Due: {task['due_date']})")
    except Exception as e:
        print(f"Error scheduling reminders for task {task['id']}: {str(e)}")

def send_reminder_notification(task_id, is_due):
    """Send reminder notification via WebSocket"""
    with app.app_context():
        with get_db() as db:
            task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
            if task and not task['completed']:
                task_dict = dict(task)
                socketio.emit('task_reminder', {
                    'task': task_dict['task'],
                    'due_date': task_dict['due_date'],
                    'task_id': task_dict['id'],
                    'is_due': is_due
                })

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# Routes
@app.route('/')
def index():
    # FIX: Changed to index.html to match standard structure
    return render_template('index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    message = data.get('message', '').lower().strip()
    
    if not message:
        return jsonify({"error": "No message provided"}), 400
    
    # Check for news requests
    if any(keyword in message for keyword in ['news', 'headlines', 'latest news', 'current news']):
        try:
            # Extract search terms from the message
            search_terms = []
            if 'technology' in message or 'tech' in message:
                search_terms.append('technology')
            if 'business' in message:
                search_terms.append('business')
            if 'sports' in message:
                search_terms.append('sports')
            if 'health' in message:
                search_terms.append('health')
            if 'science' in message:
                search_terms.append('science')
            if 'entertainment' in message:
                search_terms.append('entertainment')
            if 'politics' in message:
                search_terms.append('politics')
            if 'education' in message:
                search_terms.append('education')
            
            # Default to technology news if no specific category mentioned
            if not search_terms:
                search_terms = ['technology']
            
            # Determine country/region for news
            country = 'us'  # Default to US
            if any(keyword in message for keyword in ['india', 'indian', 'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'kalyan', 'vasai', 'sterling', 'andheri', 'bangalore', 'mumbai', 'pune', 'nagpur', 'thane', 'pimpri', 'noida', 'ghaziabad', 'faridabad', 'gurgaon', 'new delhi', 'bangalore', 'bengaluru', 'chennai', 'madras', 'kolkata', 'calcutta', 'hyderabad', 'secunderabad', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'bhopal', 'visakhapatnam', 'vizag', 'patna', 'vadodara', 'baroda', 'ludhiana', 'agra', 'nashik', 'rajkot', 'kalyan', 'vasai', 'sterling', 'andheri', 'pimpri', 'noida', 'gurgaon', 'gurugram']):
                country = 'in'  # India
            elif any(keyword in message for keyword in ['uk', 'britain', 'london', 'manchester', 'birmingham', 'leeds', 'liverpool', 'sheffield', 'edinburgh', 'glasgow', 'cardiff', 'belfast']):
                country = 'gb'  # United Kingdom
            elif any(keyword in message for keyword in ['canada', 'toronto', 'montreal', 'vancouver', 'calgary', 'edmonton', 'ottawa', 'winnipeg', 'quebec']):
                country = 'ca'  # Canada
            elif any(keyword in message for keyword in ['australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra', 'darwin', 'hobart']):
                country = 'au'  # Australia
            
            # Use GNews for all countries including India
            url = "https://gnews.io/api/v4/search"
            
            # Enhanced query for Indian news
            if country == 'in':
                # For Indian news, use simpler but effective queries
                if len(search_terms) == 1:
                    # For single category, combine with India
                    query = f"{search_terms[0]} India"
                elif len(search_terms) > 1:
                    # For multiple categories, combine with India
                    query = f"({' OR '.join(search_terms)}) India"
                else:
                    # For general Indian news, use major cities
                    query = "Mumbai OR Delhi OR Bangalore OR Chennai OR Kolkata OR Hyderabad OR Pune OR Ahmedabad OR Jaipur OR Lucknow OR Patna OR Bhopal OR Indore OR Nagpur OR India"
            else:
                # For other countries, use the standard search
                query = ' OR '.join(search_terms)
            
            params = {
                'q': query,
                'lang': 'en',
                'country': country,
                'max': '5',
                'apikey': GNEWS_API_KEY,
                'sortby': 'publishedAt'  # Get most recent news
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'articles' in data and data['articles']:
                # Get country name for display
                country_names = {'us': 'United States', 'in': 'India', 'gb': 'United Kingdom', 'ca': 'Canada', 'au': 'Australia'}
                country_name = country_names.get(country, 'United States')
                
                news_response = f"<h3>Latest News from {country_name}</h3><ul>"
                for article in data['articles'][:3]:  # Show top 3 articles
                    news_response += f"<li><strong>{article.get('title', 'No title')}</strong><br>"
                    news_response += f"<em>Source: {article.get('source', {}).get('name', 'Unknown')}</em><br>"
                    news_response += f"{article.get('description', 'No description')}<br>"
                    news_response += f"<a href='{article.get('url', '#')}' target='_blank'>Read more</a></li><br>"
                news_response += "</ul>"
                return jsonify({"response": news_response})
            else:
                return jsonify({"response": "Sorry, I couldn't find any news articles at the moment."})
                
        except Exception as e:
            return jsonify({"response": f"Sorry, I couldn't fetch the news right now. Error: {str(e)}"})
    
    # Check for weather requests
    elif any(keyword in message for keyword in ['weather', 'temperature', 'forecast', 'climate']):
        try:
            # Extract city/state name from the message
            city = None
            
            # Check for Indian states first
            if 'maharashtra' in message or 'mumbai' in message:
                city = 'Mumbai,IN'
            elif 'karnataka' in message or 'bangalore' in message or 'bengaluru' in message:
                city = 'Bangalore,IN'
            elif 'tamil nadu' in message or 'chennai' in message or 'madras' in message:
                city = 'Chennai,IN'
            elif 'delhi' in message or 'new delhi' in message:
                city = 'New Delhi,IN'
            elif 'west bengal' in message or 'kolkata' in message or 'calcutta' in message:
                city = 'Kolkata,IN'
            elif 'gujarat' in message or 'ahmedabad' in message:
                city = 'Ahmedabad,IN'
            elif 'rajasthan' in message or 'jaipur' in message:
                city = 'Jaipur,IN'
            elif 'telangana' in message or 'hyderabad' in message:
                city = 'Hyderabad,IN'
            elif 'kerala' in message or 'kochi' in message or 'cochin' in message:
                city = 'Kochi,IN'
            elif 'punjab' in message or 'chandigarh' in message:
                city = 'Chandigarh,IN'
            elif 'uttar pradesh' in message or 'lucknow' in message:
                city = 'Lucknow,IN'
            elif 'bihar' in message or 'patna' in message:
                city = 'Patna,IN'
            elif 'odisha' in message or 'bhubaneswar' in message:
                city = 'Bhubaneswar,IN'
            elif 'assam' in message or 'guwahati' in message:
                city = 'Guwahati,IN'
            elif 'jharkhand' in message or 'ranchi' in message:
                city = 'Ranchi,IN'
            elif 'chhattisgarh' in message or 'raipur' in message:
                city = 'Raipur,IN'
            elif 'madhya pradesh' in message or 'bhopal' in message:
                city = 'Bhopal,IN'
            elif 'himachal pradesh' in message or 'shimla' in message:
                city = 'Shimla,IN'
            elif 'uttarakhand' in message or 'dehradun' in message:
                city = 'Dehradun,IN'
            elif 'haryana' in message or 'gurgaon' in message or 'gurugram' in message:
                city = 'Gurgaon,IN'
            elif 'goa' in message:
                city = 'Panaji,IN'
            elif 'manipur' in message or 'imphal' in message:
                city = 'Imphal,IN'
            elif 'meghalaya' in message or 'shillong' in message:
                city = 'Shillong,IN'
            elif 'nagaland' in message or 'kohima' in message:
                city = 'Kohima,IN'
            elif 'tripura' in message or 'agartala' in message:
                city = 'Agartala,IN'
            elif 'mizoram' in message or 'aizawl' in message:
                city = 'Aizawl,IN'
            elif 'arunachal pradesh' in message or 'itanagar' in message:
                city = 'Itanagar,IN'
            elif 'sikkim' in message or 'gangtok' in message:
                city = 'Gangtok,IN'
            elif 'india' in message:
                city = 'New Delhi,IN'  # Default to Delhi for general India queries
            
            # Check for other major cities if no Indian state/city found
            elif 'london' in message:
                city = 'London,GB'
            elif 'new york' in message or 'nyc' in message:
                city = 'New York,US'
            elif 'tokyo' in message:
                city = 'Tokyo,JP'
            elif 'paris' in message:
                city = 'Paris,FR'
            elif 'sydney' in message:
                city = 'Sydney,AU'
            elif 'berlin' in message:
                city = 'Berlin,DE'
            elif 'madrid' in message:
                city = 'Madrid,ES'
            elif 'rome' in message:
                city = 'Rome,IT'
            elif 'moscow' in message:
                city = 'Moscow,RU'
            elif 'beijing' in message:
                city = 'Beijing,CN'
            elif 'seoul' in message:
                city = 'Seoul,KR'
            elif 'singapore' in message:
                city = 'Singapore,SG'
            elif 'dubai' in message:
                city = 'Dubai,AE'
            elif 'istanbul' in message:
                city = 'Istanbul,TR'
            elif 'cairo' in message:
                city = 'Cairo,EG'
            elif 'johannesburg' in message:
                city = 'Johannesburg,ZA'
            elif 'mexico city' in message:
                city = 'Mexico City,MX'
            elif 'sao paulo' in message:
                city = 'Sao Paulo,BR'
            elif 'buenos aires' in message:
                city = 'Buenos Aires,AR'
            elif 'toronto' in message:
                city = 'Toronto,CA'
            
            # Check for general country queries
            elif 'usa' in message or 'america' in message or 'united states' in message:
                city = 'New York,US'  # Default to New York for USA queries
            elif 'uk' in message or 'united kingdom' in message or 'britain' in message:
                city = 'London,GB'  # Default to London for UK queries
            elif 'canada' in message:
                city = 'Toronto,CA'  # Default to Toronto for Canada queries
            elif 'australia' in message:
                city = 'Sydney,AU'  # Default to Sydney for Australia queries
            elif 'germany' in message:
                city = 'Berlin,DE'  # Default to Berlin for Germany queries
            elif 'france' in message:
                city = 'Paris,FR'  # Default to Paris for France queries
            elif 'italy' in message:
                city = 'Rome,IT'  # Default to Rome for Italy queries
            elif 'spain' in message:
                city = 'Madrid,ES'  # Default to Madrid for Spain queries
            elif 'japan' in message:
                city = 'Tokyo,JP'  # Default to Tokyo for Japan queries
            elif 'china' in message:
                city = 'Beijing,CN'  # Default to Beijing for China queries
            elif 'south korea' in message or 'korea' in message:
                city = 'Seoul,KR'  # Default to Seoul for Korea queries
            elif 'russia' in message:
                city = 'Moscow,RU'  # Default to Moscow for Russia queries
            elif 'brazil' in message:
                city = 'Sao Paulo,BR'  # Default to Sao Paulo for Brazil queries
            elif 'argentina' in message:
                city = 'Buenos Aires,AR'  # Default to Buenos Aires for Argentina queries
            elif 'mexico' in message:
                city = 'Mexico City,MX'  # Default to Mexico City for Mexico queries
            elif 'south africa' in message:
                city = 'Johannesburg,ZA'  # Default to Johannesburg for South Africa queries
            elif 'egypt' in message:
                city = 'Cairo,EG'  # Default to Cairo for Egypt queries
            elif 'turkey' in message:
                city = 'Istanbul,TR'  # Default to Istanbul for Turkey queries
            elif 'uae' in message or 'united arab emirates' in message:
                city = 'Dubai,AE'  # Default to Dubai for UAE queries
            
            # If no specific city/state/country found, ask user to specify
            if not city:
                return jsonify({"response": "Please specify a city, state, or country. For example: 'weather in Mumbai', 'temperature in Karnataka', 'weather in London', 'weather in USA', etc."})
            
            # Get weather from OpenWeather API
            url = "https://api.openweathermap.org/data/2.5/weather"
            params = {
                'q': city,
                'appid': OPENWEATHER_API_KEY,
                'units': 'metric'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'main' in data:
                weather = data
                city_name = weather.get('name', city.split(',')[0])
                country = weather.get('sys', {}).get('country', '')
                
                weather_response = f"<h3>Weather in {city_name}"
                if country:
                    weather_response += f", {country}"
                weather_response += "</h3>"
                weather_response += f"<p><strong>Temperature:</strong> {weather.get('main', {}).get('temp', 'N/A')}°C</p>"
                weather_response += f"<p><strong>Feels like:</strong> {weather.get('main', {}).get('feels_like', 'N/A')}°C</p>"
                weather_response += f"<p><strong>Description:</strong> {weather.get('weather', [{}])[0].get('description', 'N/A').title()}</p>"
                weather_response += f"<p><strong>Humidity:</strong> {weather.get('main', {}).get('humidity', 'N/A')}%</p>"
                weather_response += f"<p><strong>Wind Speed:</strong> {weather.get('wind', {}).get('speed', 'N/A')} m/s</p>"
                
                return jsonify({"response": weather_response})
            else:
                return jsonify({"response": f"Sorry, I couldn't find weather information for {city.split(',')[0]}."})
                
        except Exception as e:
            return jsonify({"response": f"Sorry, I couldn't fetch the weather right now. Error: {str(e)}"})
    
    # For all other messages, use the original Groq API
    else:
        prompt = f"""You are Raiden AI, an intelligent university assistant. Provide helpful, accurate and well-structured responses to student questions.

        Guidelines for responses:
        1. Be professional yet friendly and approachable
        2. Provide detailed explanations for complex topics
        3. Break down solutions step-by-step when appropriate
        4. Use clear headings and bullet points for organization
        5. Format code examples properly with syntax highlighting
        6. Use bold text for important concepts and key terms
        7. Provide examples and analogies when helpful
        8. Admit when you don't know something
        9. Structure responses with clear sections
        10. Use proper HTML formatting (h1, h2, h3, p, ul, li, strong, em, code, pre)
        11. Do NOT use markdown formatting (no **, ##, etc.)
        12. Make responses educational and easy to understand for students

        User: {message}
        Raiden AI: """
        
        response = generate_response(prompt, max_tokens=1500)
        return jsonify({"response": response})

@app.route('/code_playground/run', methods=['POST'])
def run_code():
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'python')
    
    if not code:
        return jsonify({"error": "No code provided"}), 400
    
    try:
        if language == 'python':
            # Enhanced Python execution with better error handling and output capture
            import io
            import sys
            from contextlib import redirect_stdout, redirect_stderr
            
            # Capture both stdout and stderr
            stdout_capture = io.StringIO()
            stderr_capture = io.StringIO()
            
            # Create a safe execution environment
            safe_globals = {
                '__builtins__': {
                    'print': print,
                    'len': len,
                    'range': range,
                    'str': str,
                    'int': int,
                    'float': float,
                    'list': list,
                    'dict': dict,
                    'set': set,
                    'tuple': tuple,
                    'bool': bool,
                    'type': type,
                    'isinstance': isinstance,
                    'abs': abs,
                    'max': max,
                    'min': min,
                    'sum': sum,
                    'sorted': sorted,
                    'reversed': reversed,
                    'enumerate': enumerate,
                    'zip': zip,
                    'map': map,
                    'filter': filter,
                    'round': round,
                    'pow': pow,
                    'divmod': divmod,
                    'all': all,
                    'any': any,
                    'bin': bin,
                    'hex': hex,
                    'oct': oct,
                    'chr': chr,
                    'ord': ord,
                    'hash': hash,
                    'id': id,
                    'dir': dir,
                    'vars': vars,
                    'getattr': getattr,
                    'hasattr': hasattr,
                    'callable': callable,
                    'issubclass': issubclass,
                    'super': super,
                    'property': property,
                    'staticmethod': staticmethod,
                    'classmethod': classmethod,
                    'object': object,
                    'Exception': Exception,
                    'BaseException': BaseException,
                    'TypeError': TypeError,
                    'ValueError': ValueError,
                    'IndexError': IndexError,
                    'KeyError': KeyError,
                    'AttributeError': AttributeError,
                    'NameError': NameError,
                    'ZeroDivisionError': ZeroDivisionError,
                    'OverflowError': OverflowError,
                    'MemoryError': MemoryError,
                    'RecursionError': RecursionError,
                    'SyntaxError': SyntaxError,
                    'IndentationError': IndentationError,
                    'TabError': TabError,
                    'UnicodeError': UnicodeError,
                    'UnicodeDecodeError': UnicodeDecodeError,
                    'UnicodeEncodeError': UnicodeEncodeError,
                    'UnicodeTranslateError': UnicodeTranslateError,
                    'OSError': OSError,
                    'FileNotFoundError': FileNotFoundError,
                    'PermissionError': PermissionError,
                    'TimeoutError': TimeoutError,
                    'BlockingIOError': BlockingIOError,
                    'ChildProcessError': ChildProcessError,
                    'ConnectionError': ConnectionError,
                    'BrokenPipeError': BrokenPipeError,
                    'ConnectionAbortedError': ConnectionAbortedError,
                    'ConnectionRefusedError': ConnectionRefusedError,
                    'ConnectionResetError': ConnectionResetError,
                    'FileExistsError': FileExistsError,
                    'IsADirectoryError': IsADirectoryError,
                    'NotADirectoryError': NotADirectoryError,
                    'InterruptedError': InterruptedError,
                    'ProcessLookupError': ProcessLookupError,
                    'RuntimeError': RuntimeError,
                    'NotImplementedError': NotImplementedError,
                    'AssertionError': AssertionError,
                    'ImportError': ImportError,
                    'ModuleNotFoundError': ModuleNotFoundError,
                    'LookupError': LookupError,
                    'ArithmeticError': ArithmeticError,
                    'FloatingPointError': FloatingPointError,
                    'BufferError': BufferError,
                    'ReferenceError': ReferenceError,
                    'SystemError': SystemError,
                    'SystemExit': SystemExit,
                    'KeyboardInterrupt': KeyboardInterrupt,
                    'GeneratorExit': GeneratorExit,
                    'StopIteration': StopIteration,
                    'Warning': Warning,
                    'UserWarning': UserWarning,
                    'DeprecationWarning': DeprecationWarning,
                    'PendingDeprecationWarning': PendingDeprecationWarning,
                    'SyntaxWarning': SyntaxWarning,
                    'RuntimeWarning': RuntimeWarning,
                    'FutureWarning': FutureWarning,
                    'ImportWarning': ImportWarning,
                    'UnicodeWarning': UnicodeWarning,
                    'BytesWarning': BytesWarning,
                    'ResourceWarning': ResourceWarning
                }
            }
            
            execution_result = {
                'output': '',
                'error': None,
                'return_value': None
            }
            
            try:
                with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                    # Compile the code first to catch syntax errors
                    compiled_code = compile(code, '<string>', 'exec')
                    
                    # Execute the compiled code
                    exec(compiled_code, safe_globals)
                    
                    # Capture any return value if it's an expression
                    if code.strip().endswith(')') or not any(line.strip().startswith(('def ', 'class ', 'import ', 'from ')) for line in code.split('\n')):
                        # Try to evaluate as expression
                        try:
                            compiled_expr = compile(code, '<string>', 'eval')
                            execution_result['return_value'] = eval(compiled_expr, safe_globals)
                        except:
                            pass
                    
            except SyntaxError as e:
                execution_result['error'] = f"Syntax Error: {str(e)}"
            except Exception as e:
                execution_result['error'] = f"Runtime Error: {str(e)}"
            
            # Get captured output
            stdout_output = stdout_capture.getvalue()
            stderr_output = stderr_capture.getvalue()
            
            if stderr_output:
                execution_result['output'] = stderr_output
            else:
                execution_result['output'] = stdout_output
            
            # Add return value to output if present
            if execution_result['return_value'] is not None:
                if execution_result['output']:
                    execution_result['output'] += f"\nReturn Value: {execution_result['return_value']}"
                else:
                    execution_result['output'] = f"Return Value: {execution_result['return_value']}"
            
            # Generate professional result statement
            if execution_result['error']:
                result_statement = f"Execution failed with error: {execution_result['error']}"
            elif execution_result['output']:
                result_statement = f"Code executed successfully. Output: {execution_result['output'].strip()}"
            elif execution_result['return_value'] is not None:
                result_statement = f"Code executed successfully. Return value: {execution_result['return_value']}"
            else:
                result_statement = "Code executed successfully with no output."
            
            # Generate comprehensive explanation
            explanation_prompt = f"""Analyze this Python code and provide a professional, educational explanation:

            Code:
            {code}

Execution Result:
{execution_result['output'] if execution_result['output'] else 'No output'}
{execution_result['error'] if execution_result['error'] else ''}
{execution_result['return_value'] if execution_result['return_value'] is not None else ''}

Provide a structured analysis with:
1. Code Overview - Brief description of what the code does
2. Execution Flow - Step-by-step breakdown of how the code executes
3. Key Concepts - Important programming concepts demonstrated
4. Output Analysis - Explanation of the results
5. Learning Points - Educational insights for students

IMPORTANT FORMATTING RULES:
- Use ONLY HTML tags: h3, p, ul, li, strong, code, em
- DO NOT use any markdown formatting (no **, ##, etc.)
- DO NOT use quotes around text unless absolutely necessary
- Use <strong> tags for emphasis instead of **
- Use <code> tags for code snippets
- Make it professional and educational
- Ensure clean, readable output without unwanted characters

Analysis:"""
            
            explanation = generate_response(explanation_prompt, max_tokens=1200)
            
            return jsonify({
                'output': execution_result['output'],
                'error': execution_result['error'],
                'return_value': execution_result['return_value'],
                'result_statement': result_statement,
                'explanation': explanation
            })
            
        elif language == 'javascript':
            # JavaScript analysis (not executed for security)
            analysis_prompt = f"""Analyze this JavaScript code and provide a professional, educational explanation:

            Code:
            {code}

Provide a comprehensive analysis including:
1. Code Overview - What the code does
2. Syntax Analysis - JavaScript syntax and structure
3. Expected Behavior - What would happen when executed
4. Key Concepts - Important JavaScript concepts demonstrated
5. Best Practices - Suggestions for improvement
6. Learning Insights - Educational points for students

IMPORTANT FORMATTING RULES:
- Use ONLY HTML tags: h3, p, ul, li, strong, code, em
- DO NOT use any markdown formatting (no **, ##, etc.)
- DO NOT use quotes around text unless absolutely necessary
- Use <strong> tags for emphasis instead of **
- Use <code> tags for code snippets
- Make it professional and educational
- Ensure clean, readable output without unwanted characters

Analysis:"""
            
            analysis = generate_response(analysis_prompt, max_tokens=1000)
            return jsonify({
                'output': 'JavaScript code analysis completed',
                'explanation': analysis
            })
            
        elif language == 'html':
            # HTML analysis and preview
            analysis_prompt = f"""Analyze this HTML code and provide a professional, educational explanation:

Code:
{code}

Provide a comprehensive analysis including:
1. HTML Structure - Document structure and elements
2. Semantic Analysis - Meaning and purpose of elements
3. Rendering Preview - What the HTML would display
4. Best Practices - HTML standards and recommendations
5. Accessibility - Accessibility considerations
6. Learning Points - Educational insights for students

IMPORTANT FORMATTING RULES:
- Use ONLY HTML tags: h3, p, ul, li, strong, code, em
- DO NOT use any markdown formatting (no **, ##, etc.)
- DO NOT use quotes around text unless absolutely necessary
- Use <strong> tags for emphasis instead of **
- Use <code> tags for code snippets
- Make it professional and educational
- Ensure clean, readable output without unwanted characters

Analysis:"""
            
            analysis = generate_response(analysis_prompt, max_tokens=1000)
            return jsonify({
                'output': 'HTML code analysis completed',
                'explanation': analysis
            })
            
        elif language == 'c':
            # C language analysis (not executed for security)
            analysis_prompt = f"""Analyze this C code and provide a professional, educational explanation:

            Code:
            {code}

Provide a comprehensive analysis including:
1. Code Overview - What the code does
2. C Syntax Analysis - C language syntax and structure
3. Memory Management - Memory allocation and deallocation
4. Expected Behavior - What would happen when compiled and executed
5. Key Concepts - Important C programming concepts
6. Compilation Notes - What the compiler would do
7. Learning Insights - Educational points for students

IMPORTANT FORMATTING RULES:
- Use ONLY HTML tags: h3, p, ul, li, strong, code, em
- DO NOT use any markdown formatting (no **, ##, etc.)
- DO NOT use quotes around text unless absolutely necessary
- Use <strong> tags for emphasis instead of **
- Use <code> tags for code snippets
- Make it professional and educational
- Ensure clean, readable output without unwanted characters

            Analysis:"""
            
            analysis = generate_response(analysis_prompt, max_tokens=1000)
            return jsonify({
                'output': 'C code analysis completed',
                'explanation': analysis
            })
            
        else:
            return jsonify({"error": f"Unsupported language: {language}"}), 400
            
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/solve_math', methods=['POST'])
def solve_math():
    data = request.get_json()
    equation = data.get('equation', '')
    
    if not equation:
        return jsonify({"error": "No equation provided"}), 400
    
    try:
        # Enhanced symbolic solution with SymPy
        symbolic_solution = ""
        try:
            # Clean the equation and identify variables
            cleaned_equation = equation.replace(' ', '').replace('×', '*').replace('÷', '/')
            
            # Check if it's a simple arithmetic expression (no variables)
            if not any(char.isalpha() for char in cleaned_equation):
                # Evaluate arithmetic expression
                try:
                    expr = parse_expr(cleaned_equation)
                    result = expr.evalf()
                    # Format result nicely - remove unnecessary decimal places
                    if hasattr(result, 'is_integer') and result.is_integer():
                        result_str = str(int(result))
                    else:
                        result_str = str(float(result))
                    symbolic_solution = f"<strong>Result:</strong> <code>{equation}</code> = <strong>{result_str}</strong>"
                except Exception as calc_error:
                    # If SymPy fails, try basic evaluation
                    try:
                        # Safe evaluation for basic arithmetic
                        result = eval(cleaned_equation)
                        if isinstance(result, (int, float)):
                            if result.is_integer():
                                result_str = str(int(result))
                            else:
                                result_str = str(float(result))
                            symbolic_solution = f"<strong>Result:</strong> <code>{equation}</code> = <strong>{result_str}</strong>"
                        else:
                            symbolic_solution = f"<strong>Result:</strong> <code>{equation}</code> = <strong>{result}</strong>"
                    except:
                        symbolic_solution = f"<strong>Calculation Error:</strong> Unable to process {equation}. Please check the format and try again."
            else:
                # Handle equations with variables
                # Find all variables in the equation
                variables = set()
                for char in cleaned_equation:
                    if char.isalpha():
                        variables.add(char)
                
                if len(variables) == 1:
                    # Single variable equation
                    var = list(variables)[0]
                    var_symbol = sp.symbols(var)
                    
                    # Check if it's an equation (contains =)
                    if '=' in cleaned_equation:
                        # Solve equation
                        left_side, right_side = cleaned_equation.split('=', 1)
                        try:
                            left_expr = parse_expr(left_side)
                            right_expr = parse_expr(right_side)
                            equation_expr = sp.Eq(left_expr, right_expr)
                            solution = sp.solve(equation_expr, var_symbol)
                            if solution:
                                # Format solution nicely
                                if len(solution) == 1:
                                    sol_str = str(solution[0])
                                    if hasattr(solution[0], 'is_integer') and solution[0].is_integer():
                                        sol_str = str(int(solution[0]))
                                    symbolic_solution = f"<strong>Solution:</strong> {var} = {sol_str}"
                                else:
                                    sol_str = str(solution)
                                    symbolic_solution = f"<strong>Solutions:</strong> {var} = {sol_str}"
                            else:
                                symbolic_solution = f"<strong>No solution found</strong> for {equation}"
                        except:
                            # If parsing fails, try to simplify the expression
                            try:
                                expr = parse_expr(cleaned_equation)
                                simplified = sp.simplify(expr)
                                symbolic_solution = f"<strong>Simplified form:</strong> {equation} = {simplified}"
                            except:
                                symbolic_solution = f"<strong>Expression:</strong> {equation} (requires manual evaluation)"
                    else:
                        # Simplify expression
                        try:
                            expr = parse_expr(cleaned_equation)
                            simplified = sp.simplify(expr)
                            symbolic_solution = f"<strong>Simplified form:</strong> {equation} = {simplified}"
                        except:
                            symbolic_solution = f"<strong>Expression:</strong> {equation} (requires manual evaluation)"
                else:
                    # Multiple variables or complex expression
                    try:
                        expr = parse_expr(cleaned_equation)
                        simplified = sp.simplify(expr)
                        symbolic_solution = f"<strong>Simplified form:</strong> {equation} = {simplified}"
                    except:
                        symbolic_solution = f"<strong>Expression:</strong> {equation} (multiple variables detected)"
                    
        except Exception as sympy_error:
            symbolic_solution = f"<strong>Calculation Error:</strong> Unable to process {equation}. Please check the format and try again."
        
        # Enhanced explanation prompt with better structure
        prompt = f"""Solve and explain the following math problem in a clear, professional, and educational manner:

        Problem: {equation}

        Provide a well-structured solution that includes:

        <h3>Problem Analysis</h3>
        - Identify the type of problem (arithmetic, algebra, equation, etc.)
        - Explain what we need to find or calculate
        - Mention any important mathematical concepts involved

        <h3>Solution Steps</h3>
        - Break down the solution into clear, numbered steps
        - Show each calculation with proper mathematical notation
        - Explain the reasoning behind each step
        - Use order of operations (PEMDAS) when applicable

        <h3>Final Answer</h3>
        - Present the final result clearly and prominently
        - Include units if applicable
        - Verify the answer is reasonable

        <h3>Key Concepts</h3>
        - Explain the mathematical rules and concepts used
        - Provide learning insights and tips
        - Mention common mistakes to avoid

        Formatting requirements:
        - Use ONLY HTML tags: h3, p, ul, li, strong, code, em
        - Use <code> tags for mathematical expressions and calculations
        - Use <strong> tags for final answers and important terms
        - Use <em> tags for emphasis and learning tips
        - Make it professional, clear, and easy to follow
        - Keep explanations concise but comprehensive
        - Structure with proper headings and bullet points
        - Ensure all HTML tags are properly closed

        Solution:"""
        
        explanation = generate_response(prompt, max_tokens=1200)
        
        return jsonify({
            "solution": symbolic_solution,
            "explanation": explanation
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/flashcards', methods=['GET', 'POST'])
def handle_flashcards():
    try:
        if request.method == 'GET':
            with get_db() as db:
                # Verify table exists
                try:
                    db.execute("SELECT 1 FROM flashcards LIMIT 1")
                except sqlite3.OperationalError as e:
                    if "no such table" in str(e):
                        init_db()  # Reinitialize database if table is missing
                        return jsonify({"flashcards": []})
                    raise
                
                flashcards = db.execute("SELECT * FROM flashcards").fetchall()
                flashcards = [dict(flashcard) for flashcard in flashcards]
                return jsonify({"flashcards": flashcards})
        else:
            data = request.get_json()
            text = data.get('text', '')
            
            if not text:
                return jsonify({"error": "No text provided"}), 400
            
            try:
                prompt = f"""Convert the following study notes into a list of 5-10 flashcards in JSON format. 
                Each flashcard should have a clear question and a concise answer.
                Return ONLY a valid JSON array with no additional text, explanations, or formatting.
                
                Notes:
                {text}
                
                Return a valid JSON array like this:
                [{"question": "What is photosynthesis?", "answer": "The process by which plants convert sunlight into energy."}, {"question": "What are the main components?", "answer": "Sunlight, water, and carbon dioxide."}]
                
                Important: Ensure the JSON is properly closed with ] and all quotes are properly escaped."""
                
                response = generate_response(prompt)
                response = response.strip().replace('```json', '').replace('```', '').strip()
                
                # Try to fix common JSON formatting issues
                if not response.endswith(']'):
                    # If response is cut off, try to find the last complete object
                    last_complete = response.rfind('},')
                    if last_complete != -1:
                        response = response[:last_complete + 1] + ']'
                    else:
                        # If no complete objects found, try to close it properly
                        response = response.rstrip(',') + ']'
                
                # Remove any trailing commas before closing bracket
                response = response.replace(',]', ']').replace(',\n]', ']')
                
                try:
                    generated_flashcards = json.loads(response)
                except json.JSONDecodeError as json_error:
                    # If still invalid, try to extract valid JSON objects
                    import re
                    pattern = r'\{"question":\s*"[^"]*",\s*"answer":\s*"[^"]*"\}'
                    matches = re.findall(pattern, response)
                    if matches:
                        generated_flashcards = []
                        for match in matches:
                            try:
                                card = json.loads(match)
                                generated_flashcards.append(card)
                            except:
                                continue
                    else:
                        raise json_error
                
                with get_db() as db:
                    # Verify table exists
                    try:
                        db.execute("SELECT 1 FROM flashcards LIMIT 1")
                    except sqlite3.OperationalError as e:
                        if "no such table" in str(e):
                            init_db()  # Reinitialize database if table is missing
                    
                    for card in generated_flashcards:
                        db.execute(
                            "INSERT INTO flashcards (question, answer) VALUES (?, ?)",
                            (card['question'], card['answer'])
                        )
                    db.commit()
                    
                    # Get the newly added flashcards with their IDs
                    new_flashcards = []
                    for card in generated_flashcards:
                        new_card = db.execute(
                            "SELECT * FROM flashcards WHERE question = ? AND answer = ? ORDER BY id DESC LIMIT 1",
                            (card['question'], card['answer'])
                        ).fetchone()
                        new_flashcards.append(dict(new_card))
                
                return jsonify({
                    "success": True,
                    "message": f"Added {len(new_flashcards)} new flashcards",
                    "flashcards": new_flashcards
                })
            except json.JSONDecodeError as e:
                return jsonify({
                    "error": f"Failed to parse AI response: {str(e)}",
                    "response": response if 'response' in locals() else None
                }), 500
            except Exception as e:
                return jsonify({
                    "error": f"Failed to generate flashcards: {str(e)}",
                    "response": response if 'response' in locals() else None
                }), 500
    except Exception as e:
        return jsonify({
            "error": f"Database error: {str(e)}"
        }), 500

@app.route('/flashcards/<int:card_id>', methods=['DELETE'])
def delete_flashcard(card_id):
    try:
        with get_db() as db:
            # First get the card to return it in the response
            card = db.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,)).fetchone()
            if not card:
                return jsonify({"error": "Flashcard not found"}), 404
            
            db.execute("DELETE FROM flashcards WHERE id = ?", (card_id,))
            db.commit()
            
            return jsonify({
                "success": True,
                "message": "Flashcard deleted successfully",
                "deleted_card": dict(card)
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/summarize_pdf', methods=['POST'])
def summarize_pdf():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        
        if file and file.filename.lower().endswith('.pdf'):
            # Ensure upload folder exists
            if not os.path.exists(UPLOAD_FOLDER):
                os.makedirs(UPLOAD_FOLDER)
            
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Extract text from PDF
            text = extract_text_from_pdf(filepath)
            if text.startswith("Error"):
                return jsonify({"error": text}), 500
            
            # Generate summary
            prompt = f"""Create a comprehensive, well-structured summary of the following PDF document:

            Document Content:
            {text[:12000]}  # Limit to first 12k chars to avoid token limits

            Provide a detailed summary that includes:
            1. Main topic and purpose of the document
            2. Key concepts and ideas presented
            3. Important findings or conclusions
            4. Supporting evidence or examples
            5. Practical applications or implications
            6. Summary of main sections

            Format the summary with:
            - Clear headings and subheadings
            - Bullet points for key information
            - Bold text for important terms
            - Proper organization and flow
            - Educational insights for students

            Use HTML formatting (h2, h3, p, ul, li, strong, em) but NO markdown formatting.
            Make it comprehensive, readable, and educational.

            Summary:"""
            
            summary = generate_response(prompt, max_tokens=1500)
            return jsonify({"summary": summary})
        else:
            return jsonify({"error": "Only PDF files are allowed"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to process PDF: {str(e)}"}), 500

@app.route('/citation/fields', methods=['GET'])
def get_citation_fields():
    source_type = request.args.get('source_type', 'book')
    
    # Define required fields for each source type
    fields = {
        'book': ['author', 'title', 'year', 'publisher', 'location'],
        'journal': ['author', 'title', 'journal', 'year', 'volume', 'issue', 'pages', 'doi'],
        'website': ['author', 'title', 'website', 'url', 'pub_date', 'retrieval_date'],
        'video': ['author', 'title', 'year', 'platform', 'url', 'duration'],
        'newspaper': ['author', 'title', 'newspaper', 'year', 'pages', 'date'],
        'thesis': ['author', 'title', 'year', 'university', 'location'],
        'conference': ['author', 'title', 'conference', 'year', 'location', 'pages'],
        'report': ['author', 'title', 'year', 'institution', 'location', 'report_number']
    }
    
    return jsonify({
        'required_fields': fields.get(source_type, []),
        'optional_fields': []
    })

@app.route('/citation/generate', methods=['POST'])
def generate_citation():
    data = request.get_json()
    style = data.get('style', 'apa')
    source_type = data.get('source_type', 'book')
    
    # Validate required fields
    required_fields = {
        'book': ['author', 'title', 'year'],
        'journal': ['author', 'title', 'journal', 'year'],
        'website': ['title', 'url'],
        'video': ['title', 'url'],
        'newspaper': ['author', 'title', 'newspaper', 'date'],
        'thesis': ['author', 'title', 'year', 'university'],
        'conference': ['author', 'title', 'conference', 'year'],
        'report': ['author', 'title', 'year', 'institution']
    }
    
    missing_fields = []
    for field in required_fields.get(source_type, []):
        if not data.get(field):
            missing_fields.append(field)
    
    if missing_fields:
        return jsonify({
            'error': f'Missing required fields: {", ".join(missing_fields)}',
            'required_fields': required_fields.get(source_type, [])
        }), 400
    
    # Prepare prompt for the AI
    prompt = f"""Generate a {style.upper()} style citation (7th edition if APA) for the following {source_type} source:
    
    Source Type: {source_type}
    Author(s): {data.get('author', 'N/A')}
    Title: {data.get('title', 'N/A')}
    Year: {data.get('year', 'N/A')}
    Journal: {data.get('journal', 'N/A')}
    Volume: {data.get('volume', 'N/A')}
    Issue: {data.get('issue', 'N/A')}
    Pages: {data.get('pages', 'N/A')}
    Publisher: {data.get('publisher', 'N/A')}
    URL: {data.get('url', 'N/A')}
    DOI: {data.get('doi', 'N/A')}
    Publication Date: {data.get('pub_date', 'N/A')}
    Retrieval Date: {data.get('retrieval_date', 'N/A')}
    Location: {data.get('location', 'N/A')}
    
    The citation should be properly formatted according to {style.upper()} guidelines for a {source_type}.
    Only return the citation itself with no additional text or explanations.
    
    Citation:"""
    
    citation = generate_response(prompt)
    return jsonify({"citation": citation.strip()})

@app.route('/transcribe/start', methods=['POST'])
def start_transcription():
    # In a real implementation, you would start a transcription service here
    return jsonify({"status": "recording_started", "session_id": str(uuid.uuid4())})

@app.route('/transcribe/stop', methods=['POST'])
def stop_transcription():
    # In a real implementation, you would stop the transcription service here
    return jsonify({"status": "recording_stopped"})

@app.route('/transcribe/generate_slides', methods=['POST'])
def generate_slides_from_transcript():
    transcript = request.form.get('transcript', '')
    
    if not transcript:
        return jsonify({"error": "No transcript provided"}), 400
    
    # Generate slides from transcript with better structure
    prompt = f"""Convert the following lecture transcript into a well-structured slide presentation with 5-8 slides.
    
    Requirements:
    1. Each slide should have a clear, concise title
    2. Include 3-5 key bullet points per slide
    3. Use proper markdown formatting with # for slide titles
    4. Make the content educational and easy to follow
    5. Focus on main concepts and key takeaways
    6. Use bullet points (-) for list items
    
    Transcript:
    {transcript[:8000]}  # Limit to first 8k chars for better processing
    
    Format the response as:
    # Slide Title 1
    - Key point 1
    - Key point 2
    - Key point 3
    
    # Slide Title 2
    - Key point 1
    - Key point 2
    - Key point 3
    
    And so on...
    
    Slides:"""
    
    slides = generate_response(prompt, max_tokens=1500)
    return jsonify({"slides": slides})

@app.route('/attendance', methods=['GET', 'POST'])
def handle_attendance():
    try:
        if request.method == 'GET':
            year = request.args.get('year', datetime.now().year)
            month = request.args.get('month', datetime.now().month)
            
            with get_db() as db:
                # Verify table exists
                try:
                    db.execute("SELECT 1 FROM attendance LIMIT 1")
                except sqlite3.OperationalError as e:
                    if "no such table" in str(e):
                        init_db()  # Reinitialize database if table is missing
                        return jsonify({"error": "Database was reinitialized, please try again"}), 500
                    raise
                
                # Get all attendance records for the month
                attendance = db.execute("""
                    SELECT * FROM attendance 
                    WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
                    ORDER BY date
                """, (str(year), f"{int(month):02d}")).fetchall()
                
                attendance = [dict(record) for record in attendance]
                
                # Get statistics
                stats = db.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
                        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late
                    FROM attendance
                    WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
                """, (str(year), f"{int(month):02d}")).fetchone()
                
                stats = dict(stats) if stats else {
                    'total': 0, 'present': 0, 'absent': 0, 'late': 0
                }
                
                return jsonify({
                    'attendance': attendance,
                    'stats': stats
                })
        else:
            data = request.get_json()
            date = data.get('date')
            status = data.get('status')
            notes = data.get('notes', '')
            
            if not date or not status:
                return jsonify({"error": "Missing required fields"}), 400
            
            with get_db() as db:
                # Verify table exists
                try:
                    db.execute("SELECT 1 FROM attendance LIMIT 1")
                except sqlite3.OperationalError as e:
                    if "no such table" in str(e):
                        init_db()  # Reinitialize database if table is missing
                        return jsonify({"error": "Database was reinitialized, please try again"}), 500
                    raise
                
                # Check if record already exists for this date
                existing = db.execute(
                    "SELECT id FROM attendance WHERE date = ?",
                    (date,)
                ).fetchone()
                
                if existing:
                    # Update existing record
                    db.execute(
                        "UPDATE attendance SET status = ?, notes = ? WHERE id = ?",
                        (status, notes, existing['id'])
                    )
                    action = 'updated'
                else:
                    # Create new record
                    cursor = db.execute(
                        "INSERT INTO attendance (date, status, notes) VALUES (?, ?, ?)",
                        (date, status, notes)
                    )
                    action = 'added'
                
                db.commit()
                
                # Get the updated/added record
                record = db.execute(
                    "SELECT * FROM attendance WHERE id = ?",
                    (cursor.lastrowid if not existing else existing['id'],)
                ).fetchone()
                
                socketio.emit('attendance_update', {
                    'action': action,
                    'record': dict(record)
                })
                
                return jsonify({
                    "message": f"Attendance record {action} successfully",
                    "record": dict(record)
                })
    except sqlite3.OperationalError as e:
        if "no such table" in str(e):
            init_db()  # Reinitialize database if table is missing
            return jsonify({"error": "Database was reinitialized, please try again"}), 500
        raise

@app.route('/attendance/<int:record_id>', methods=['DELETE'])
def delete_attendance_record(record_id):
    with get_db() as db:
        # First get the record to return it in the response
        record = db.execute(
            "SELECT * FROM attendance WHERE id = ?",
            (record_id,)
        ).fetchone()
        
        if not record:
            return jsonify({"error": "Record not found"}), 404
        
        db.execute("DELETE FROM attendance WHERE id = ?", (record_id,))
        db.commit()
        
        socketio.emit('attendance_update', {
            'action': 'deleted',
            'record_id': record_id
        })
        
        return jsonify({
            "message": "Attendance record deleted successfully",
            "deleted_record": dict(record)
        })

@app.route('/attendance/export', methods=['GET'])
def export_attendance():
    format = request.args.get('format', 'csv')
    year = request.args.get('year', datetime.now().year)
    month = request.args.get('month', datetime.now().month)
    
    with get_db() as db:
        # Verify table exists
        try:
            db.execute("SELECT 1 FROM attendance LIMIT 1")
        except sqlite3.OperationalError as e:
            if "no such table" in str(e):
                init_db()  # Reinitialize database if table is missing
                return jsonify({"error": "Database was reinitialized, please try again"}), 500
            raise
        
        records = db.execute("""
            SELECT date, status, notes 
            FROM attendance
            WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
            ORDER BY date
        """, (str(year), f"{int(month):02d}")).fetchall()
        
        records = [dict(record) for record in records]
        
        if format == 'csv':
            # Generate CSV
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=['date', 'status', 'notes'])
            writer.writeheader()
            writer.writerows(records)
            
            response = make_response(output.getvalue())
            response.headers['Content-Disposition'] = f'attachment; filename=attendance_{year}_{month}.csv'
            response.headers['Content-type'] = 'text/csv'
            return response
        else:
            # Default to JSON
            return jsonify(records)

@app.route('/study_planner/tasks', methods=['GET', 'POST'])
def handle_tasks():
    if request.method == 'GET':
        period = request.args.get('period', 'today')
        now = datetime.now()
        
        if period == 'today':
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
        elif period == 'week':
            start = now - timedelta(days=now.weekday())
            end = start + timedelta(days=7)
        elif period == 'month':
            start = now.replace(day=1)
            end = (start + timedelta(days=32)).replace(day=1)
        else:
            start = datetime.min
            end = datetime.max
        
        with get_db() as db:
            # Verify table exists
            try:
                db.execute("SELECT 1 FROM tasks LIMIT 1")
            except sqlite3.OperationalError as e:
                if "no such table" in str(e):
                    init_db()  # Reinitialize database if table is missing
                    return jsonify({"error": "Database was reinitialized, please try again"}), 500
                raise
            
            query = """
                SELECT * FROM tasks 
                WHERE datetime(due_date) BETWEEN datetime(?) AND datetime(?)
                ORDER BY due_date
            """
            filtered_tasks = db.execute(query, (start.isoformat(), end.isoformat())).fetchall()
            filtered_tasks = [dict(task) for task in filtered_tasks]
        
        return jsonify({"tasks": filtered_tasks})
    else:
        data = request.get_json()
        if not data or 'task' not in data or 'due_date' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        with get_db() as db:
            # Verify table exists
            try:
                db.execute("SELECT 1 FROM tasks LIMIT 1")
            except sqlite3.OperationalError as e:
                if "no such table" in str(e):
                    init_db()  # Reinitialize database if table is missing
                    return jsonify({"error": "Database was reinitialized, please try again"}), 500
                raise
            
            cursor = db.execute("""
                INSERT INTO tasks (task, due_date, priority, completed)
                VALUES (?, ?, ?, ?)
            """, (data['task'], data['due_date'], data.get('priority', 2), False))
            db.commit()
            task_id = cursor.lastrowid
            
            # Get the newly created task
            new_task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
            new_task = dict(new_task)
        
        # Schedule reminders
        try:
            schedule_task_reminders(new_task)
        except Exception as e:
            print(f"Error scheduling reminders: {str(e)}")
        
        socketio.emit('task_update', {
            'action': 'added',
            'task': new_task
        })
        
        return jsonify({"message": "Task added successfully", "task": new_task}), 201

@app.route('/study_planner/tasks/<int:task_id>', methods=['PUT', 'DELETE'])
def handle_single_task(task_id):
    try:
        if request.method == 'PUT':
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
                
            with get_db() as db:
                # Verify table exists
                try:
                    db.execute("SELECT 1 FROM tasks LIMIT 1")
                except sqlite3.OperationalError as e:
                    if "no such table" in str(e):
                        init_db()  # Reinitialize database if table is missing
                        return jsonify({"error": "Database was reinitialized, please try again"}), 500
                    raise
                
                db.execute("""
                    UPDATE tasks 
                    SET completed = ?
                    WHERE id = ?
                """, (data.get('completed', False), task_id))
                db.commit()
                
                task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
                task = dict(task) if task else None
            
            if not task:
                return jsonify({"error": "Task not found"}), 404
                
            if task['completed']:
                try:
                    scheduler.remove_job(f"reminder_{task_id}_30min")
                    scheduler.remove_job(f"reminder_{task_id}_due")
                except:
                    pass
            
            socketio.emit('task_update', {
                'action': 'updated',
                'task': task
            })
            
            return jsonify({"message": "Task updated successfully"})
        else:
            with get_db() as db:
                # Verify table exists
                try:
                    db.execute("SELECT 1 FROM tasks LIMIT 1")
                except sqlite3.OperationalError as e:
                    if "no such table" in str(e):
                        init_db()  # Reinitialize database if table is missing
                        return jsonify({"error": "Database was reinitialized, please try again"}), 500
                    raise
                
                task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if not task:
                    return jsonify({"error": "Task not found"}), 404
                    
                db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
                db.commit()
            
            try:
                scheduler.remove_job(f"reminder_{task_id}_30min")
                scheduler.remove_job(f"reminder_{task_id}_due")
            except:
                pass
            
            socketio.emit('task_update', {
                'action': 'deleted',
                'task_id': task_id
            })
            
            return jsonify({"message": "Task deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ===== GNews API Integration =====
@app.route('/news', methods=['GET'])
def get_news():
    """Get news articles from GNews API"""
    try:
        # Get query parameters
        query = request.args.get('q', 'technology')  # Default to technology news
        lang = request.args.get('lang', 'en')  # Default to English
        country = request.args.get('country', 'us')  # Default to US
        max_articles = request.args.get('max', '10')  # Default to 10 articles
        
        # GNews API endpoint
        url = "https://gnews.io/api/v4/search"
        params = {
            'q': query,
            'lang': lang,
            'country': country,
            'max': max_articles,
            'apikey': GNEWS_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if 'articles' in data:
            # Clean and format the articles
            articles = []
            for article in data['articles']:
                articles.append({
                    'title': article.get('title', ''),
                    'description': article.get('description', ''),
                    'url': article.get('url', ''),
                    'image': article.get('image', ''),
                    'publishedAt': article.get('publishedAt', ''),
                    'source': article.get('source', {}).get('name', '')
                })
            
            return jsonify({
                'success': True,
                'articles': articles,
                'totalArticles': data.get('totalArticles', 0)
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No articles found',
                'message': data.get('errors', ['Unknown error'])
            }), 400
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': 'Failed to fetch news',
            'message': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/news/top-headlines', methods=['GET'])
def get_top_headlines():
    """Get top headlines from GNews API"""
    try:
        # Get query parameters
        category = request.args.get('category', 'general')  # Default to general
        country = request.args.get('country', 'us')  # Default to US
        max_articles = request.args.get('max', '10')  # Default to 10 articles
        
        # GNews API endpoint for top headlines
        url = "https://gnews.io/api/v4/top-headlines"
        params = {
            'category': category,
            'country': country,
            'max': max_articles,
            'apikey': GNEWS_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if 'articles' in data:
            # Clean and format the articles
            articles = []
            for article in data['articles']:
                articles.append({
                    'title': article.get('title', ''),
                    'description': article.get('description', ''),
                    'url': article.get('url', ''),
                    'image': article.get('image', ''),
                    'publishedAt': article.get('publishedAt', ''),
                    'source': article.get('source', {}).get('name', '')
                })
            
            return jsonify({
                'success': True,
                'articles': articles,
                'totalArticles': data.get('totalArticles', 0)
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No articles found',
                'message': data.get('errors', ['Unknown error'])
            }), 400
            
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': 'Failed to fetch headlines',
            'message': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

# ===== OpenWeather API Integration =====
@app.route('/weather', methods=['GET'])
def get_weather():
    """Get current weather data from OpenWeather API"""
    try:
        # Get query parameters
        city = request.args.get('city', 'London')  # Default to London
        units = request.args.get('units', 'metric')  # Default to metric (Celsius)
        
        # OpenWeather API endpoint
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            'q': city,
            'appid': OPENWEATHER_API_KEY,
            'units': units
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Format the weather data
        weather_info = {
            'city': data.get('name', ''),
            'country': data.get('sys', {}).get('country', ''),
            'temperature': data.get('main', {}).get('temp', 0),
            'feels_like': data.get('main', {}).get('feels_like', 0),
            'humidity': data.get('main', {}).get('humidity', 0),
            'pressure': data.get('main', {}).get('pressure', 0),
            'description': data.get('weather', [{}])[0].get('description', ''),
            'icon': data.get('weather', [{}])[0].get('icon', ''),
            'wind_speed': data.get('wind', {}).get('speed', 0),
            'wind_direction': data.get('wind', {}).get('deg', 0),
            'visibility': data.get('visibility', 0),
            'sunrise': data.get('sys', {}).get('sunrise', 0),
            'sunset': data.get('sys', {}).get('sunset', 0),
            'units': units
        }
        
        return jsonify({
            'success': True,
            'weather': weather_info
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': 'Failed to fetch weather data',
            'message': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/weather/forecast', methods=['GET'])
def get_weather_forecast():
    """Get 5-day weather forecast from OpenWeather API"""
    try:
        # Get query parameters
        city = request.args.get('city', 'London')  # Default to London
        units = request.args.get('units', 'metric')  # Default to metric (Celsius)
        
        # OpenWeather API endpoint for forecast
        url = "https://api.openweathermap.org/data/2.5/forecast"
        params = {
            'q': city,
            'appid': OPENWEATHER_API_KEY,
            'units': units
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Format the forecast data
        forecast_info = {
            'city': data.get('city', {}).get('name', ''),
            'country': data.get('city', {}).get('country', ''),
            'forecast': []
        }
        
        # Process each forecast entry (every 3 hours for 5 days)
        for item in data.get('list', []):
            forecast_entry = {
                'datetime': item.get('dt', 0),
                'temperature': item.get('main', {}).get('temp', 0),
                'feels_like': item.get('main', {}).get('feels_like', 0),
                'humidity': item.get('main', {}).get('humidity', 0),
                'description': item.get('weather', [{}])[0].get('description', ''),
                'icon': item.get('weather', [{}])[0].get('icon', ''),
                'wind_speed': item.get('wind', {}).get('speed', 0),
                'wind_direction': item.get('wind', {}).get('deg', 0),
                'pop': item.get('pop', 0)  # Probability of precipitation
            }
            forecast_info['forecast'].append(forecast_entry)
        
        return jsonify({
            'success': True,
            'forecast': forecast_info
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': 'Failed to fetch forecast data',
            'message': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

def is_external_url(url):
    return url and not url.startswith("https://duckduckgo.com")

@app.route('/search-web', methods=['POST'])
def search_web():
    """Search the web using DuckDuckGo Instant Answer API (free, but not full web search)"""
    query = request.json.get('query', '')
    if not query:
        return jsonify({'results': ["No query provided."]}), 400

    try:
        url = 'https://api.duckduckgo.com/'
        params = {
            'q': query,
            'format': 'json',
            'no_html': 1,
            'skip_disambig': 1
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        results = []
        # Main answer/abstract
        if data.get('AbstractText'):
            results.append({'type': 'abstract', 'text': data['AbstractText']})
        # Infobox (skip non-string values)
        if data.get('Infobox') and data['Infobox'].get('content'):
            for item in data['Infobox']['content']:
                if (
                    'label' in item and 'value' in item
                    and isinstance(item['value'], str)
                    and not item['value'].startswith('[object')
                ):
                    results.append({'type': 'infobox', 'label': item['label'], 'value': item['value']})
        # Related topics (external links only, max 5)
        related_links = []
        if data.get('RelatedTopics'):
            for topic in data['RelatedTopics']:
                if topic.get('Text') and topic.get('FirstURL') and is_external_url(topic['FirstURL']):
                    related_links.append({'type': 'related', 'text': topic['Text'], 'url': topic['FirstURL']})
                elif topic.get('FirstURL') and is_external_url(topic['FirstURL']):
                    related_links.append({'type': 'related', 'text': topic['FirstURL'], 'url': topic['FirstURL']})
                elif 'Name' in topic and 'Topics' in topic:
                    for subtopic in topic['Topics']:
                        if subtopic.get('Text') and subtopic.get('FirstURL') and is_external_url(subtopic['FirstURL']):
                            related_links.append({'type': 'related', 'text': subtopic['Text'], 'url': subtopic['FirstURL']})
                        elif subtopic.get('FirstURL') and is_external_url(subtopic['FirstURL']):
                            related_links.append({'type': 'related', 'text': subtopic['FirstURL'], 'url': subtopic['FirstURL']})
        # Limit to 5 related links
        results.extend(related_links[:5])
        # Fallback: Heading
        if not results and data.get('Heading'):
            results.append({'type': 'heading', 'text': data['Heading']})
        # Fallback: No results
        if not results:
            results.append({'type': 'none', 'text': f'No instant answer found for "{query}".'})
        return jsonify({'results': results})
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Web search failed: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Web search failed: {str(e)}'}), 500

# WebSocket events
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    # Send current task list to newly connected client
    with get_db() as db:
        try:
            tasks = db.execute("SELECT * FROM tasks").fetchall()
            emit('initial_tasks', {'tasks': [dict(task) for task in tasks]})
        except sqlite3.OperationalError as e:
            if "no such table" in str(e):
                init_db()
                emit('initial_tasks', {'tasks': []})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')


# Note: Render runs this file via Gunicorn, which ignores this block entirely.
# All necessary startup code for Render is already above the routes!
if __name__ == '__main__':
    # Disable automatic .env loading to avoid encoding issues
    os.environ['FLASK_SKIP_DOTENV'] = '1'
    
    # Clear all data on startup for fresh memory (Local Only)
    print("Starting Raiden AI locally...")
    
    # Try to delete database file if it exists to start fresh
    if os.path.exists('raiden.db'):
        try:
            os.remove('raiden.db')
            print("Previous database cleared for fresh start")
        except PermissionError:
            print("Warning: Could not delete database file (in use). Continuing with existing database.")
        except Exception as e:
            print(f"Warning: Could not delete database file: {str(e)}. Continuing with existing database.")
    
    # Clear uploads folder
    if os.path.exists(UPLOAD_FOLDER):
        try:
            import shutil
            shutil.rmtree(UPLOAD_FOLDER)
            print("Uploads folder cleared")
        except Exception as e:
            print(f"Warning: Could not clear uploads folder: {str(e)}")
    
    # Create necessary directories
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/images', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Initialize database
    try:
        with app.app_context():
            init_db()
            print("Database initialized successfully")
    except Exception as e:
        print(f"Error initializing database: {str(e)}")
        exit(1)
    
    print("Starting Raiden AI server...")
    socketio.run(app, debug=True, port=5000)
