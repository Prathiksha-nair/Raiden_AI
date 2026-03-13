#!/usr/bin/env python3
"""
Test script for flashcards functionality
"""

import requests
import json

def test_flashcards():
    """Test the flashcards endpoints"""
    base_url = "http://localhost:5000"
    
    print("Testing Flashcards Functionality")
    print("=" * 50)
    
    # Test 1: GET flashcards (should return empty list initially)
    print("\n1. Testing GET /flashcards...")
    try:
        response = requests.get(f"{base_url}/flashcards")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ GET flashcards working!")
            print(f"Found {len(data.get('flashcards', []))} flashcards")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Request failed: {e}")
    
    # Test 2: POST flashcards (create new flashcards)
    print("\n2. Testing POST /flashcards...")
    test_notes = """
    Photosynthesis is the process by which plants convert sunlight into energy.
    The main components needed for photosynthesis are sunlight, water, and carbon dioxide.
    Chlorophyll is the green pigment that captures light energy.
    The process produces glucose and oxygen as byproducts.
    Photosynthesis occurs in the chloroplasts of plant cells.
    """
    
    try:
        response = requests.post(
            f"{base_url}/flashcards",
            json={"text": test_notes},
            headers={"Content-Type": "application/json"}
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ POST flashcards working!")
            print(f"Created {len(data.get('flashcards', []))} flashcards")
            print(f"Message: {data.get('message', 'No message')}")
            
            # Store the first card ID for deletion test
            if data.get('flashcards'):
                first_card_id = data['flashcards'][0]['id']
                print(f"First card ID: {first_card_id}")
                
                # Test 3: DELETE flashcard
                print(f"\n3. Testing DELETE /flashcards/{first_card_id}...")
                delete_response = requests.delete(f"{base_url}/flashcards/{first_card_id}")
                print(f"Delete Status Code: {delete_response.status_code}")
                
                if delete_response.status_code == 200:
                    delete_data = delete_response.json()
                    print(f"✅ DELETE flashcard working!")
                    print(f"Message: {delete_data.get('message', 'No message')}")
                else:
                    print(f"❌ Delete Error: {delete_response.text}")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Request failed: {e}")
    
    print("\n" + "=" * 50)
    print("Flashcards test completed!")

if __name__ == "__main__":
    test_flashcards() 