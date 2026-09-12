import { useRef, useState, useCallback, useEffect } from 'react';

interface UseGeminiLiveReturn {
  isConnected: boolean;
  isListening: boolean;
  transcript: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudio: (audioData: ArrayBuffer) => void;
  sendText: (text: string) => void;
}

/**
 * Hook for connecting to Gemini Live API via WebSocket
 * for conversational voice verification during emergencies.
 */
export function useGeminiLive(
  apiKey?: string,
  onResponse?: (text: string) => void
): UseGeminiLiveReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';

  const connect = useCallback(async () => {
    if (wsRef.current) return;

    try {
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[GEMINI_LIVE] WebSocket connected');
        setIsConnected(true);

        // Send setup message
        ws.send(
          JSON.stringify({
            setup: {
              model: 'models/gemini-2.5-flash',
              generationConfig: {
                responseModalities: ['TEXT'],
              },
              systemInstruction: {
                parts: [
                  {
                    text: `You are Sarthak, a caring and calm emergency verification assistant for elderly people. 
                    You are speaking to an elderly person who may have fallen or be in distress.
                    Speak simply, slowly, and reassuringly. Ask if they are okay.
                    If they say they are fine, confirm and end the conversation.
                    If they express pain or need help, reassure them that help is on the way.
                    Respond in the same language the user speaks (English or Hindi).`,
                  },
                ],
              },
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.serverContent?.modelTurn?.parts) {
            const text = data.serverContent.modelTurn.parts
              .filter((p: any) => p.text)
              .map((p: any) => p.text)
              .join('');

            if (text) {
              setTranscript((prev) => prev + ' ' + text);
              onResponse?.(text);
            }
          }
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onerror = (err) => {
        console.error('[GEMINI_LIVE] WebSocket error:', err);
      };

      ws.onclose = () => {
        console.log('[GEMINI_LIVE] WebSocket disconnected');
        setIsConnected(false);
        setIsListening(false);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[GEMINI_LIVE] Connection failed:', err);
    }
  }, [key, onResponse]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsListening(false);
  }, []);

  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          turnComplete: true,
        },
      })
    );

    setTranscript((prev) => prev + `\nUser: ${text}`);
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioData))
    );

    wsRef.current.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Audio,
            },
          ],
        },
      })
    );

    setIsListening(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    isListening,
    transcript,
    connect,
    disconnect,
    sendAudio,
    sendText,
  };
}
