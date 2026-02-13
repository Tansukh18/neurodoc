import os
import shutil
import warnings
import sqlite3
import re
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
from langchain_groq import ChatGroq
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.tools import DuckDuckGoSearchRun
from pydantic import BaseModel

# --- 1. CONFIGURATION ---
os.environ["GROQ_API_KEY"] = "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"
warnings.filterwarnings("ignore")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. DATABASE (Memory) ---
DB_NAME = "neurodoc_memory.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_message(role, content):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO messages (role, content) VALUES (?, ?)", (role, content))
    conn.commit()
    conn.close()

def get_recent_history(limit=5):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT role, content FROM messages ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return rows[::-1]

init_db()

# --- 3. TOOLS ---
search_tool = DuckDuckGoSearchRun()
vector_store = None
PRIMARY_MODEL = "llama-3.3-70b-versatile"

print("✅ SYSTEM: NEURODOC STABLE (No YouTube) IS LIVE")

def call_groq_model(prompt):
    try:
        llm = ChatGroq(temperature=0.3, model_name=PRIMARY_MODEL)
        return llm.invoke(prompt)
    except Exception as e:
        return f"Error: AI Service Unavailable. {str(e)}"

@app.get("/")
def home():
    return {"message": "NeuroDoc System Active"}

# --- 4. CORE FEATURES ---

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global vector_store
    
    with open("temp.pdf", "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        print("📥 Analyzing Document...")
        loader = PyPDFLoader("temp.pdf")
        docs = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)
        
        embeddings = HuggingFaceInferenceAPIEmbeddings(
    api_key=os.environ.get("HUGGINGFACE_API_KEY"),
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

        vector_store = FAISS.from_documents(splits, embeddings)
        
        save_message("system", f"Resume uploaded: {file.filename}")
        
        print("✅ Document Memorized!")
        return {"status": "Success", "chunks": len(splits)}
    except Exception as e:
        print(f"❌ Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(query: str = Form(...)):
    global vector_store
    
    # Save User Msg
    save_message("user", query)
    
    # Get History
    history_rows = get_recent_history(5)
    memory_context = "\n".join([f"{r[0].upper()}: {r[1]}" for r in history_rows])
    
    # Get PDF Context
    pdf_context = "No document uploaded."
    if vector_store:
        try:
            relevant_docs = vector_store.similarity_search(query, k=2)
            pdf_context = "\n\n".join([doc.page_content for doc in relevant_docs])
        except:
            pass 

    # Web Search
    web_results = "No search performed."
    if any(k in query.lower() for k in ["current", "latest", "news", "who is", "price", "today"]):
        try:
            web_results = search_tool.invoke(f"current latest {query}")
        except:
            web_results = "Search failed."

    now = datetime.now().strftime("%A, %d %B %Y")
    
    prompt = f"""
    You are NeuroDoc.
    Date: {now}
    
    [MEMORY]: {memory_context}
    [WEB]: {web_results}
    [PDF]: {pdf_context}
    [USER]: {query}
    
    Answer helpfully.
    """
    
    try:
        response = call_groq_model(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        save_message("assistant", content)
        return {"answer": content}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}

class GraphRequest(BaseModel):
    query: str

@app.post("/mindmap")
async def generate_mindmap(request: GraphRequest):
    global vector_store
    if not vector_store:
        raise HTTPException(status_code=400, detail="Please upload a PDF first.")
    
    retriever = vector_store.as_retriever(search_kwargs={"k": 3})
    docs = retriever.invoke(request.query)
    context_text = "\n".join([d.page_content for d in docs])
    
    prompt = f"""
    Create a Mind Map JSON from: "{context_text[:3000]}..."
    Return ONLY JSON: {{"nodes": [{{"id": "1", "label": "Concept"}}], "edges": [{{"source": "1", "target": "2", "label": "link"}}]}}
    Limit 8 nodes.
    """
    try:
        response = call_groq_model(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        match = re.search(r'\{.*\}', content, re.DOTALL)
        clean_json = match.group(0) if match else content
        return {"graph": clean_json}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 5. INTERVIEW MODE ---

@app.post("/interview/start")
async def start_interview():
    global vector_store
    if not vector_store:
        raise HTTPException(status_code=400, detail="Please upload your Resume/PDF first!")

    retriever = vector_store.as_retriever(search_kwargs={"k": 5})
    docs = retriever.invoke("Experience Projects Skills")
    resume_context = "\n".join([d.page_content for d in docs])

    prompt = f"""
    Act as a Senior Technical Recruiter. 
    Review this candidate's resume snippet:
    "{resume_context[:2000]}"
    
    Your Goal: Start a technical interview.
    Task: 
    1. briefly acknowledge their background (1 sentence).
    2. Ask the FIRST tough technical question based on a specific project or skill mentioned in the resume.
    3. Do NOT provide the answer. Just ask.
    """
    
    response = call_groq_model(prompt)
    content = response.content if hasattr(response, 'content') else str(response)
    save_message("interviewer", content)
    return {"message": content}

@app.post("/interview/chat")
async def interview_chat(answer: str = Form(...)):
    global vector_store
    
    history_rows = get_recent_history(3)
    memory_context = "\n".join([f"{r[0].upper()}: {r[1]}" for r in history_rows])
    
    prompt = f"""
    You are a Senior Technical Recruiter.
    
    [INTERVIEW HISTORY]
    {memory_context}
    
    [CANDIDATE'S LAST ANSWER]
    "{answer}"
    
    TASK:
    1. Evaluate answer.
    2. Ask follow-up.
    """
    
    response = call_groq_model(prompt)
    content = response.content if hasattr(response, 'content') else str(response)
    save_message("interviewer", content)
    return {"message": content}
