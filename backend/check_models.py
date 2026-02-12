import google.generativeai as genai
import os

api_key = input("Please paste your Gemini API Key: ")
genai.configure(api_key=api_key)

print("\nChecking available models for your key...")
try:
    available = False
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"✅ FOUND: {m.name}")
            available = True

    if not available:
        print("❌ No chat models found. Your API key might be invalid or needs billing setup.")

except Exception as e:
    print(f"Error: {e}")