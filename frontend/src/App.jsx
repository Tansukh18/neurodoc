import React, { useState } from 'react';
import axios from 'axios';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Send, Upload, BookOpen, Brain, Network, X, Zap, Briefcase, UserCheck } from 'lucide-react';

const API_URL = "https://neurodoc-1.onrender.com";

const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR' });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 150, height: 50 }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = { x: nodeWithPosition.x - 75, y: nodeWithPosition.y - 25 };
  });
  return { nodes, edges };
};

function App() {
  const [file, setFile] = useState(null);
  const [isFileProcessed, setIsFileProcessed] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  // CLEANED: Welcome message
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am NeuroDoc. Upload a PDF to start studying.' }
  ]);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Graph & Interview States
  const [showGraph, setShowGraph] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewMsgs, setInterviewMsgs] = useState([]);
  const [interviewInput, setInterviewInput] = useState("");

  const handleUpload = async () => {
    if (!file) return alert("Select a PDF first.");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API_URL}/upload`, formData);
      setIsFileProcessed(true);
      setUploadedFileName(file.name);
      alert(`✅ ${file.name} memorized!`);
    } catch (error) {
      alert("❌ Upload Failed.");
    }
    setUploading(false);
  };

  const handleChat = async () => {
    if (!query) return;
    const newMessages = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setQuery('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("query", query);
      const res = await axios.post(`${API_URL}/chat`, formData);
      setMessages([...newMessages, { role: 'assistant', content: res.data.answer }]);
    } catch (error) {
      setMessages([...newMessages, { role: 'assistant', content: "⚠️ Brain connection failed." }]);
    }
    setLoading(false);
  };

  const generateMindMap = async () => {
    const lastQuery = messages.length > 1 ? messages.filter(m => m.role === 'user').pop()?.content : "Summary";
    setShowGraph(true);
    setGraphLoading(true);
    try {
      const res = await axios.post(`${API_URL}/mindmap`, { query: lastQuery });
      const rawData = JSON.parse(res.data.graph);
      const flowNodes = rawData.nodes.map(n => ({
        id: n.id, data: { label: n.label }, position: { x: 0, y: 0 },
        className: 'bg-indigo-600 text-white p-3 rounded-lg shadow-lg border-none text-center font-bold min-w-[120px]'
      }));
      const flowEdges = rawData.edges ? rawData.edges.map(e => ({
        id: `e${e.source}-${e.target}`, source: e.source, target: e.target, animated: true, style: { stroke: '#6366F1' }
      })) : [];
      const layouted = getLayoutedElements(flowNodes, flowEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    } catch (error) {
      setShowGraph(false);
    }
    setGraphLoading(false);
  };

  const startInterview = async () => {
    if (!isFileProcessed) return alert("Upload Resume first!");
    const confirmStart = window.confirm(`Start interview using "${uploadedFileName}"?`);
    if (!confirmStart) return;
    setShowInterview(true);
    if (!interviewStarted) {
      try {
        setInterviewMsgs([{ role: 'system', content: "Reading Resume..." }]);
        const res = await axios.post(`${API_URL}/interview/start`);
        setInterviewMsgs([{ role: 'interviewer', content: res.data.message }]);
        setInterviewStarted(true);
      } catch (e) {
        setInterviewMsgs([{ role: 'interviewer', content: "Error starting interview." }]);
      }
    }
  };

  const sendInterviewAnswer = async () => {
    if (!interviewInput) return;
    const newMsgs = [...interviewMsgs, { role: 'user', content: interviewInput }];
    setInterviewMsgs(newMsgs);
    setInterviewInput("");
    try {
      const formData = new FormData();
      formData.append("answer", interviewInput);
      const res = await axios.post(`${API_URL}/interview/chat`, formData);
      setInterviewMsgs([...newMsgs, { role: 'interviewer', content: res.data.message }]);
    } catch (e) {
      alert("Connection failed.");
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
      <div className="w-80 bg-gray-950 border-r border-gray-800 p-6 flex flex-col z-20 shadow-2xl">
        <div className="flex items-center gap-3 mb-10">
          <Brain className="w-8 h-8 text-indigo-500" />
          <h1 className="text-2xl font-bold tracking-tight">NeuroDoc</h1>
        </div>

        <div className="space-y-6">
          {/* PDF UPLOAD */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upload PDF</label>
            <div className="mt-2 border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-indigo-500 transition-all cursor-pointer relative group">
              <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => setFile(e.target.files[0])} />
              <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2 group-hover:text-indigo-500" />
              <p className="text-xs text-gray-300 truncate">{file ? file.name : "Select File"}</p>
            </div>
            <button onClick={handleUpload} disabled={uploading} className="w-full mt-2 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 flex justify-center items-center gap-2">
              Process PDF <Zap className="w-3 h-3" />
            </button>
          </div>

          <button onClick={generateMindMap} className="w-full bg-gray-800 hover:bg-gray-700 py-3 rounded-lg text-sm font-medium border border-gray-700">
            Generate Mind Map
          </button>

          <div className="pt-4 border-t border-gray-800">
            <button onClick={startInterview} className="w-full bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 py-3 rounded-lg font-bold flex justify-center items-center gap-2 border border-emerald-800/50">
              <Briefcase className="w-4 h-4" /> Mock Interview
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-gray-900">
        <header className="h-16 border-b border-gray-800 flex items-center px-8 bg-gray-950/50 backdrop-blur-md">
          <span className="font-medium text-gray-300">Active Session</span>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl p-5 rounded-2xl shadow-md ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none'}`}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && <div className="text-gray-500 text-sm animate-pulse">Thinking...</div>}
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-900/50">
          <div className="relative flex items-center max-w-4xl mx-auto">
            <input type="text" placeholder="Ask about the PDF..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-4 pl-6 pr-14 focus:outline-none focus:border-indigo-500" value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleChat()} />
            <button onClick={handleChat} className="absolute right-3 p-2 bg-indigo-600 rounded-lg"><Send className="w-5 h-5 text-white" /></button>
          </div>
        </div>

        {showGraph && (
          <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col">
            <div className="flex justify-between p-6 bg-gray-950 border-b border-gray-800">
              <h2 className="text-xl font-bold">Knowledge Graph</h2>
              <button onClick={() => setShowGraph(false)}><X /></button>
            </div>
            <div className="flex-1 relative w-full h-full">
              {graphLoading ? <div className="p-10 text-center text-gray-400">Generating Graph...</div> :
                <ReactFlow nodes={nodes} edges={edges} fitView><Background color="#374151" /><Controls /></ReactFlow>}
            </div>
          </div>
        )}

        {showInterview && (
          <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col">
            <div className="flex justify-between p-6 bg-gray-950 border-b border-emerald-900/30">
              <h2 className="text-xl font-bold text-emerald-400">Mock Interview</h2>
              <button onClick={() => setShowInterview(false)}><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {interviewMsgs.map((msg, index) => (
                <div key={index} className={`p-4 rounded-xl border ${msg.role === 'user' ? 'bg-gray-800 border-gray-700 ml-auto max-w-xl' : 'bg-emerald-950/30 border-emerald-900/50 mr-auto max-w-2xl'}`}>
                  <p className="text-sm text-gray-300">{msg.content}</p>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-gray-800">
              <div className="relative flex items-center max-w-4xl mx-auto">
                <input type="text" placeholder="Type answer..." className="w-full bg-gray-800 border border-gray-700 rounded-xl py-4 pl-6 pr-14 focus:outline-none focus:border-emerald-500" value={interviewInput} onChange={(e) => setInterviewInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendInterviewAnswer()} />
                <button onClick={sendInterviewAnswer} className="absolute right-3 p-2 bg-emerald-600 rounded-lg"><Send className="w-5 h-5 text-white" /></button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;