import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ChefHat, Sparkles, FileText, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';
import { ChatMessageData } from '../../types/chat';
import { RecipeCard } from './RecipeCard';

interface MessageListProps {
  messages: ChatMessageData[];
  searchQuery: string;
  showMonologue: Record<string, boolean>;
  setShowMonologue: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  preferences: any;
  saveRecipeFromChat: (msg: ChatMessageData) => void;
  savingRecipeId: string | null;
  saveImage: (url: string, filename: string) => void;
  savingImageUrls: Set<string>;
  handleSuggestionClick: (suggestion: { label: string, action: string }) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  inputText: string;
  setInputText: (text: string) => void;
  streamingText?: string;
}

export function MessageList({
  messages,
  searchQuery,
  showMonologue,
  setShowMonologue,
  preferences,
  saveRecipeFromChat,
  savingRecipeId,
  saveImage,
  savingImageUrls,
  handleSuggestionClick,
  scrollRef,
  inputText,
  setInputText,
  streamingText
}: MessageListProps) {
  const filteredMessages = messages.filter(m => 
    (m.text || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-12 py-12 space-y-12 no-scrollbar scroll-smooth">
      {filteredMessages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center p-8 space-y-12 opacity-40">
          <div className="relative">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] luxury-shadow flex items-center justify-center border border-neutral-50">
              <ChefHat className="w-12 h-12 text-neutral-900" />
            </div>
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-2xl luxury-shadow flex items-center justify-center border border-neutral-50"
            >
              <Sparkles className="w-6 h-6 text-neutral-900" />
            </motion.div>
          </div>
          
          <div className="text-center space-y-4 max-w-sm">
            <h3 className="text-3xl font-display font-semibold text-neutral-900 tracking-tight">The Culinary Oracle</h3>
            <p className="text-neutral-400 text-sm leading-relaxed font-medium">
              Commence a dialogue to engineer recipes, optimize food costs, or refine your culinary vision.
            </p>
          </div>

          {!searchQuery && (
            <div className="flex flex-wrap justify-center gap-3 max-w-xl">
              {['Optimize Food Cost', 'Architect Menu', 'Sourcing Engine', 'Yield Analysis'].map((hint) => (
                <button
                  key={hint}
                  onClick={() => setInputText(hint)}
                  className="px-8 py-3 bg-white border border-neutral-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-all luxury-shadow active:scale-95"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        filteredMessages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: idx * 0.05 }}
            className={cn(
              "flex gap-6 w-full max-w-4xl mx-auto",
              msg.sender === 'user' ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
              msg.sender === 'user' ? "bg-neutral-900" : "bg-neutral-50 border border-neutral-100"
            )}>
              {msg.sender === 'user' ? <User className="w-5 h-5 text-white" /> : <ChefHat className="w-5 h-5 text-neutral-900" />}
            </div>
            
            <div className={cn(
              "flex-1 space-y-4 min-w-0",
              msg.sender === 'user' ? "text-right" : "text-left"
            )}>
              <div className={cn(
                "inline-block rounded-[2rem] text-sm leading-[1.8] transition-all max-w-full",
                msg.sender === 'user' 
                  ? "bg-neutral-900 text-white px-8 py-5 shadow-xl shadow-neutral-900/10" 
                  : "bg-white border border-neutral-100 px-8 py-5 luxury-shadow text-neutral-800"
              )}>
                {msg.files && msg.files.length > 0 && (
                  <div className={cn("flex flex-wrap gap-3 mb-4", msg.sender === 'user' ? "justify-end" : "justify-start")}>
                    {msg.files.map((file, i) => (
                      <div key={i} className="relative group/file">
                        {file.mimeType.startsWith('image/') ? (
                          <div className="relative overflow-hidden rounded-2xl border border-white/10 luxury-shadow">
                             <img 
                              src={`data:${file.mimeType};base64,${file.data}`} 
                              alt={file.name}
                              className="w-48 h-48 object-cover group-hover/file:scale-110 transition-transform duration-700 cursor-pointer"
                              referrerPolicy="no-referrer"
                              onClick={() => window.open(`data:${file.mimeType};base64,${file.data}`, '_blank')}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-neutral-100/50 backdrop-blur-sm px-4 py-2.5 rounded-full border border-neutral-200/50">
                            <FileText className="w-4 h-4 text-neutral-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 truncate max-w-[120px]">{file.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={cn(
                  "markdown-body prose prose-neutral prose-sm max-w-none prose-p:leading-[1.8] prose-headings:font-display prose-headings:font-semibold prose-strong:text-inherit",
                  msg.sender === 'user' ? "text-white prose-invert" : "text-neutral-800"
                )}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                </div>

                {preferences.showInternalThoughts && msg.internalMonologue && (
                  <div className="mt-6 border-t border-neutral-100 pt-4 overflow-hidden">
                    <button 
                      onClick={() => setShowMonologue(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      className="flex items-center gap-2 mb-2 group/mon"
                    >
                      <div className="w-1 h-1 bg-neutral-300 rounded-full group-hover/mon:bg-neutral-900 transition-colors" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-300 group-hover/mon:text-neutral-900 transition-colors">Internal Reasoning</span>
                      <ChevronDown className={cn("w-3 h-3 text-neutral-200 transition-transform duration-500", showMonologue[msg.id] ? "rotate-180" : "rotate-0")} />
                    </button>
                    <AnimatePresence>
                      {showMonologue[msg.id] && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="font-mono text-[10px] text-neutral-400 italic leading-relaxed pl-3 border-l-[1px] border-neutral-100"
                        >
                          {msg.internalMonologue}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {msg.recipe && (
                <div className={cn("flex", msg.sender === 'user' ? "justify-end" : "justify-start")}>
                  <RecipeCard 
                    recipe={msg.recipe} 
                    onSave={() => saveRecipeFromChat(msg)}
                    isSaving={savingRecipeId === msg.id}
                    onSaveImage={() => msg.recipe?.image && saveImage(msg.recipe.image, msg.recipe.title)}
                    isSavingImage={msg.recipe?.image ? savingImageUrls.has(msg.recipe.image) : false}
                  />
                </div>
              )}

              {msg.sender === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {msg.suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-5 py-2.5 bg-neutral-50 hover:bg-neutral-900 text-neutral-500 hover:text-white rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border border-neutral-100 hover:border-neutral-900"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))
      )}

      {streamingText && (
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className="flex gap-6 w-full max-w-4xl mx-auto flex-row"
        >
           <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-neutral-50 border border-neutral-100 dark:bg-white/5 dark:border-white/10">
              <Sparkles className="w-5 h-5 text-neutral-900 dark:text-emerald-400 animate-pulse" />
           </div>
           <div className="flex-1 space-y-4 min-w-0">
              <div className="inline-block rounded-[2rem] text-sm leading-[1.8] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-white/5 px-8 py-5 luxury-shadow text-neutral-800 dark:text-neutral-200">
                 <div className="markdown-body prose prose-neutral dark:prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                 </div>
              </div>
           </div>
        </motion.div>
      )}

      <div ref={scrollRef} className="h-4" />
    </div>
  );
}
