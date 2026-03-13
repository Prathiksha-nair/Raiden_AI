#!/usr/bin/env python3
"""
Test script for GNews and OpenWeather APIs
This script demonstrates how to use the new API endpoints
"""

import requests
import json
from datetime import datetime

# Base URL for the Raiden AI server
BASE_URL = "http://127.0.0.1:5000"

def test_gnews_api():
    """Test GNews API endpoints"""
    print("=" * 50)
    print("TESTING GNEWS API")
    print("=" * 50)
    
    # Test 1: Search for technology news
    print("\n1. Searching for technology news:")
    response = requests.get(f"{BASE_URL}/news", params={
        'q': 'artificial intelligence',
        'max': '5'
    })
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print(f"Found {data['totalArticles']} articles")
            for i, article in enumerate(data['articles'][:3], 1):
                print(f"  {i}. {article['title']}")
                print(f"     Source: {article['source']}")
                print(f"     Published: {article['publishedAt']}")
                print()
        else:
            print(f"Error: {data.get('error', 'Unknown error')}")
    else:
        print(f"HTTP Error: {response.status_code}")
    
    # Test 2: Get top headlines
    print("\n2. Getting top headlines:")
    response = requests.get(f"{BASE_URL}/news/top-headlines", params={
        'category': 'technology',
        'max': '3'
    })
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print(f"Found {data['totalArticles']} headlines")
            for i, article in enumerate(data['articles'][:3], 1):
                print(f"  {i}. {article['title']}")
                print(f"     Source: {article['source']}")
                print()
        else:
            print(f"Error: {data.get('error', 'Unknown error')}")
    else:
        print(f"HTTP Error: {response.status_code}")

def test_openweather_api():
    """Test OpenWeather API endpoints"""
    print("=" * 50)
    print("TESTING OPENWEATHER API")
    print("=" * 50)
    
    # Test 1: Get current weather for London
    print("\n1. Getting current weather for London:")
    response = requests.get(f"{BASE_URL}/weather", params={
        'city': 'London',
        'units': 'metric'
    })
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            weather = data['weather']
            print(f"City: {weather['city']}, {weather['country']}")
            print(f"Temperature: {weather['temperature']}°C")
            print(f"Feels like: {weather['feels_like']}°C")
            print(f"Description: {weather['description']}")
            print(f"Humidity: {weather['humidity']}%")
            print(f"Wind Speed: {weather['wind_speed']} m/s")
            print()
        else:
            print(f"Error: {data.get('error', 'Unknown error')}")
    else:
        print(f"HTTP Error: {response.status_code}")
    
    # Test 2: Get weather forecast for New York
    print("\n2. Getting weather forecast for New York:")
    response = requests.get(f"{BASE_URL}/weather/forecast", params={
        'city': 'New York',
        'units': 'imperial'  # Fahrenheit
    })
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            forecast = data['forecast']
            print(f"City: {forecast['city']}, {forecast['country']}")
            print(f"Forecast entries: {len(forecast['forecast'])}")
            
            # Show first 3 forecast entries
            for i, entry in enumerate(forecast['forecast'][:3], 1):
                dt = datetime.fromtimestamp(entry['datetime'])
                print(f"  {i}. {dt.strftime('%Y-%m-%d %H:%M')}")
                print(f"     Temperature: {entry['temperature']}°F")
                print(f"     Description: {entry['description']}")
                print(f"     Precipitation: {entry['pop']*100:.1f}%")
                print()
        else:
            print(f"Error: {data.get('error', 'Unknown error')}")
    else:
        print(f"HTTP Error: {response.status_code}")

def test_custom_queries():
    """Test custom queries for both APIs"""
    print("=" * 50)
    print("TESTING CUSTOM QUERIES")
    print("=" * 50)
    
    # Test custom news search
    print("\n1. Custom news search for 'climate change':")
    response = requests.get(f"{BASE_URL}/news", params={
        'q': 'climate change',
        'lang': 'en',
        'country': 'us',
        'max': '3'
    })
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print(f"Found {data['totalArticles']} articles about climate change")
            for i, article in enumerate(data['articles'][:2], 1):
                print(f"  {i}. {article['title'][:80]}...")
        else:
            print(f"Error: {data.get('error', 'Unknown error')}")
    else:
        print(f"HTTP Error: {response.status_code}")
    
    # Test weather for different city
    print("\n2. Weather for Tokyo:")
    response = requests.get(f"{BASE_URL}/weather", params={
        'city': 'Tokyo',
        'units': 'metric'
    })
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            weather = data['weather']
            print(f"City: {weather['city']}, {weather['country']}")
            print(f"Temperature: {weather['temperature']}°C")
            print(f"Description: {weather['description']}")
        else:
            print(f"Error: {data.get('error', 'Unknown error')}")
    else:
        print(f"HTTP Error: {response.status_code}")

if __name__ == "__main__":
    print("Raiden AI - API Testing Script")
    print("Make sure the server is running on http://127.0.0.1:5000")
    print()
    
    try:
        # Test GNews API
        test_gnews_api()
        
        # Test OpenWeather API
        test_openweather_api()
        
        # Test custom queries
        test_custom_queries()
        
        print("=" * 50)
        print("ALL TESTS COMPLETED")
        print("=" * 50)
        
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the server.")
        print("Make sure the Raiden AI server is running on http://127.0.0.1:5000")
    except Exception as e:
        print(f"Error: {str(e)}") 