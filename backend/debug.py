import sys
import os

print(f"Using Python: {sys.executable}")
print("-" * 20)

required = [
    "fastapi", "uvicorn", "langchain", "langchain_community", 
    "langchain_google_genai", "langchain_text_splitters", "faiss-cpu", "pypdf"
]

missing = []

print("CHECKING LIBRARIES:")
for lib in required:
    try:
        # Handle hyphenated package names for import check
        import_name = lib.replace("-", "_").replace("faiss_cpu", "faiss")
        __import__(import_name)
        print(f"  [OK] {lib}")
    except ImportError:
        print(f"  [XX] MISSING: {lib}")
        missing.append(lib)

print("-" * 20)

if missing:
    print(f"CRITICAL: You are missing {len(missing)} libraries.")
    print(f"Run this command: pip install {' '.join(missing)}")
else:
    print("ALL LIBRARIES INSTALLED.")
    print("Checking main.py for syntax errors...")
    try:
        import main
        print("SUCCESS: main.py is valid!")
    except Exception as e:
        print(f"\nFATAL ERROR IN main.py:\n{e}")
