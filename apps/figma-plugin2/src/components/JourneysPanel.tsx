import React, { useState, useEffect, useMemo } from 'react';
import { listJourneys, getJourney, listPersonas, listTargetGroups } from '../api/audion-client';
import type { JourneyResponse, Persona, TargetGroup } from '../types';
import { t, Language } from '../translations';
import { buildJourneyScreenBriefRequestBody } from '../services/journey-screen-brief-payload';
import type { ViewportChoice } from './PromptSiteToFigmaPanel';
import {
  JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY,
  JOURNEY_PROMPT_SITE_RENDER_MODE,
} from '../config/journey-prompt-site';

interface JourneysPanelProps {
  lang: Language;
  projectId?: string;
  pluginLanguage?: 'de' | 'en';
  creationReady: boolean;
  journeyBriefLoading: boolean;
  onJourneyBriefStart: () => void;
}

export function JourneysPanel({
  lang,
  projectId,
  pluginLanguage,
  creationReady,
  journeyBriefLoading,
  onJourneyBriefStart,
}: JourneysPanelProps) {
  const [journeys, setJourneys] = useState<JourneyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [journeyDetail, setJourneyDetail] = useState<JourneyResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([]);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [phaseId, setPhaseId] = useState<string>('');
  const [personaId, setPersonaId] = useState<string>('');
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [briefViewport, setBriefViewport] = useState<ViewportChoice>('desktop');

  useEffect(() => {
    loadJourneys();
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!projectId) {
        setPersonas([]);
        setTargetGroups([]);
        return;
      }
      try {
        setPersonasError(null);
        const [pRes, tgRes] = await Promise.all([
          listPersonas(1, 100),
          listTargetGroups(1, 100),
        ]);
        if (cancelled) return;
        setPersonas(pRes?.items ?? []);
        setTargetGroups(tgRes?.items ?? []);
      } catch (e) {
        if (!cancelled) {
          setPersonasError(e instanceof Error ? e.message : t('journeyLoadPersonasError', lang));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, lang]);

  useEffect(() => {
    let cancelled = false;
    const loadDetail = async () => {
      if (!selectedJourneyId) {
        setJourneyDetail(null);
        setPhaseId('');
        return;
      }
      setDetailLoading(true);
      try {
        const j = await getJourney(selectedJourneyId);
        if (cancelled) return;
        setJourneyDetail(j);
        const phases = [...(j.phases ?? [])].sort((a, b) => a.phase_order - b.phase_order);
        setPhaseId(phases[0]?.id ?? '');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('journeyFetchDetailError', lang));
          setJourneyDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedJourneyId, lang]);

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

  const sortedPhases = useMemo(() => {
    if (!journeyDetail?.phases) return [];
    return [...journeyDetail.phases].sort((a, b) => a.phase_order - b.phase_order);
  }, [journeyDetail]);

  const selectedPersona = personas.find((p) => p.id === personaId) ?? null;
  const selectedTargetGroup =
    targetGroupId === '' ? null : targetGroups.find((g) => g.id === targetGroupId) ?? null;

  const handleVisualize = async (journeyId: string) => {
    try {
      setIsVisualizing(true);
      const journey = await getJourney(journeyId);

      parent.postMessage(
        {
          pluginMessage: {
            type: 'visualize-journey',
            journey,
          },
        },
        '*'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch journey details');
    } finally {
      setIsVisualizing(false);
    }
  };

  const postBrief = (chainGenerate: boolean) => {
    if (!journeyDetail || !phaseId || !selectedPersona) return;
    if (!creationReady) return;
    try {
      const body = buildJourneyScreenBriefRequestBody(journeyDetail, phaseId, selectedPersona, {
        targetGroup: selectedTargetGroup,
        locale: pluginLanguage === 'en' ? 'en' : 'de',
        componentLibrary: JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY,
        renderMode: JOURNEY_PROMPT_SITE_RENDER_MODE,
      });
      onJourneyBriefStart();
      parent.postMessage(
        {
          pluginMessage: {
            type: 'journey-screen-brief',
            body,
            chainGenerate,
            viewport: briefViewport,
            componentLibrary: JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY,
            renderMode: JOURNEY_PROMPT_SITE_RENDER_MODE,
          },
        },
        '*'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const canBrief =
    creationReady &&
    !!journeyDetail &&
    !!phaseId &&
    !!selectedPersona &&
    !journeyBriefLoading &&
    !detailLoading;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        flexShrink: 0,
        /* Avoid height:100% here — inside flex parents it steals the full viewport and breaks scroll / hit-testing in the Figma plugin UI. */
      }}
    >
      <div className="msqdx-card" style={{ padding: '16px' }}>
        <div
          className="msqdx-mono"
          style={{ fontSize: '11px', fontWeight: '700', color: 'var(--msqdx-primary)', marginBottom: '16px' }}
        >
          {t('selectJourney', lang)}
        </div>

        {!creationReady && (
          <div
            className="msqdx-mono"
            style={{
              padding: '10px',
              marginBottom: '12px',
              backgroundColor: 'rgba(234, 179, 8, 0.08)',
              color: '#a16207',
              borderRadius: '12px',
              fontSize: '10px',
              textAlign: 'center',
            }}
          >
            {t('journeyScreenBriefNeedsCreation', lang)}
          </div>
        )}

        {isLoading && (
          <div
            className="loading-pulse"
            style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)', textAlign: 'center', padding: '20px' }}
          >
            {t('loadingJourneys', lang)}
          </div>
        )}

        {error && (
          <div
            className="msqdx-mono"
            style={{
              padding: '10px',
              backgroundColor: 'rgba(220, 38, 38, 0.05)',
              color: '#dc2626',
              borderRadius: '12px',
              fontSize: '10px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {!isLoading && (journeys?.length === 0) && !error && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--msqdx-text-secondary)', fontSize: '12px' }}>
            {t('noJourneys', lang)}
          </div>
        )}

        <div className="scroll-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px' }}>
          {(journeys || []).map((journey) => (
            <div
              key={journey.id}
              onClick={() => {
                setSelectedJourneyId(journey.id);
                setError(null);
              }}
              className="msqdx-card"
              style={{
                padding: '12px',
                cursor: 'pointer',
                border:
                  selectedJourneyId === journey.id ? '2px solid var(--msqdx-primary)' : '1px solid var(--msqdx-border-color)',
                backgroundColor: selectedJourneyId === journey.id ? 'rgba(15, 23, 42, 0.02)' : 'var(--msqdx-bg-card)',
                transition: 'all 0.2s ease',
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

      {selectedJourneyId && (
        <div className="msqdx-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '700', color: 'var(--msqdx-primary)' }}>
            {t('journeyScreenBriefSection', lang)}
          </div>
          {detailLoading && (
            <div className="loading-pulse" style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)' }}>
              {t('loadingJourneys', lang)}
            </div>
          )}
          {personasError && (
            <div className="msqdx-mono" style={{ fontSize: '10px', color: '#dc2626' }}>
              {personasError}
            </div>
          )}
          {!detailLoading && journeyDetail && (
            <>
              <label className="msqdx-mono" style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)' }}>
                {t('journeySelectPhase', lang)}
              </label>
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--msqdx-border-color)',
                  fontSize: '12px',
                }}
              >
                {sortedPhases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <label className="msqdx-mono" style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)' }}>
                {t('journeySelectPersona', lang)}
              </label>
              <select
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--msqdx-border-color)',
                  fontSize: '12px',
                }}
              >
                <option value="">{t('journeyPersonaPlaceholder', lang)}</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.segment}
                  </option>
                ))}
              </select>
              {personas.length === 0 && !personasError && (
                <div style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)' }}>{t('journeyNoPersonas', lang)}</div>
              )}

              <label className="msqdx-mono" style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)' }}>
                {t('journeyTargetGroupOptional', lang)}
              </label>
              <select
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--msqdx-border-color)',
                  fontSize: '12px',
                }}
              >
                <option value="">—</option>
                {targetGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>

              <p
                className="msqdx-mono"
                style={{ fontSize: '9px', color: 'var(--msqdx-text-secondary)', margin: '4px 0 0 0', lineHeight: 1.35 }}
              >
                {t('journeyBriefPipelineFixed', lang)}
              </p>
              <label className="msqdx-mono" style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)' }}>
                {t('journeyBriefViewportLabel', lang)}
              </label>
              <select
                value={briefViewport}
                onChange={(e) => setBriefViewport(e.target.value as ViewportChoice)}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--msqdx-border-color)', fontSize: '12px' }}
              >
                <option value="desktop">{t('journeyBriefViewportDesktop', lang)}</option>
                <option value="tablet">{t('journeyBriefViewportTablet', lang)}</option>
                <option value="mobile">{t('journeyBriefViewportMobile', lang)}</option>
              </select>

              <button
                type="button"
                disabled={!canBrief}
                className="msqdx-button secondary"
                style={{ width: '100%', marginTop: '8px', height: '36px' }}
                onClick={() => postBrief(false)}
              >
                <span className="msqdx-mono" style={{ fontSize: '10px' }}>
                  {journeyBriefLoading ? t('journeyScreenBriefLoading', lang) : t('journeyScreenBriefBuildPrompt', lang)}
                </span>
              </button>
              <button
                type="button"
                disabled={!canBrief}
                className="msqdx-button"
                style={{ width: '100%', height: '36px' }}
                onClick={() => postBrief(true)}
              >
                <span className="msqdx-mono" style={{ fontSize: '10px' }}>
                  {journeyBriefLoading ? t('journeyScreenBriefLoading', lang) : t('journeyScreenBriefBuildAndGenerate', lang)}
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
