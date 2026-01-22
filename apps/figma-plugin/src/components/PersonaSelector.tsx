import React, { useState, useEffect } from 'react';
import type { Persona, TargetGroup } from '../types';
import { listPersonas, listTargetGroups } from '../api/audion-client';

interface PersonaSelectorProps {
  selectedPersonaId: string | null;
  defaultPersonaId?: string;
  onPersonaSelect: (persona: Persona | null) => void;
}

export function PersonaSelector({
  selectedPersonaId,
  defaultPersonaId,
  onPersonaSelect,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label
          style={{
            fontSize: '12px',
            fontWeight: '500',
            color: '#666',
          }}
        >
          Select Persona
        </label>

        {isLoading && (
          <div style={{ padding: '8px', fontSize: '14px', color: '#666' }}>
            Loading personas...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '8px',
              fontSize: '14px',
              color: '#c62828',
              backgroundColor: '#ffebee',
              borderRadius: '4px',
            }}
          >
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search personas..."
              style={{
                padding: '6px 8px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '14px',
                marginBottom: '4px',
              }}
            />

            <select
              value={selectedPersonaId || ''}
              onChange={(e) => {
                const persona = personas.find((p) => p.id === e.target.value);
                onPersonaSelect(persona || null);
              }}
              style={{
                padding: '8px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: '#fff',
              }}
            >
              <option value="">-- Select a persona --</option>
              {filteredPersonas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name} ({persona.segment})
                </option>
              ))}
            </select>

            {selectedPersona && (
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                <div style={{ fontWeight: '500' }}>{selectedPersona.name}</div>
                {selectedPersona.headline && (
                  <div style={{ color: '#666', marginTop: '4px' }}>
                    {selectedPersona.headline}
                  </div>
                )}
                <div style={{ color: '#999', marginTop: '4px' }}>
                  {selectedPersona.segment}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}



