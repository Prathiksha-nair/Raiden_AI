# Raiden AI - GNews & OpenWeather API Integration Guide

This guide explains how to use the newly integrated GNews and OpenWeather APIs in your Raiden AI application.

## 🚀 Quick Start

1. **Install the new dependency:**
   ```bash
   pip install requests==2.31.0
   ```

2. **Start the server:**
   ```bash
   python server.py
   ```

3. **Test the APIs:**
   ```bash
   python test_apis.py
   ```

## 📰 GNews API

The GNews API provides access to news articles from various sources worldwide.

### Available Endpoints

#### 1. Search News Articles
**Endpoint:** `GET /news`

**Parameters:**
- `q` (string): Search query (default: "technology")
- `lang` (string): Language code (default: "en")
- `country` (string): Country code (default: "us")
- `max` (integer): Maximum number of articles (default: 10)

**Example Usage:**
```bash
# Search for AI news
curl "http://127.0.0.1:5000/news?q=artificial%20intelligence&max=5"

# Search for climate change news in Spanish
curl "http://127.0.0.1:5000/news?q=climate%20change&lang=es&country=es&max=10"
```

**Response Format:**
```json
{
  "success": true,
  "articles": [
    {
      "title": "Article Title",
      "description": "Article description...",
      "url": "https://example.com/article",
      "image": "https://example.com/image.jpg",
      "publishedAt": "2025-07-14T10:30:00Z",
      "source": "News Source Name"
    }
  ],
  "totalArticles": 100
}
```

#### 2. Get Top Headlines
**Endpoint:** `GET /news/top-headlines`

**Parameters:**
- `category` (string): News category (default: "general")
- `country` (string): Country code (default: "us")
- `max` (integer): Maximum number of articles (default: 10)

**Available Categories:**
- `general` - General news
- `business` - Business news
- `technology` - Technology news
- `entertainment` - Entertainment news
- `health` - Health news
- `science` - Science news
- `sports` - Sports news

**Example Usage:**
```bash
# Get top technology headlines
curl "http://127.0.0.1:5000/news/top-headlines?category=technology&max=5"

# Get top business headlines from UK
curl "http://127.0.0.1:5000/news/top-headlines?category=business&country=gb&max=10"
```

## 🌤️ OpenWeather API

The OpenWeather API provides current weather data and forecasts for cities worldwide.

### Available Endpoints

#### 1. Current Weather
**Endpoint:** `GET /weather`

**Parameters:**
- `city` (string): City name (default: "London")
- `units` (string): Units system (default: "metric")

**Available Units:**
- `metric` - Celsius, meters/second, hPa
- `imperial` - Fahrenheit, miles/hour, hPa
- `kelvin` - Kelvin, meters/second, hPa

**Example Usage:**
```bash
# Get current weather for London in Celsius
curl "http://127.0.0.1:5000/weather?city=London&units=metric"

# Get current weather for New York in Fahrenheit
curl "http://127.0.0.1:5000/weather?city=New%20York&units=imperial"

# Get current weather for Tokyo in Kelvin
curl "http://127.0.0.1:5000/weather?city=Tokyo&units=kelvin"
```

**Response Format:**
```json
{
  "success": true,
  "weather": {
    "city": "London",
    "country": "GB",
    "temperature": 18.5,
    "feels_like": 17.2,
    "humidity": 75,
    "pressure": 1013,
    "description": "scattered clouds",
    "icon": "03d",
    "wind_speed": 3.6,
    "wind_direction": 280,
    "visibility": 10000,
    "sunrise": 1720944000,
    "sunset": 1720992000,
    "units": "metric"
  }
}
```

#### 2. Weather Forecast
**Endpoint:** `GET /weather/forecast`

**Parameters:**
- `city` (string): City name (default: "London")
- `units` (string): Units system (default: "metric")

**Example Usage:**
```bash
# Get 5-day forecast for Paris in Celsius
curl "http://127.0.0.1:5000/weather/forecast?city=Paris&units=metric"

# Get 5-day forecast for Los Angeles in Fahrenheit
curl "http://127.0.0.1:5000/weather/forecast?city=Los%20Angeles&units=imperial"
```

**Response Format:**
```json
{
  "success": true,
  "forecast": {
    "city": "Paris",
    "country": "FR",
    "forecast": [
      {
        "datetime": 1720944000,
        "temperature": 22.5,
        "feels_like": 21.8,
        "humidity": 65,
        "description": "clear sky",
        "icon": "01d",
        "wind_speed": 2.1,
        "wind_direction": 180,
        "pop": 0.1
      }
    ]
  }
}
```

## 🔧 Programming Examples

### Python Examples

#### Using the News API
```python
import requests

# Search for news
response = requests.get("http://127.0.0.1:5000/news", params={
    'q': 'artificial intelligence',
    'max': '5'
})

if response.status_code == 200:
    data = response.json()
    if data['success']:
        for article in data['articles']:
            print(f"Title: {article['title']}")
            print(f"Source: {article['source']}")
            print(f"URL: {article['url']}")
            print("---")

# Get top headlines
response = requests.get("http://127.0.0.1:5000/news/top-headlines", params={
    'category': 'technology',
    'max': '3'
})
```

#### Using the Weather API
```python
import requests
from datetime import datetime

# Get current weather
response = requests.get("http://127.0.0.1:5000/weather", params={
    'city': 'Tokyo',
    'units': 'metric'
})

if response.status_code == 200:
    data = response.json()
    if data['success']:
        weather = data['weather']
        print(f"Temperature in {weather['city']}: {weather['temperature']}°C")
        print(f"Description: {weather['description']}")
        print(f"Humidity: {weather['humidity']}%")

# Get weather forecast
response = requests.get("http://127.0.0.1:5000/weather/forecast", params={
    'city': 'New York',
    'units': 'imperial'
})

if response.status_code == 200:
    data = response.json()
    if data['success']:
        forecast = data['forecast']
        for entry in forecast['forecast'][:5]:  # First 5 entries
            dt = datetime.fromtimestamp(entry['datetime'])
            print(f"{dt.strftime('%Y-%m-%d %H:%M')}: {entry['temperature']}°F")
```

### JavaScript Examples

#### Using the News API
```javascript
// Search for news
fetch('/news?q=climate%20change&max=5')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            data.articles.forEach(article => {
                console.log(`Title: ${article.title}`);
                console.log(`Source: ${article.source}`);
                console.log(`URL: ${article.url}`);
            });
        }
    });

// Get top headlines
fetch('/news/top-headlines?category=technology&max=3')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            data.articles.forEach(article => {
                console.log(`Headline: ${article.title}`);
            });
        }
    });
```

#### Using the Weather API
```javascript
// Get current weather
fetch('/weather?city=London&units=metric')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const weather = data.weather;
            console.log(`Temperature: ${weather.temperature}°C`);
            console.log(`Description: ${weather.description}`);
            console.log(`Humidity: ${weather.humidity}%`);
        }
    });

// Get weather forecast
fetch('/weather/forecast?city=Paris&units=metric')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const forecast = data.forecast;
            forecast.forecast.slice(0, 5).forEach(entry => {
                const date = new Date(entry.datetime * 1000);
                console.log(`${date.toLocaleString()}: ${entry.temperature}°C`);
            });
        }
    });
```

## 🌍 Country and Language Codes

### GNews Supported Countries
- `us` - United States
- `gb` - United Kingdom
- `ca` - Canada
- `au` - Australia
- `in` - India
- `de` - Germany
- `fr` - France
- `es` - Spain
- `it` - Italy
- `jp` - Japan
- And many more...

### GNews Supported Languages
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `zh` - Chinese
- `ja` - Japanese
- `ko` - Korean
- And many more...

## ⚠️ Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

Common error scenarios:
- **Invalid API key** - Check your API keys in `server.py`
- **City not found** - Verify city name spelling
- **Network issues** - Check internet connection
- **Rate limiting** - APIs have usage limits

## 🔑 API Keys

The APIs are configured with the following keys:
- **GNews API Key:** `c9b67ec1fd7152753492de6f37f459cf`
- **OpenWeather API Key:** `20d24bd6501929128da43c9e11051030`

These keys are already integrated into the server. For production use, consider:
1. Moving keys to environment variables
2. Implementing rate limiting
3. Adding API key rotation
4. Setting up proper error monitoring

## 🧪 Testing

Run the included test script to verify everything works:

```bash
python test_apis.py
```

This will test all endpoints with various parameters and display the results.

## 📝 Notes

- All timestamps are in Unix timestamp format
- Weather icons can be used with OpenWeather's icon service
- News articles include source attribution for proper citation
- Both APIs have rate limits, so use responsibly
- The server includes proper error handling and timeout protection

## 🚀 Next Steps

Consider integrating these APIs into your frontend by:
1. Adding news and weather widgets to the dashboard
2. Creating dedicated panels for news and weather
3. Implementing real-time weather updates
4. Adding news search functionality to the chat interface 