import React from 'react';
import type { SelectionMetadata } from '../types';

interface SelectionInfoProps {
  selection: SelectionMetadata | null;
  onClearSelection?: () => void;
}

export function SelectionInfo({
  selection,
  onClearSelection,
}: SelectionInfoProps) {
  if (!selection) {
    return (
      <div
        style={{
          padding: '12px',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#856404',
        }}
      >
        Please select an Artboard, Group, or Frame to start chatting.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <div style={{ fontWeight: '500', marginBottom: '4px' }}>
            {selection.name}
          </div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            Type: {selection.type}
          </div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            Size: {Math.round(selection.bounds.width)} × {Math.round(selection.bounds.height)}px
          </div>
          {selection.layers.length > 0 && (
            <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
              Layers: {selection.layers.length}
            </div>
          )}
        </div>
        {onClearSelection && (
          <button
            onClick={onClearSelection}
            style={{
              padding: '4px 8px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Change
          </button>
        )}
      </div>
    </div>
  );
}



