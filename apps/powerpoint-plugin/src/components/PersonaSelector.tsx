import React, { useState, useEffect } from 'react';
import type { Persona, TargetGroup } from '../types';
import { listPersonas, listTargetGroups } from '../api/audion-client';
import { t, Language } from '../translations';

interface PersonaSelectorProps {
  selectedPersonaId: string | null;
  defaultPersonaId?: string;
  onPersonaSelect: (persona: Persona | null) => void;
  lang: Language;
}

export function PersonaSelector({
  selectedPersonaId,
  defaultPersonaId,
  onPersonaSelect,
  lang,
}: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPersonas();
    loadTargetGroups();
  }, []);

  useEffect(() => {
    // Set default persona if available
    if (defaultPersonaId && personas.length > 0 && !selectedPersonaId) {
      const defaultPersona = personas.find((p) => p.id === defaultPersonaId);
      if (defaultPersona) {
        onPersonaSelect(defaultPersona);
      }
    }
  }, [defaultPersonaId, personas, selectedPersonaId, onPersonaSelect]);

  const loadPersonas = async () => {
    try {
      setIsLoading(true);
      const response = await listPersonas(1, 100);
      setPersonas(response.items);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load personas';
      setError(errorMessage);
      console.error('Failed to load personas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTargetGroups = async () => {
    try {
      const response = await listTargetGroups(1, 100);
      setTargetGroups(response.items);
    } catch (err) {
      console.error('Failed to load target groups:', err);
    }
  };

  const filteredPersonas = personas.filter((persona) =>
    persona.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    persona.segment.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {isLoading && (
        <div className="loading-pulse" style={{ padding: '8px', fontSize: '12px', color: 'var(--msqdx-text-secondary)', fontWeight: '500' }}>
          {lang === 'de' ? 'PERSONAS WERDEN GELADEN...' : 'LOADING PERSONAS...'}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px',
            fontSize: '12px',
            color: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.05)',
            border: '1px solid rgba(220, 38, 38, 0.15)',
            borderRadius: '12px',
          }}
        >
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'de' ? 'SUCHEN...' : 'SEARCH...'}
              className="msqdx-mono"
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(15, 23, 42, 0.03)',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '12px',
                fontSize: '11px',
                color: 'var(--msqdx-text-main)',
                outline: 'none',
              }}
            />

            <select
              value={selectedPersonaId || ''}
              onChange={(e) => {
                const persona = personas.find((p) => p.id === e.target.value);
                onPersonaSelect(persona || null);
              }}
              className="msqdx-mono"
              style={{
                flex: 1.5,
                padding: '10px',
                background: 'rgba(15, 23, 42, 0.03)',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '12px',
                fontSize: '11px',
                color: 'var(--msqdx-text-main)',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none'
              }}
            >
              <option value="">{lang === 'de' ? '-- WÄHLEN --' : '-- SELECT --'}</option>
              {filteredPersonas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {selectedPersona && (
            <div
              className="msqdx-card"
              style={{
                padding: '10px',
                marginTop: '4px',
                backgroundColor: 'var(--msqdx-bg-card)',
                boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  backgroundColor: 'var(--msqdx-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: 'white'
                }}>
                  {selectedPersona.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--msqdx-text-main)' }}>{selectedPersona.name}</div>
                  <div className="msqdx-mono" style={{ color: 'var(--msqdx-text-secondary)', fontSize: '9px', fontWeight: '500' }}>
                    {selectedPersona.segment}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}



