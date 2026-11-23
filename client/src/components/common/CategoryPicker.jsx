import React from 'react';
import { Construction, Trash2, Lightbulb, Droplets, Accessibility, Moon } from 'lucide-react';

const ICONS = {
  roads: Construction,
  sanitation: Trash2,
  lighting: Lightbulb,
  drainage: Droplets,
  accessibility: Accessibility,
  public_safety: Moon,
};

export const CategoryPicker = ({ categories, value, onChange }) => (
  <div
    role="radiogroup"
    aria-label="Issue category"
    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}
  >
    {categories.map(({ key, label }) => {
      const Icon = ICONS[key];
      const selected = value === key;
      return (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(key)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1rem 0.5rem',
            border: selected ? '2px solid var(--color-gov-blue)' : '1px solid var(--color-border-dark)',
            background: selected ? '#EDF2F7' : '#FFFFFF',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            color: '#1A2533',
          }}
        >
          {Icon && <Icon size={28} aria-hidden="true" />}
          <span>{label}</span>
        </button>
      );
    })}
  </div>
);