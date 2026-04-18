import { useState, useRef, useEffect } from 'react';
import { db, collection, updateDoc, doc, setDoc, serverTimestamp, getDocs, auth } from '../lib/firebase';
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

      const inventorySnap = await getDocs(collection(db, 'inventory'));
      const inventory = inventorySnap.docs.map(d => d.data());
      const recipesSnap = await getDocs(collection(db, 'recipes'));
      const recipes = recipesSnap.docs.map(d => d.data());

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
      
      const result = await multiAgentChatWithFallback(
        preferences.selectedModelId,
        history,
        "Bạn là Bếp trưởng điều phối chuyên nghiệp. Trả lời bằng tiếng Việt chuyên nghiệp.",
        aiConfig,
        inventory,
        recipes,
        ['gemini-2.0-flash']
      );

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
        status: 'completed'
      });

      await updateDoc(doc(db, 'chats', userMsg.id), { status: 'completed' });
      extractMemoriesFromChat(auth.currentUser.uid, [...allMessages, { text: result.text, sender: 'ai' }], preferences.selectedModelId, aiConfig);

    } catch (aiError: any) {
      console.error("AI Error:", aiError);
      setError(aiError.message || "Lỗi AI.");
      await updateDoc(doc(db, 'chats', userMsg.id), { status: 'error' });
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setStreamingText("");
    }
  };

  return { isProcessing, streamingText, triggerAiResponse, error, setError };
}
