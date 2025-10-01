"use client";

import { useCallback, useEffect, useState } from "react";

interface VoiceAssistantOptions {
  rate?: number; // Velocidade (0.1 a 10, padrão 1)
  pitch?: number; // Tom (0 a 2, padrão 1)
  volume?: number; // Volume (0 a 1, padrão 1)
}

export const useVoiceAssistant = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Verifica se o navegador suporta Web Speech API
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);

    // Carrega preferência do localStorage
    if (typeof window !== "undefined") {
      const savedPreference = localStorage.getItem("voiceAssistantEnabled");
      setIsEnabled(savedPreference === "true");
    }
  }, []);

  const speak = useCallback(
    (text: string, options: VoiceAssistantOptions = {}) => {
      if (!isSupported || !isEnabled || !text) return;

      // Cancela qualquer fala em andamento
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      // Busca voz em português brasileiro
      const voices = window.speechSynthesis.getVoices();
      const ptBrVoice = voices.find(
        (voice) =>
          voice.lang === "pt-BR" ||
          voice.lang === "pt_BR" ||
          voice.lang.startsWith("pt")
      );

      if (ptBrVoice) {
        utterance.voice = ptBrVoice;
      }

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, isEnabled]
  );

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  const toggle = useCallback(() => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    localStorage.setItem("voiceAssistantEnabled", String(newState));

    if (newState) {
      speak("Assistente de voz ativado");
    } else {
      stop();
    }
  }, [isEnabled, speak, stop]);

  return {
    speak,
    stop,
    toggle,
    isEnabled,
    isSpeaking,
    isSupported,
  };
};
