#!/usr/bin/env python3
import os
from groq import Groq

# Test Groq API directly
api_key = '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'
client = Groq(api_key=api_key)

# Test different models
models_to_test = [
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile", 
    "llama-3.2-1b-preview"
]

print("Testing Groq API models...")
for model in models_to_test:
    try:
        print(f"Testing model: {model}")
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": "Hello"}],
            model=model,
            max_tokens=10
        )
        if response.choices:
            print(f"SUCCESS {model} - Success: {response.choices[0].message.content}")
        else:
            print(f"FAILED {model} - No choices in response")
    except Exception as e:
        print(f"ERROR {model} - Error: {str(e)}")

print("\nTesting with a longer prompt...")
try:
    response = client.chat.completions.create(
        messages=[{"role": "user", "content": "Explain how to solve 2+2 step by step"}],
        model="llama-3.1-8b-instant",
        max_tokens=100
    )
    print(f"SUCCESS Long prompt test - Success: {response.choices[0].message.content}")
except Exception as e:
    print(f"ERROR Long prompt test - Error: {str(e)}")
