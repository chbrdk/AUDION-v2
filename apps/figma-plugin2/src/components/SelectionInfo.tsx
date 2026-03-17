import React from 'react';
import type { SelectionMetadata } from '../types';
import { t, Language } from '../translations';

interface SelectionInfoProps {
  selection: SelectionMetadata | null;
  screenshot?: string | null;
  isCapturing?: boolean;
  onCaptureScreenshot: () => void;
  onClearSelection?: () => void;
  lang: Language;
}

export function SelectionInfo({
  selection,
  screenshot,
  isCapturing,
  onCaptureScreenshot,
  onClearSelection,
  lang,
}: SelectionInfoProps) {
  if (!selection) {
    return (
      <div
        className="msqdx-card"
        style={{
          padding: '24px 16px',
          fontSize: '13px',
          color: 'var(--msqdx-primary, #0f172a)',
          textAlign: 'center',
          border: '1px dashed var(--msqdx-primary, #0f172a)',
          background: 'rgba(15, 23, 42, 0.02)'
        }}
      >
        {t('noSelection', lang)}
      </div>
    );
  }

  return (
    <div
      className="msqdx-card"
      style={{
        padding: '12px',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div 
          onClick={onCaptureScreenshot}
          style={{ 
            flexShrink: 0, 
            width: '64px', 
            height: '64px', 
            backgroundColor: 'rgba(15, 23, 42, 0.04)',
            border: screenshot ? '1px solid var(--msqdx-border-color)' : '1px dashed var(--msqdx-border-color)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            position: 'relative',
            transition: 'all 0.2s ease'
          }}
          className="capture-preview"
          title={t('captureTooltip', lang)}
        >
          {screenshot ? (
            <img 
              src={screenshot} 
              alt="Preview" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          ) : (
            <span style={{ fontSize: '20px', filter: 'grayscale(1)' }}>📸</span>
          )}
          {isCapturing && (
            <div 
              className="loading-pulse"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 'bold',
                color: 'white'
              }}
            >
              ...
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: '700', color: 'var(--msqdx-text-main)', fontSize: '15px' }}>
              {selection.name}
            </div>
          </div>
          <div className="msqdx-mono" style={{ color: 'var(--msqdx-text-secondary)', fontSize: '10px', marginTop: '2px', fontWeight: '500' }}>
            {selection.type} • {Math.round(selection.bounds.width)}x{Math.round(selection.bounds.height)}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={onCaptureScreenshot}
              disabled={isCapturing}
              className="msqdx-button"
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                height: '28px'
              }}
            >
              <span className="msqdx-mono" style={{ fontSize: '10px' }}>
                {isCapturing ? t('isCapturing', lang) : t('screenshot', lang)}
              </span>
            </button>
            {onClearSelection && (
              <button
                onClick={onClearSelection}
                className="msqdx-button secondary"
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  height: '28px',
                }}
              >
                <span className="msqdx-mono" style={{ fontSize: '10px' }}>{t('changeSelection', lang)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



