import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as NativeSpeechRecognition } from '@capacitor-community/speech-recognition';

// Web Speech API 类型定义
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface WebSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: ((event: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): WebSpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): WebSpeechRecognition;
    };
  }
}

interface SpeechRecognitionOptions {
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition(options?: SpeechRecognitionOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const onResultRef = useRef(options?.onResult);
  const onErrorRef = useRef(options?.onError);

  useEffect(() => {
    onResultRef.current = options?.onResult;
    onErrorRef.current = options?.onError;
  }, [options?.onResult, options?.onError]);

  useEffect(() => {
    const initSpeech = async () => {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Capacitor 移动端环境
        try {
          const { available } = await NativeSpeechRecognition.available();
          if (available) {
            setIsSupported(true);
            
            // 请求权限
            await NativeSpeechRecognition.requestPermissions();
            
            // 监听部分结果
            NativeSpeechRecognition.addListener('partialResults', (data: any) => {
              if (data.matches && data.matches.length > 0 && onResultRef.current) {
                onResultRef.current(data.matches[0], false);
              }
            });
            
            // 错误监听可能没有特定事件，或者可以通过try/catch捕获
          } else {
            setIsSupported(false);
          }
        } catch (err) {
          console.error('Native speech init error', err);
          setIsSupported(false);
        }
      } else {
        // Web 端环境
        if (typeof window !== 'undefined') {
          const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (SpeechRecognitionConstructor) {
            setIsSupported(true);
            const recognition = new SpeechRecognitionConstructor();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'zh-CN';

            recognition.onstart = () => {
              setIsListening(true);
              setError(null);
            };

            recognition.onresult = (event: any) => {
              let interimTranscript = '';
              let finalTranscript = '';

              for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                  finalTranscript += event.results[i][0].transcript;
                } else {
                  interimTranscript += event.results[i][0].transcript;
                }
              }

              if (onResultRef.current) {
                const text = finalTranscript || interimTranscript;
                if (text) {
                  onResultRef.current(text, !!finalTranscript);
                }
              }
            };

            recognition.onerror = (event: any) => {
              console.error('Web Speech recognition error', event.error);
              setError(event.error);
              if (onErrorRef.current) onErrorRef.current(event.error);
              
              if (event.error !== 'no-speech' && event.error !== 'aborted') {
                setIsListening(false);
                shouldListenRef.current = false;
              }
            };

            recognition.onend = () => {
              if (shouldListenRef.current) {
                try {
                  recognition.start();
                } catch (err) {
                  setIsListening(false);
                  shouldListenRef.current = false;
                }
              } else {
                setIsListening(false);
              }
            };

            recognitionRef.current = recognition;
          }
        }
      }
    };

    initSpeech();
    
    return () => {
      shouldListenRef.current = false;
      const isNative = Capacitor.isNativePlatform();
      
      if (isNative) {
        NativeSpeechRecognition.removeAllListeners();
        try {
          NativeSpeechRecognition.stop();
        } catch (e) {}
      } else if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    shouldListenRef.current = true;
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        setIsListening(true);
        setError(null);
        await NativeSpeechRecognition.start({
          language: 'zh-CN',
          maxResults: 1,
          prompt: '请说话...',
          partialResults: true,
          popup: false,
        });
      } catch (err: any) {
        console.error('Failed to start native recognition', err);
        setError(err.message || '启动失败');
        setIsListening(false);
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setError(null);
        } catch (err) {
          console.error('Failed to start web recognition', err);
        }
      }
    }
  }, []);

  const stopListening = useCallback(async () => {
    shouldListenRef.current = false;
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        await NativeSpeechRecognition.stop();
      } catch (err) {
        console.error('Failed to stop native recognition', err);
      } finally {
        setIsListening(false);
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          setIsListening(false);
        } catch (err) {
          console.error('Failed to stop web recognition', err);
        }
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening
  };
}
