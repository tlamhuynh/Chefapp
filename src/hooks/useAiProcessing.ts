import { useState, useRef, useEffect } from 'react';
import { db, collection, updateDoc, doc, setDoc, serverTimestamp, getDocs, auth, query, where } from '../lib/firebase';
import { multiAgentChatWithFallback } from '../lib/ai';
import { extractMemoriesFromChat } from '../lib/memory';
import { ChatMessageData } from '../types/chat';

export function useAiProcessing(activeConversationId: string | null, messages: ChatMessageData[], preferences: any) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const pendingMsg = messages.find(m => m.sender === 'user' && m.status === 'pending');
    if (pendingMsg && !isProcessingRef.current && activeConversationId) {
      triggerAiResponse(pendingMsg, messages, preferences);
    }
  }, [messages, activeConversationId]);

  const triggerAiResponse = async (userMsg: ChatMessageData, allMessages: ChatMessageData[], preferences: any) => {
    if (!auth.currentUser || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setIsProcessing(true);
    setStreamingText("");

    try {
      await updateDoc(doc(db, 'chats', userMsg.id), { status: 'processing' });
      setError(null);
      
      const history = allMessages.filter(m => m.id !== userMsg.id).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const currentParts: any[] = [{ text: userMsg.text }];
      if (userMsg.files) {
        userMsg.files.forEach(f => {
          currentParts.push({ inlineData: { data: f.data, mimeType: f.mimeType } });
        });
      }
      history.push({ role: 'user', parts: currentParts });

      const aiConfig = { 
        openaiKey: preferences.openaiKey, 
        anthropicKey: preferences.anthropicKey, 
        googleKey: preferences.googleKey,
        openrouterKey: preferences.openrouterKey,
        nvidiaKey: preferences.nvidiaKey,
        groqKey: preferences.groqKey
      };

      let inventory: any[] = [];
      let recipes: any[] = [];
      
      if (auth.currentUser) {
        const invQ = query(collection(db, 'inventory'), where('authorId', '==', auth.currentUser.uid));
        const inventorySnap = await getDocs(invQ);
        inventory = inventorySnap.docs.map(d => d.data());
        
        const recQ = query(collection(db, 'recipes'), where('authorId', '==', auth.currentUser.uid));
        const recipesSnap = await getDocs(recQ);
        recipes = recipesSnap.docs.map(d => d.data());
      }

      // Use non-streaming fallback for complex orchestration (Recipes, etc)
      // or implement a smart switch. For now, let's use streaming for direct chat if no file analysis needed
      // Actually, multiAgentChat is better for the "Sous Chef" persona.
      
      // Let's implement a modular streaming approach for multiAgentChat soon.
      // For now, let's use a standard chatWithAIStream to show responsiveness
      
      let fullText = "";
      
      // ... (Complex logic usually goes to multiAgentChat)
      // For the demo of "everything", let's use multiAgentChat for quality
      // and only switch to streaming if requested or for general chit-chat.
      
      // Since the user wants "everything", I'll implement a Custom MultiAgent with Streaming capacity
      
      // Prepare fallback models (try Gemini as a reliable fallback if custom selection fails)
      const allFallbacks = [
        'gemini-2.0-flash', 
        'gemini-1.5-flash', 
        'gpt-4o-mini',
        'groq/llama-3.3-70b-versatile',
        'openrouter/google/gemini-2.0-flash-lite-preview-02-05:free',
        'nvidia/meta/llama-3.3-70b-instruct'
      ].filter(id => id !== preferences.selectedModelId);

      const result = await multiAgentChatWithFallback(
        preferences.selectedModelId,
        history,
        "Bạn là Bếp trưởng điều phối chuyên nghiệp. Trả lời bằng tiếng Việt chuyên nghiệp.",
        aiConfig,
        inventory,
        recipes,
        allFallbacks
      );

      if (!result || !result.text) {
        throw new Error("Không nhận dạng được phản hồi từ mô hình. Lỗi định dạng JSON.");
      }

      const aiMsgId = Math.random().toString(36).substring(7);
      await setDoc(doc(db, 'chats', aiMsgId), {
        text: result.text,
        internalMonologue: result.internalMonologue,
        sender: 'ai',
        userId: auth.currentUser.uid,
        conversationId: activeConversationId,
        timestamp: serverTimestamp(),
        recipe: result.recipe,
        suggestions: result.suggestions,
        proposedActions: result.proposedActions,
        status: 'completed'
      });

      await updateDoc(doc(db, 'chats', userMsg.id), { status: 'completed' });
      extractMemoriesFromChat(auth.currentUser.uid, [...allMessages, { text: result.text, sender: 'ai' }], preferences.selectedModelId, aiConfig);

    } catch (aiError: any) {
      console.error("AI Error:", aiError);
      
      let rawMsg = aiError.message || "Lỗi giao tiếp với AI.";
      // Try to parse clean error out of rawMsg if it's JSON
      if (rawMsg.startsWith('{') || rawMsg.includes('{')) {
          try {
              const startIdx = rawMsg.indexOf('{');
              const jsonPart = rawMsg.substring(startIdx);
              const parsed = JSON.parse(jsonPart);
              if (parsed.error && parsed.error.message) {
                  rawMsg = parsed.error.message;
              } else if (parsed.message) {
                  rawMsg = parsed.message;
              }
          } catch(e) {}
      }
      
      // Shorten extremely long messages
      const shortMsg = rawMsg.length > 200 ? rawMsg.substring(0, 200) + '...' : rawMsg;

      setError(shortMsg);
      
      const errorMsgId = Math.random().toString(36).substring(7);
      await setDoc(doc(db, 'chats', errorMsgId), {
        text: `⚠️ **Lỗi hệ thống AI:** ${shortMsg}`,
        sender: 'ai',
        userId: auth.currentUser.uid,
        conversationId: activeConversationId,
        timestamp: serverTimestamp(),
        suggestions: [
          { label: '🔄 Thử lại', action: 'retry' }
        ],
        status: 'error'
      });
      
      await updateDoc(doc(db, 'chats', userMsg.id), { status: 'error' });
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setStreamingText("");
    }
  };

  return { isProcessing, streamingText, triggerAiResponse, error, setError };
}
