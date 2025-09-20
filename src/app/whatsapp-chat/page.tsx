
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/config/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, MessageSquare, User, Loader2, Check, CheckCheck, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { IncomingMessage } from '@/types';

const MESSAGES_COLLECTION = 'incoming_messages';

function ChatMessage({ msg }: { msg: IncomingMessage }) {
    const isSentByMe = msg.isOutgoing;
    
    const getStatusIcon = () => {
        if (!isSentByMe) return null;
        switch(msg.status) {
            case 'pending': return <Clock className="h-3 w-3 text-primary-foreground/70" />;
            case 'sent': return <Check className="h-4 w-4 text-primary-foreground/70" />;
            case 'read': return <CheckCheck className="h-4 w-4 text-blue-300" />;
            case 'failed': return <AlertTriangle className="h-3 w-3 text-destructive" />;
            default: return null;
        }
    };
    
    return (
        <div className={`flex items-end gap-2 ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
            {!isSentByMe && (
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{msg.supplierName?.substring(0, 2) || 'S'}</AvatarFallback>
                </Avatar>
            )}
            <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg ${isSentByMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                 <div className={`text-xs mt-1.5 flex items-center gap-1 ${isSentByMe ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground'}`}>
                    {isSentByMe && getStatusIcon()}
                    <span>{msg.createdAt && 'toDate' in msg.createdAt ? format( (msg.createdAt as any).toDate(), 'HH:mm') : "agora"}</span>
                </div>
            </div>
        </div>
    );
}

export default function WhatsAppChatPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [conversations, setConversations] = useState<Record<string, IncomingMessage[]>>({});
    const [selectedConversation, setSelectedConversation] = useState<string>('');
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const q = query(
            collection(db, MESSAGES_COLLECTION), 
            where("userId", "==", user.uid),
            orderBy("createdAt", "asc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const groupedMessages: Record<string, IncomingMessage[]> = {};
            snapshot.forEach(doc => {
                const msg = { id: doc.id, ...doc.data() } as IncomingMessage;
                const key = msg.phoneNumber;
                if (!groupedMessages[key]) {
                    groupedMessages[key] = [];
                }
                groupedMessages[key].push(msg);
            });
            setConversations(groupedMessages);
            
            if (!selectedConversation && Object.keys(groupedMessages).length > 0) {
              const latestConversation = Object.entries(groupedMessages).sort(([, a], [, b]) => {
                const lastMsgA = a[a.length - 1];
                const lastMsgB = b[b.length - 1];
                return ((lastMsgB.createdAt as any)?.toDate()?.getTime() || 0) - ((lastMsgA.createdAt as any)?.toDate()?.getTime() || 0);
              })[0];
              if (latestConversation) {
                setSelectedConversation(latestConversation[0]);
              }
            }
            
            setLoading(false);
        }, (error) => {
            console.error("Error fetching chat messages:", error);
            toast({ title: "Erro ao carregar mensagens", description: error.message, variant: "destructive" });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user, toast, selectedConversation]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [conversations, selectedConversation]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !user || !selectedConversation) return;

        const supplierName = conversations[selectedConversation]?.[0]?.supplierName || 'N/A';
        
        const messageData: Omit<IncomingMessage, 'id'> = {
            isOutgoing: true,
            phoneNumber: selectedConversation,
            supplierName,
            message: newMessage.trim(),
            status: 'pending',
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(db, MESSAGES_COLLECTION), messageData);
            setNewMessage('');
        } catch (error: any) {
            toast({ title: "Erro ao enviar mensagem", description: error.message, variant: "destructive" });
        }
    };
    
    const conversationList = Object.entries(conversations).map(([phone, messages]) => {
      const lastMessage = messages[messages.length - 1];
      return {
        phone,
        name: lastMessage.supplierName,
        lastMessage: lastMessage.message,
        timestamp: (lastMessage.createdAt as any)?.toDate(),
      };
    }).sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));

    return (
        <main className="w-full h-[calc(100vh-8rem)]">
            <Card className="h-full flex flex-col md:flex-row shadow-2xl rounded-xl overflow-hidden">
                <aside className="w-full md:w-1/3 lg:w-1/4 border-r flex flex-col">
                    <CardHeader className="p-4 border-b">
                        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-6 w-6"/> Conversas</CardTitle>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        {loading && <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto"/></div>}
                        {!loading && conversationList.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</div>}
                        {conversationList.map(({ phone, name, lastMessage, timestamp }) => (
                            <button key={phone} onClick={() => setSelectedConversation(phone)} className={`w-full text-left p-4 border-b hover:bg-muted ${selectedConversation === phone ? 'bg-muted' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold">{name}</h4>
                                    <p className="text-xs text-muted-foreground">{timestamp ? format(timestamp, 'HH:mm') : ''}</p>
                                </div>
                                <p className="text-sm text-muted-foreground truncate">{lastMessage}</p>
                            </button>
                        ))}
                    </ScrollArea>
                </aside>

                <section className="flex-1 flex flex-col">
                    {selectedConversation && conversations[selectedConversation] ? (
                        <>
                            <header className="p-4 border-b flex items-center gap-3">
                                <Avatar><AvatarFallback>{conversations[selectedConversation][0]?.supplierName.substring(0,2) || 'S'}</AvatarFallback></Avatar>
                                <div>
                                    <h3 className="font-semibold">{conversations[selectedConversation][0]?.supplierName}</h3>
                                    <p className="text-sm text-muted-foreground">{selectedConversation}</p>
                                </div>
                            </header>
                            <ScrollArea className="flex-1 bg-muted/20 p-4" ref={scrollAreaRef}>
                                <div className="space-y-4">
                                    {conversations[selectedConversation].map((msg) => (
                                        <ChatMessage key={msg.id} msg={msg} />
                                    ))}
                                </div>
                            </ScrollArea>
                            <footer className="p-4 border-t">
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder="Digite sua mensagem..." 
                                        value={newMessage} 
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                                        <Send className="h-5 w-5"/>
                                        <span className="sr-only">Enviar</span>
                                    </Button>
                                </div>
                            </footer>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                           <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4"/>
                           <h3 className="text-lg font-semibold">Selecione uma conversa</h3>
                           <p className="text-muted-foreground">Escolha uma conversa da lista para ver as mensagens.</p>
                        </div>
                    )}
                </section>
            </Card>
        </main>
    );
}
