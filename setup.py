#!/usr/bin/env python3
"""
Setup script for Raiden AI Full Edition API
This script helps you configure the Groq API key and run the server.
"""

import os
import sys
import subprocess

def main():
    print("🚀 Raiden AI Full Edition API Setup")
    print("=" * 50)
    
    # Check if GROQ_API_KEY is already set
    groq_key = os.getenv('GROQ_API_KEY')
    
    if groq_key:
        print(f"✅ GROQ API Key found: {groq_key[:10]}...")
    else:
        print("❌ GROQ API Key not found!")
        print("\nTo get a Groq API key:")
        print("1. Go to https://console.groq.com/")
        print("2. Sign up or log in")
        print("3. Create a new API key")
        print("4. Copy the key (starts with 'gsk_')")
        
        api_key = input("\nEnter your Groq API key (or press Enter to skip): ").strip()
        
        if api_key:
            # Set environment variable for current session
            os.environ['GROQ_API_KEY'] = api_key
            print("✅ API key set for this session")
            
            # Ask if user wants to save it permanently
            save_permanent = input("Save API key permanently? (y/n): ").lower().strip()
            if save_permanent == 'y':
                # Create .env file
                with open('.env', 'w') as f:
                    f.write(f'GROQ_API_KEY={api_key}\n')
                print("✅ API key saved to .env file")
        else:
            print("⚠️  No API key provided. Some features may not work.")
    
    print("\n📦 Installing dependencies...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], 
                      check=True, capture_output=True)
        print("✅ Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing dependencies: {e}")
        return
    
    print("\n🚀 Starting Raiden AI server...")
    print("The server will be available at: http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    
    try:
        # Import and run the server
        from server import app, socketio
        socketio.run(app, debug=True, port=5000)
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")

if __name__ == '__main__':
    main() 