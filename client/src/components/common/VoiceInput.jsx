import React, { useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const VoiceInput = ({ onResult, lang = 'en-IN' }) => {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef(null);

  if (!SpeechRecognition) {
    return (
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
        Voice input is not supported in this browser. Please type your description.
      </p>
    );
  }

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .slice(e.resultIndex)
        .map((r) => r[0].transcript)
        .join(' ');
      onResult(text.trim());
    };
    rec.onerror = (e) => {
      setError(`Voice input stopped: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError('');
    rec.start();
    setListening(true);
  };

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <button
        type="button"
        onClick={toggle}
        className="btn btn-secondary"
        aria-pressed={listening}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
      >
        {listening ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        {listening ? 'Stop listening' : 'Speak your description'}
      </button>
      {error && (
        <p role="alert" style={{ fontSize: '0.8125rem', color: '#B30000' }}>
          {error}
        </p>
      )}
    </div>
  );
};