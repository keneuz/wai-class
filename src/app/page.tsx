'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Volume2, User, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  id: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'Lumina is a visionary poet from the year 2200 who creates futuristic poems',
      id: 'system-prompt'
    }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [poemLines, setPoemLines] = useState<string[]>([]);
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [revealingPoem, setRevealingPoem] = useState(false);
  const [lastPoemId, setLastPoemId] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const poemTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Effect for revealing poem lines one by one
  useEffect(() => {
    if (revealingPoem && visibleLines < poemLines.length) {
      poemTimeoutRef.current = setTimeout(() => {
        setVisibleLines(prev => prev + 1);
      }, 800);
      
      return () => {
        if (poemTimeoutRef.current) clearTimeout(poemTimeoutRef.current);
      };
    } else if (visibleLines >= poemLines.length) {
      setRevealingPoem(false);
    }
  }, [revealingPoem, visibleLines, poemLines]);

  // When a new assistant message comes in, prepare it for line-by-line reveal
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.role === 'assistant' && latestMessage.id !== lastPoemId) {
      const lines = latestMessage.content.split('\n').filter(line => line.trim() !== '');
      setPoemLines(lines);
      setVisibleLines(0);
      setRevealingPoem(true);
      setLastPoemId(latestMessage.id);
    }
  }, [messages, lastPoemId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      formData.append('file', file);

      const response = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      setInput(data.text);
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      alert(error.message || 'Failed to transcribe audio');
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    try {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error: any) {
      console.error('Error generating speech:', error);
      alert(error.message || 'Failed to generate speech');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || revealingPoem) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const assistantMessage = await response.json();
      
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`
        }
      ]);
    } catch (error) {
      console.error('Error getting completion:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: Date.now(),
          id: `error-${Date.now()}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-silver to-light-sage">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden">
          <div className="h-[700px] flex flex-col">
            <div className="p-4 bg-transparent border-b border-white/20">
              <h1 className="text-3xl font-light tracking-wider text-center text-white">LUMINA CYPHER</h1>
              <p className="text-sm text-white/80 text-center">Provide a topic and Lumina will provide a poem from 2200</p>
            </div>

            {messages.length <= 1 && !isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <p className="text-white/80 text-center mb-4 text-lg">
                  What would you like a poem about?
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {messages.slice(1).map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex flex-col items-center`}
                  >
                    {message.role === 'user' ? (
                      <div className="max-w-[90%] bg-white/20 rounded-xl p-4 mb-2">
                        <p className="text-white">{message.content}</p>
                      </div>
                    ) : (
                      <div className="w-full max-w-[90%]">
                        <p className="text-white/60 text-center text-sm italic mb-4">
                          Transmitted from Lumina Cypher, Year 2200
                        </p>
                        
                        <div className="poem-content">
                          {message.id === lastPoemId && revealingPoem ? (
                            poemLines.slice(0, visibleLines).map((line, i) => (
                              <p 
                                key={i} 
                                className="text-white text-center mb-4 poem-line visible"
                              >
                                {line}
                              </p>
                            ))
                          ) : (
                            message.content.split('\n').filter(line => line.trim()).map((line, i) => (
                              <p key={i} className="text-white text-center mb-4">{line}</p>
                            ))
                          )}
                        </div>
                        
                        <button
                          onClick={() => speakText(message.content)}
                          className="mx-auto flex items-center justify-center mt-4 text-white/60 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                          aria-label="Listen to poem"
                        >
                          <Volume2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-center items-center py-4">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-white/5 border-t border-white/20">
              <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter a topic for your poem..."
                  className="flex-1 p-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                  disabled={isLoading || revealingPoem}
                />
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-3 rounded-lg transition-colors ${
                    isRecording
                      ? 'bg-red-500/80 hover:bg-red-600/80 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  disabled={isLoading || revealingPoem}
                >
                  {isRecording ? <Square size={20} /> : <Mic size={20} />}
                </button>
                <button
                  type="submit"
                  className="p-3 bg-gradient-to-r from-silver/80 to-sage/80 text-black rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!input.trim() || isLoading || revealingPoem}
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
