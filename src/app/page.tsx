"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Bot, User, Send, Loader2, AlertCircle, RefreshCw, Upload, X, FileText } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type Message = {
  id?: string
  role: "user" | "model"
  content: string
  created_at?: string
}


export default function ChatbotPage() {
  const [userId, setUserId] = useState<string>('anonymous');
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
   const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

    const [file, setFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<{id: string, name: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    // Check if file is PDF
    if (selectedFile.type !== "application/pdf") {
      setUploadError("Please upload a PDF file.");
      return;
    }
    
    setFile(selectedFile);
    setUploadError(null);
  };

   const uploadPDF = async () => {
    if (!file) return;
    
    setUploadingFile(true);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("userId", userId);
      
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload PDF");
      }
      
      const result = await response.json();
      setActiveDocument({
        id: result.documentId,
        name: file.name
      });
      
      // Add system message about the uploaded document
      setMessages(prev => [
        ...prev, 
        { 
          role: "model", 
          content: `I've processed your document "${file.name}". You can now ask me questions about it!`
        }
      ]);
      
    } catch (err) {
      console.error("Error uploading PDF:", err);
      setUploadError(err instanceof Error ? err.message : "Failed to upload PDF");
    } finally {
      setUploadingFile(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

    const clearActiveDocument = () => {
    setActiveDocument(null);
  };

  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = { role: "user" as const, content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)
    setError(null)

    try {
      // Format history in the format expected by the API
      const history = messages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }))

      const response = await fetch("/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: history,
          userId: userId,
          documentId:activeDocument?.id || null,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setMessages((prev) => [...prev, { role: "model", content: data.response }])
      }
    } catch (err) {
      setError("Failed to send message. Please try again.")
      console.error("Error sending message:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Format message content to handle code blocks
  const formatMessage = (content: string) => {
    // Simple regex to detect code blocks (text between triple backticks)
    const codeBlockRegex = /```([\s\S]*?)```/g

    if (!codeBlockRegex.test(content)) {
      return <p className="whitespace-pre-wrap">{content}</p>
    }

    const parts = []
    let lastIndex = 0
    let match

    // Reset regex
    codeBlockRegex.lastIndex = 0

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(
          <p key={`text-${lastIndex}`} className="whitespace-pre-wrap mb-2">
            {content.substring(lastIndex, match.index)}
          </p>,
        )
      }

      // Add code block
      parts.push(
        <div
          key={`code-${match.index}`}
          className="bg-gray-800 text-gray-100 p-3 rounded-md my-2 overflow-x-auto font-mono text-sm"
        >
          {match[1].trim()}
        </div>,
      )

      lastIndex = match.index + match[0].length
    }

    // Add any remaining text
    if (lastIndex < content.length) {
      parts.push(
        <p key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {content.substring(lastIndex)}
        </p>,
      )
    }

    return <>{parts}</>
  }
useEffect(() => {
  // Generate a simple user ID or get it from authentication
  const storedUserId = localStorage.getItem('chatUserId') || crypto.randomUUID();
  localStorage.setItem('chatUserId', storedUserId);
  setUserId(storedUserId);
}, []);
const fetchChatHistory = async () => {
    setLoadingHistory(true);
    setError(null);

    try {
      const response = await fetch(`/api?userId=${userId}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (data.messages && data.messages.length > 0) {
        // Format messages from Supabase to match our app's format
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at
        }));

        setMessages(formattedMessages);
      }
    } catch (err) {
      setError("Failed to load chat history");
      console.error("Error loading chat history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };
  useEffect(() => {
    if (userId) {
      fetchChatHistory();
    }
  }, [userId]);

  // Add this function to your ChatbotPage component
const clearChatHistory = async () => {
  // Show confirmation dialog
  if (!confirm("Are you sure you want to clear all chat history?")) {
    return;
  }
  
  setLoading(true);
  setError(null);
  
  try {
    // Call API endpoint to clear history from database
    const response = await fetch(`/api?userId=${userId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to clear history");
    }
    
    // Clear local messages state
    setMessages([]);
  } catch (err) {
    setError("Failed to clear chat history");
    console.error("Error clearing chat history:", err);
  } finally {
    setLoading(false);
  }
};
  
const renderFileUploadSection = () => (
    <div className="mb-4 p-4 border rounded-lg bg-white">
      <h3 className="font-medium mb-2 flex items-center gap-2">
        <FileText size={18} />
        Document Context
      </h3>

      {activeDocument ? (
        <div className="flex items-center justify-between bg-purple-50 p-3 rounded-md">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-purple-600" />
            <span className="text-sm font-medium">{activeDocument.name}</span>
          </div>
          <button
            onClick={clearActiveDocument}
            className="text-gray-500 hover:text-red-600"
            title="Remove document context"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-sm flex items-center gap-2"
            >
              <Upload size={14} />
              Select PDF
            </label>
            {file && (
              <>
                <span className="text-sm text-gray-600 truncate max-w-[150px]">
                  {file.name}
                </span>
                <button
                  onClick={uploadPDF}
                  disabled={uploadingFile}
                  className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 disabled:bg-purple-300"
                >
                  {uploadingFile ? (
                    <span className="flex items-center gap-1">
                      <Loader2 size={14} className="animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "Upload & Process"
                  )}
                </button>
              </>
            )}
          </div>
          {uploadError && (
            <p className="text-xs text-red-500 mt-1">{uploadError}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Upload a PDF document to ask questions about its contents.
          </p>
        </div>
      )}
    </div>
  );




  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 md:p-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="flex items-center justify-center mb-6">
        <div className="bg-purple-600 text-white p-2 rounded-full mr-2">
          <Bot size={24} />
        </div>
        <h1 className="text-xl font-bold text-gray-800">Gemini AI Assistant</h1>
      </div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Chat with Gemini</h1>
         <div className="flex items-center gap-2">
    <button 
      onClick={clearChatHistory}
      disabled={loading || loadingHistory}
      className="flex items-center gap-2 px-3 py-1 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
      </svg>
      Clear History
    </button>
        <button 
          onClick={fetchChatHistory}
          disabled={loadingHistory}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          {loadingHistory ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {loadingHistory ? "Loading..." : "Refresh History"}
        </button>
        </div>
      </div>


           {/* Add PDF upload section here */}
            {renderFileUploadSection()}
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto mb-4 border rounded-lg p-4 bg-gray-50 shadow-inner">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="bg-purple-100 p-4 rounded-full mb-4">
              <Bot size={32} className="text-purple-600" />
            </div>
            <p className="text-gray-500 max-w-md">
              Hi there! I'm your Gemini AI assistant. Ask me anything to start our conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="flex items-start max-w-[80%] gap-2">
                    {msg.role === "model" && (
                      <div className="bg-purple-600 text-white p-1.5 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot size={16} />
                      </div>
                    )}

                    <div
                      className={`p-3 rounded-lg shadow-sm ${
                        msg.role === "user"
                          ? "bg-purple-600 text-white rounded-tr-none"
                          : "bg-white border border-gray-200 rounded-tl-none"
                      }`}
                    >
                      {formatMessage(msg.content)}
                      <div className={`text-xs mt-1 ${msg.role === "user" ? "text-purple-200" : "text-gray-400"}`}>
                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>

                    {msg.role === "user" && (
                      <div className="bg-gray-200 p-1.5 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0 mt-1">
                        <User size={16} className="text-gray-600" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-start max-w-[80%] gap-2">
                    <div className="bg-purple-600 text-white p-1.5 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot size={16} />
                    </div>
                    <div className="p-3 rounded-lg shadow-sm bg-white border border-gray-200 rounded-tl-none">
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1">
                          <div
                            className="h-2 w-2 bg-purple-600 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          ></div>
                          <div
                            className="h-2 w-2 bg-purple-600 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          ></div>
                          <div
                            className="h-2 w-2 bg-purple-600 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-500">Thinking...</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg flex items-center"
        >
          <AlertCircle size={18} className="mr-2" />
          <p>{error}</p>
        </motion.div>
      )}

      {/* Input area */}
      <div className="relative border rounded-lg overflow-hidden shadow-sm bg-white">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          className="w-full p-4 pr-14 focus:outline-none resize-none bg-transparent"
          rows={3}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="absolute bottom-3 right-3 bg-purple-600 text-white p-2 rounded-full disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors hover:bg-purple-700"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>

      <div className="text-center text-xs text-gray-400 mt-4">Powered by Gemini 1.5 Flash</div>
    </div>
  )
}

