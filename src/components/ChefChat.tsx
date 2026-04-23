import React, { useState, useEffect, useRef } from 'react';
import { db, collection, auth, addDoc, serverTimestamp, doc, updateDoc, setDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { AnimatePresence, motion } from 'framer-motion';
import { ChefHat, Sparkles, MessageSquare, Plus, Cpu, AlertCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { Logo } from './Logo';

// Types
import { ChatMessageData, ConversationData } from '../types/chat';

// Hooks
import { useChefChat } from '../hooks/useChefChat';
import { useGoogleServices } from '../hooks/useGoogleServices';
import { useAiProcessing } from '../hooks/useAiProcessing';

// Components
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { ChatInput } from './chat/ChatInput';

interface ChefChatProps {
  preferences: any;
  updatePreference: (key: string, value: any) => void;
  setActiveTab?: (tab: any) => void;
}

export function ChefChat({ preferences, updatePreference, setActiveTab }: ChefChatProps) {
  // State for UI only
  const [showHistory, setShowHistory] = useState(false);
  const [showMonologue, setShowMonologue] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | 'all' | null>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);
  const [savingImageUrls, setSavingImageUrls] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<{data: string, mimeType: string, name: string}[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isRecipeCrawActive, setIsRecipeCrawActive] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { 
    conversations, 
    messages, 
    activeConversationId, 
    setActiveConversationId,
    createNewConversation,
    deleteConversation,
    updateConversationTitle,
    deleteAllHistory
  } = useChefChat();

  const {
    googleToken,
    // connectGoogle,
    // searchDrive,
    // searchPhotos,
    // searchKeep,
    // isConnectingGoogle
  } = useGoogleServices();

  const {
    isProcessing: isGlobalProcessing,
    streamingText,
    // triggerAiResponse,
    error,
    setError
  } = useAiProcessing(activeConversationId, messages, preferences);

  const isActuallyTyping = messages.some(m => m.sender === 'user' && (m.status === 'pending' || m.status === 'processing'));

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isActuallyTyping]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if ((!textToSend.trim() && selectedFiles.length === 0) || !auth.currentUser) return;

    let convId = activeConversationId;
    if (!convId) {
      try {
        const convRef = await addDoc(collection(db, 'conversations'), {
          title: textToSend.slice(0, 30) + (textToSend.length > 30 ? '...' : ''),
          userId: auth.currentUser.uid,
          lastMessage: textToSend,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        convId = convRef.id;
        setActiveConversationId(convId);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'conversations');
        return;
      }
    }

    const userMessage = {
      text: textToSend,
      sender: 'user',
      userId: auth.currentUser.uid,
      conversationId: convId,
      timestamp: serverTimestamp(),
      hasFiles: selectedFiles.length > 0,
      fileNames: selectedFiles.map(f => f.name),
      files: selectedFiles,
      status: 'pending'
    };

    setInputText('');
    setSelectedFiles([]);
    try {
      await addDoc(collection(db, 'chats'), userMessage);
      await updateDoc(doc(db, 'conversations', convId), {
        lastMessage: textToSend,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const handleSuggestionClick = (suggestion: {label: string, action: string}) => {
    if (suggestion.action === 'retry') {
      const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
      if (lastUserMsg) handleSend(lastUserMsg.text);
      return;
    }
    handleSend(suggestion.label);
  };

  const saveRecipeFromChat = async (msg: ChatMessageData) => {
    if (!auth.currentUser || !msg.recipe) return;
    setSavingRecipeId(msg.id);
    try {
      await addDoc(collection(db, 'recipes'), {
        ...msg.recipe,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        theme: "Lưu từ Chat"
      });
      setTimeout(() => setSavingRecipeId(null), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'recipes');
      setSavingRecipeId(null);
    }
  };

  const saveImage = async (url: string, filename: string) => {
    if (!auth.currentUser) return;
    setSavingImageUrls(prev => new Set(prev).add(url));
    try {
      await addDoc(collection(db, 'saved_images'), {
        url,
        filename,
        title: filename || "Hình ảnh từ Chat",
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        source: 'chef_chat'
      });
      setTimeout(() => {
        setSavingImageUrls(prev => {
          const next = new Set(prev);
          next.delete(url);
          return next;
        });
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'saved_images');
      setSavingImageUrls(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setFileError(null);
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'];

    const validFiles: {data: string, mimeType: string, name: string}[] = [];
    
    for (const file of Array.from(files) as File[]) {
      if (file.size > MAX_SIZE) {
        setFileError(`File "${file.name}" exceeds 10MB limit.`);
        continue;
      }
      if (!SUPPORTED_TYPES.includes(file.type)) {
        setFileError(`Format "${file.type}" not supported.`);
        continue;
      }

      const reader = new FileReader();
      const promise = new Promise<{data: string, mimeType: string, name: string}>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ data: base64, mimeType: file.type, name: file.name });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      validFiles.push(await promise);
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-full bg-white overflow-hidden relative">
      {/* Sidebar - Desktop Only Rail */}
      <aside className="hidden lg:flex w-16 flex-col bg-white border-r border-neutral-100 z-30 shrink-0">
        <div className="flex-1 py-8 flex flex-col items-center gap-10">
          <Logo size={20} />
          
          <div className="flex flex-col gap-6">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "w-10 h-10 rounded-[1.25rem] flex items-center justify-center transition-all duration-500",
                showHistory ? "bg-neutral-900 text-white shadow-xl scale-110" : "text-neutral-300 hover:text-neutral-900 hover:bg-neutral-50"
              )}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            
            <button 
              onClick={createNewConversation}
              className="w-10 h-10 rounded-[1.25rem] flex items-center justify-center text-neutral-300 hover:text-neutral-900 hover:bg-neutral-50 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-50 flex flex-col items-center gap-4">
           <button onClick={() => updatePreference('showInternalThoughts', !preferences.showInternalThoughts)} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", preferences.showInternalThoughts ? "bg-neutral-900 text-white" : "text-neutral-300 hover:text-neutral-900")}>
            <Cpu className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTab?.('profile')} className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-300 hover:text-neutral-900 transition-all">
            <User className="w-5 h-5" />
          </button>
        </div>
      </aside>

      <ChatSidebar 
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        conversations={conversations}
        activeConversationId={activeConversationId}
        setActiveConversationId={setActiveConversationId}
        createNewConversation={createNewConversation}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        <ChatHeader 
          setShowHistory={setShowHistory}
          activeConversation={conversations.find(c => c.id === activeConversationId)}
          editingTitle={editingTitle}
          setEditingTitle={setEditingTitle}
          tempTitle={tempTitle}
          setTempTitle={setTempTitle}
          updateConversationTitle={updateConversationTitle}
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
          deleteConversation={deleteConversation}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isRecipeCrawActive={isRecipeCrawActive}
          setIsRecipeCrawActive={setIsRecipeCrawActive}
          createNewConversation={createNewConversation}
        />

        <MessageList 
          messages={messages}
          searchQuery={searchQuery}
          showMonologue={showMonologue}
          setShowMonologue={setShowMonologue}
          preferences={preferences}
          saveRecipeFromChat={saveRecipeFromChat}
          savingRecipeId={savingRecipeId}
          saveImage={saveImage}
          savingImageUrls={savingImageUrls}
          handleSuggestionClick={handleSuggestionClick}
          scrollRef={scrollRef}
          inputText={inputText}
          setInputText={setInputText}
          streamingText={streamingText}
        />

        <ChatInput 
          inputText={inputText}
          setInputText={setInputText}
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          fileError={fileError}
          setFileError={setFileError}
          handleSend={() => handleSend()}
          handleFileChange={handleFileChange}
          isProcessing={isGlobalProcessing}
          isActuallyTyping={isActuallyTyping}
          preferences={preferences}
          updatePreference={updatePreference}
        />
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-10 luxury-shadow text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-display font-semibold text-neutral-900">Xác nhận xóa</h3>
                <p className="text-sm text-neutral-400 font-medium">Hành động này sẽ xóa vĩnh viễn cuộc hội thoại?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="py-4 bg-neutral-50 text-neutral-900 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-100 transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={() => {
                    if (showDeleteConfirm === 'all') {
                      deleteAllHistory();
                    } else {
                      deleteConversation(showDeleteConfirm);
                    }
                    setShowDeleteConfirm(null);
                  }}
                  className="py-4 bg-red-500 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all"
                >
                  Xác nhận
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
