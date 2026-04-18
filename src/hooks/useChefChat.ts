import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, auth, deleteDoc, doc, getDocs, updateDoc, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { ChatMessageData, ConversationData } from '../types/chat';

export function useChefChat() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Conversations listener
  useEffect(() => {
    if (!auth.currentUser) return;

    const convQ = query(
      collection(db, 'conversations'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(convQ, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ConversationData[];
      setConversations(convs);
      if (convs.length > 0 && !activeConversationId) {
        setActiveConversationId(convs[0].id);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  // Messages listener
  useEffect(() => {
    if (!auth.currentUser || !activeConversationId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('conversationId', '==', activeConversationId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessageData[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [activeConversationId]);

  const createNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  const deleteConversation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'conversations', id));
      const msgSnapshot = await getDocs(query(collection(db, 'chats'), where('conversationId', '==', id)));
      await Promise.all(msgSnapshot.docs.map(d => deleteDoc(d.ref)));
      if (activeConversationId === id) createNewConversation();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'conversations');
    }
  };

  const deleteAllHistory = async () => {
    if (!auth.currentUser) return;
    try {
      const convs = await getDocs(query(collection(db, 'conversations'), where('userId', '==', auth.currentUser.uid)));
      const chats = await getDocs(query(collection(db, 'chats'), where('userId', '==', auth.currentUser.uid)));
      await Promise.all([
        ...convs.docs.map(d => deleteDoc(d.ref)),
        ...chats.docs.map(d => deleteDoc(d.ref))
      ]);
      createNewConversation();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'history');
    }
  };

  const updateConversationTitle = async (id: string, title: string) => {
    if (!title.trim()) return;
    try {
      await updateDoc(doc(db, 'conversations', id), {
        title,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'conversations');
    }
  };

  return {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    createNewConversation,
    deleteConversation,
    deleteAllHistory,
    updateConversationTitle
  };
}
