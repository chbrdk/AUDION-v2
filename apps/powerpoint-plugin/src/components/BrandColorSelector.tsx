import React from 'react';

export const BRAND_COLORS = [
  { name: 'Purple', value: '#b638ff', optionKey: 'purple' },
  { name: 'Blue', value: '#3b82f6', optionKey: 'blue' },
  { name: 'Pink', value: '#f256b6', optionKey: 'pink' },
  { name: 'Orange', value: '#ff6a3b', optionKey: 'orange' },
  { name: 'Green', value: '#00ca55', optionKey: 'green' },
  { name: 'Yellow', value: '#fef14d', optionKey: 'yellow' },
  { name: 'Grey', value: '#d4d2d2', optionKey: 'grey' },
  { name: 'Default', value: '#0f172a', optionKey: 'default' },
];

interface BrandColorSelectorProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

export function BrandColorSelector({ selectedColor, onColorSelect }: BrandColorSelectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
        BRAND COLOR
      </label>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '8px',
        padding: '4px'
      }}>
        {BRAND_COLORS.map((color) => {
          const isSelected = selectedColor === color.value;
          return (
            <button
              key={color.optionKey}
              onClick={() => onColorSelect(color.value)}
              title={color.name}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: '8px',
                backgroundColor: color.value,
                border: isSelected ? '2px solid #0f172a' : '1px solid rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isSelected && (
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: 'white',
                  boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
