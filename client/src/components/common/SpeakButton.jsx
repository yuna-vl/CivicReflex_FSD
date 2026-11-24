import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export const SpeakButton = ({ text, lang = 'en-IN' }) => {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  if (!supported) return null;

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className="btn btn-secondary"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
    >
      {speaking ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      {speaking ? 'Stop reading' : 'Read status aloud'}
    </button>
  );
};