import React, { useState, useEffect } from 'react';
import { listJourneys, getJourney } from '../api/audion-client';
import { JourneyResponse } from '../types';
import { t, Language } from '../translations';

interface JourneysPanelProps {
  lang: Language;
  projectId?: string;
}

export function JourneysPanel({ lang, projectId }: JourneysPanelProps) {
  const [journeys, setJourneys] = useState<JourneyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [isVisualizing, setIsVisualizing] = useState(false);

  useEffect(() => {
    loadJourneys();
  }, [projectId]);

  const loadJourneys = async () => {
    try {
      if (!projectId) {
        setJourneys([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const response = await listJourneys(projectId, 1, 50);
      setJourneys(response || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journeys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisualize = async (journeyId: string) => {
    try {
      setIsVisualizing(true);
      const journey = await getJourney(journeyId);
      
      parent.postMessage({ 
        pluginMessage: { 
          type: 'visualize-journey', 
          journey 
        } 
      }, '*');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch journey details');
    } finally {
      setIsVisualizing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div className="msqdx-card" style={{ padding: '16px' }}>
        <div className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '700', color: 'var(--msqdx-primary)', marginBottom: '16px' }}>
          {t('selectJourney', lang)}
        </div>

        {isLoading && (
          <div className="loading-pulse" style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)', textAlign: 'center', padding: '20px' }}>
            {t('loadingJourneys', lang)}
          </div>
        )}

        {error && (
          <div className="msqdx-mono" style={{ padding: '10px', backgroundColor: 'rgba(220, 38, 38, 0.05)', color: '#dc2626', borderRadius: '12px', fontSize: '10px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {!isLoading && (journeys?.length === 0) && !error && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--msqdx-text-secondary)', fontSize: '12px' }}>
            {t('noJourneys', lang)}
          </div>
        )}

        <div className="scroll-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px' }}>
          {(journeys || []).map((journey) => (
            <div 
              key={journey.id}
              onClick={() => setSelectedJourneyId(journey.id)}
              className="msqdx-card"
              style={{
                padding: '12px',
                cursor: 'pointer',
                border: selectedJourneyId === journey.id ? '2px solid var(--msqdx-primary)' : '1px solid var(--msqdx-border-color)',
                backgroundColor: selectedJourneyId === journey.id ? 'rgba(15, 23, 42, 0.02)' : 'var(--msqdx-bg-card)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{journey.name}</div>
              <div className="msqdx-mono" style={{ fontSize: '9px', color: 'var(--msqdx-text-secondary)' }}>
                {(journey.journey_type || '').toUpperCase()} • {journey.phases?.length || 0} {t('phases', lang)}
              </div>
              
              {selectedJourneyId === journey.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVisualize(journey.id);
                  }}
                  disabled={isVisualizing}
                  className="msqdx-button"
                  style={{ width: '100%', marginTop: '12px', height: '32px' }}
                >
                  <span className="msqdx-mono" style={{ fontSize: '10px' }}>
                    {isVisualizing ? t('visualizing', lang) : t('visualizeInFigma', lang)}
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
