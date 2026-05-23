'use client';

import { useState, useEffect } from 'react';

interface ProviderInfo {
  name: string;
  id: string;
  keyCount: number;
  availableKeys: number;
  configured: boolean;
  modelPrefixes: string[];
  models?: Array<{
    id: string;
    displayName: string;
    contextWindow: number;
    maxOutput?: number;
    supportsStream?: boolean;
    supportsVision?: boolean;
    supportsTools?: boolean;
    pricing?: {
      input: number;
      output: number;
    };
  }>;
  isCustom?: boolean;
  baseUrl?: string;
  headerFormat?: 'openai' | 'anthropic' | 'azure';
  errors?: Record<string, number>;
  keyErrors?: Array<{
    keyHash: string;
    errors: Record<string, { count: number; reason: string }>;
  }>;
}

interface AdminData {
  status: string;
  timestamp: string;
  providers: ProviderInfo[];
  usage: {
    requests: number;
    tokens: number;
    promptTokens: number;
    completionTokens: number;
    providers: Record<string, { requests: number; tokens: number; promptTokens: number; completionTokens: number }>;
  };
  quota: {
    daily: { used: number; limit: number | string };
    monthly: { used: number; limit: number | string };
    allowed: boolean;
    isOverride: boolean;
  };
  config: {
    dailyLimit: number | null;
    monthlyLimit: number | null;
    customDailyLimit?: number | null;
    customMonthlyLimit?: number | null;
  };
}

interface KeysTabProps {
  data: AdminData;
  lang: 'zh' | 'en';
  t: any;
  selectedProvider: string | null;
  setSelectedProvider: (provider: string | null) => void;
  providerKeys: Array<{ hash: string; masked: string; source: string }> | null;
  providerFallbacks: {
    current: string[];
    staticDefault: string | null;
    staticDefaults: string[];
    isOverride: boolean;
    availableModels: Record<string, { id: string; displayName: string }[]>;
  } | null;
  newKeyInput: string;
  setNewKeyInput: (val: string) => void;
  operationLoading: boolean;
  configMessage: { text: string; type: 'success' | 'error' } | null;
  setConfigMessage: (msg: { text: string; type: 'success' | 'error' } | null) => void;
  testingHash: string | null;
  testingInput: boolean;
  activeFallbacks: string[];
  setActiveFallbacks: (fallbacks: string[]) => void;
  selectedFallbackToAdd: string;
  setSelectedFallbackToAdd: (val: string) => void;
  onAddKey: () => Promise<void>;
  onDeleteKey: (providerId: string, hash: string) => Promise<void>;
  onTestKey: (providerId: string, hash: string, modelId?: string) => Promise<void>;
  onTestInputKey: () => Promise<void>;
  onSaveFallbacks: (newChain: string[]) => Promise<void>;
  onResetFallbacks: () => Promise<void>;
  customProviderModalOpen: boolean;
  setCustomProviderModalOpen: (val: boolean) => void;
  editingCustomProvider: any;
  setEditingCustomProvider: (val: any) => void;
  onSaveCustomProvider: (provider: any) => Promise<void>;
  onDeleteCustomProvider: (name: string) => Promise<void>;
}

export default function KeysTab({
  data,
  lang,
  t,
  selectedProvider,
  setSelectedProvider,
  providerKeys,
  providerFallbacks,
  newKeyInput,
  setNewKeyInput,
  operationLoading,
  configMessage,
  setConfigMessage,
  testingHash,
  testingInput,
  activeFallbacks,
  setActiveFallbacks,
  selectedFallbackToAdd,
  setSelectedFallbackToAdd,
  onAddKey,
  onDeleteKey,
  onTestKey,
  onTestInputKey,
  onSaveFallbacks,
  onResetFallbacks,
  customProviderModalOpen,
  setCustomProviderModalOpen,
  editingCustomProvider,
  setEditingCustomProvider,
  onSaveCustomProvider,
  onDeleteCustomProvider,
}: KeysTabProps) {
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});

  // Local states for custom provider form
  const [formId, setFormId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formHeaderFormat, setFormHeaderFormat] = useState<'openai' | 'anthropic' | 'azure'>('openai');
  const [formModelPrefixes, setFormModelPrefixes] = useState('');
  const [formModels, setFormModels] = useState<any[]>([]);

  // Sync edit mode fields
  useEffect(() => {
    if (editingCustomProvider) {
      setFormId(editingCustomProvider.id);
      setFormDisplayName(editingCustomProvider.name || '');
      setFormBaseUrl(editingCustomProvider.baseUrl || '');
      setFormHeaderFormat(editingCustomProvider.headerFormat || 'openai');
      setFormModelPrefixes((editingCustomProvider.modelPrefixes || []).join(', '));
      setFormModels(editingCustomProvider.models || []);
    } else {
      setFormId('');
      setFormDisplayName('');
      setFormBaseUrl('');
      setFormHeaderFormat('openai');
      setFormModelPrefixes('');
      setFormModels([]);
    }
  }, [editingCustomProvider, customProviderModalOpen]);

  // Model helper callbacks
  const handleFormAddModel = () => {
    setFormModels([
      ...formModels,
      {
        id: '',
        displayName: '',
        contextWindow: 128000,
        maxOutput: 16384,
        supportsStream: true,
        supportsVision: false,
        supportsTools: false,
        pricing: { input: 0, output: 0 }
      }
    ]);
  };

  const handleFormUpdateModel = (index: number, fields: any) => {
    const updated = [...formModels];
    updated[index] = { ...updated[index], ...fields };
    setFormModels(updated);
  };

  const handleFormRemoveModel = (index: number) => {
    setFormModels(formModels.filter((_, i) => i !== index));
  };

  // Compute all existing models across providers for cloning
  const allExistingModels = data.providers.flatMap((p) => {
    const models = p.models || [];
    return models.map((m) => {
      return {
        id: m.id,
        displayName: m.displayName,
        contextWindow: m.contextWindow,
        maxOutput: m.maxOutput,
        supportsStream: m.supportsStream,
        supportsVision: m.supportsVision,
        supportsTools: m.supportsTools,
        pricing: m.pricing,
        providerName: p.name
      };
    });
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .provider-row {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .provider-row:hover {
          background-color: rgba(255, 255, 255, 0.03) !important;
        }
        .provider-row.selected {
          background-color: rgba(59, 130, 246, 0.1) !important;
          border-left: 3px solid #3b82f6 !important;
        }
        .config-card {
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .fallback-item {
          transition: all 0.2s ease;
        }
        .fallback-item:hover {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        .styled-table th {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 500;
          color: #9ca3af;
        }
        .styled-table td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .custom-select {
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg fill='none' height='24' stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><polyline points='6 9 12 15 18 9'/></svg>");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          background-size: 1rem;
          padding-right: 2rem !important;
        }
      `}} />

      {/* Provider Key Pools Table */}
      <section className="glass-panel">
        <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '0.5rem', color: '#fff', fontWeight: 600 }}>
          {t.providerKeyPools}
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 0, marginBottom: '1.25rem' }}>
          {t.providerKeyPoolsDesc}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="styled-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>{t.tblProvider}</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>{t.tblStatus}</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>{t.tblKeys}</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>{t.tblAvailable}</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>{t.tblModelPrefixes}</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p) => {
                const isSelected = selectedProvider === p.id;
                return (
                  <tr
                    key={p.id}
                    className={`provider-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedProvider(isSelected ? null : p.id)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: isSelected ? '#60a5fa' : '#f3f4f6' }}>
                      {isSelected ? '👉 ' : ''}{p.name}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500,
                        backgroundColor: p.configured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: p.configured ? '#34d399' : '#fca5a5',
                        border: p.configured ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                      }}>
                        {p.configured ? t.statusOk : t.statusNoKeys}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#d1d5db' }}>{p.keyCount}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <span style={{
                        color: p.availableKeys > 0 ? '#34d399' : '#ef4444',
                        fontWeight: 'bold',
                      }}>
                        {p.availableKeys}
                      </span>
                    </td>
                    <td style={{
                      padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.85rem',
                      color: '#9ca3af',
                    }}>
                      {p.modelPrefixes.join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Provider Config Editor Panel */}
      {selectedProvider && (
        <section
          className="config-card glass-panel"
          style={{
            border: '1px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 15px rgba(59, 130, 246, 0.1)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
          }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontWeight: 600 }}>
                ⚙️ {t.configureTitle.replace('{name}', data.providers.find(p => p.id === selectedProvider)?.name || selectedProvider)}
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                {t.providerIdLabel} <code style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{selectedProvider}</code>
              </span>
            </div>
            <button
              onClick={() => setSelectedProvider(null)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                color: '#d1d5db',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#d1d5db'; }}
            >
              {t.btnClose}
            </button>
          </div>

          {/* Config Loading / Message */}
          {operationLoading && !providerKeys && !providerFallbacks && (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
              {t.loadingConfig}
            </div>
          )}

          {configMessage && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              border: configMessage.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
              backgroundColor: configMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: configMessage.type === 'success' ? '#34d399' : '#fca5a5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>{configMessage.text}</span>
              <button
                onClick={() => setConfigMessage(null)}
                style={{
                  background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem'
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Core Configuration Content */}
          {(providerKeys || providerFallbacks) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2rem',
            }}>

              {/* Column 1: API Key Pool */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '0.75rem', color: '#e5e7eb', fontWeight: 600 }}>
                  {t.apiKeyPoolTitle}
                </h3>

                {/* Overriding Info Warning */}
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: providerKeys && providerKeys.length > 0 && providerKeys[0].source === 'managed'
                    ? 'rgba(245, 158, 11, 0.08)'
                    : 'rgba(59, 130, 246, 0.08)',
                  border: providerKeys && providerKeys.length > 0 && providerKeys[0].source === 'managed'
                    ? '1px solid rgba(245, 158, 11, 0.15)'
                    : '1px solid rgba(59, 130, 246, 0.15)',
                  color: providerKeys && providerKeys.length > 0 && providerKeys[0].source === 'managed' ? '#fbbf24' : '#60a5fa',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  marginBottom: '1rem',
                }}>
                  {providerKeys && providerKeys.length > 0 && providerKeys[0].source === 'managed' ? (
                    <span>{t.kvWarningManaged}</span>
                  ) : (
                    <span>{t.kvWarningEnv}</span>
                  )}
                </div>

                {/* Add Key Form */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <input
                    type="password"
                    placeholder={t.addKeyPlaceholder}
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    disabled={operationLoading}
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.8rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                  />
                  <button
                    onClick={onTestInputKey}
                    disabled={operationLoading || testingInput || !newKeyInput.trim()}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#60a5fa',
                      fontWeight: '500',
                      fontSize: '0.9rem',
                      cursor: operationLoading || testingInput || !newKeyInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: operationLoading || testingInput || !newKeyInput.trim() ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'; }}
                    onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'; }}
                  >
                    {testingInput ? t.btnTestingKey : t.btnTestKey}
                  </button>
                  <button
                    onClick={onAddKey}
                    disabled={operationLoading || !newKeyInput.trim()}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      cursor: operationLoading || !newKeyInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: operationLoading || !newKeyInput.trim() ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                    onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                  >
                    {t.btnAddKey}
                  </button>
                </div>

                {/* Keys list */}
                <div style={{
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.15)',
                  maxHeight: '280px',
                  overflowY: 'auto',
                }}>
                  {(() => {
                    const providerObj = data.providers.find(p => p.id === selectedProvider);
                    const models = providerObj?.models || [];
                    return providerKeys && providerKeys.length > 0 ? (
                      providerKeys.map((key) => {
                        const isEnv = key.source === 'env';
                        return (
                          <div
                            key={key.hash}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.75rem 0.8rem',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <code style={{ fontSize: '0.85rem', color: '#e5e7eb', fontFamily: 'monospace' }}>
                                {key.masked}
                              </code>
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                {t.keyHashLabel} <code style={{ fontFamily: 'monospace', color: '#d1d5db' }}>{key.hash.slice(0, 8)}</code>
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: isEnv ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: isEnv ? '#60a5fa' : '#34d399',
                                border: isEnv ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                              }}>
                                {isEnv ? t.keySourceEnv : t.keySourceKv}
                              </span>

                              <select
                                value={selectedModels[key.hash] || ''}
                                onChange={(e) => setSelectedModels(prev => ({ ...prev, [key.hash]: e.target.value }))}
                                disabled={operationLoading || testingHash !== null}
                                style={{
                                  padding: '0.15rem 1.8rem 0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                                  color: '#d1d5db',
                                  fontSize: '0.75rem',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  appearance: 'none',
                                  backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' height='12' stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='12' xmlns='http://www.w3.org/2000/svg'><polyline points='6 9 12 15 18 9'/></svg>")`,
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 0.4rem center',
                                  backgroundSize: '0.6rem',
                                }}
                              >
                                <option value="">{lang === 'zh' ? '自动 (默认)' : 'Auto (Default)'}</option>
                                {models.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.displayName || m.id}
                                  </option>
                                ))}
                              </select>

                              <button
                                onClick={() => onTestKey(selectedProvider, key.hash, selectedModels[key.hash])}
                                disabled={operationLoading || testingHash !== null}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  color: '#60a5fa',
                                  fontSize: '0.75rem',
                                  cursor: operationLoading || testingHash !== null ? 'not-allowed' : 'pointer',
                                  opacity: operationLoading || testingHash !== null ? 0.5 : 1,
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'; }}
                                onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'; }}
                              >
                                {testingHash === key.hash ? t.btnTestingKey : t.btnTestKey}
                              </button>

                            <button
                              onClick={() => onDeleteKey(selectedProvider, key.hash)}
                              disabled={operationLoading}
                              style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                fontSize: '0.75rem',
                                cursor: operationLoading ? 'not-allowed' : 'pointer',
                                opacity: operationLoading ? 0.5 : 1,
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; }}
                              onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                              title={isEnv ? t.deleteEnvKeyTitle : t.deleteKvKeyTitle}
                            >
                              {t.btnDeleteKey}
                            </button>
                          </div>
                        </div>
                      );
                    })
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '0.9rem', padding: '1.5rem', textAlign: 'center' }}>
                        {t.noKeysConfigured}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Column 2: Fallback Chain */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '0.75rem', color: '#e5e7eb', fontWeight: 600 }}>
                  {t.fallbackChainTitle}
                </h3>

                {/* Static / Managed indicator */}
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: providerFallbacks?.isOverride ? 'rgba(16, 185, 129, 0.08)' : 'rgba(156, 163, 175, 0.08)',
                  border: providerFallbacks?.isOverride ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(156, 163, 175, 0.15)',
                  color: providerFallbacks?.isOverride ? '#34d399' : '#9ca3af',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  marginBottom: '1rem',
                }}>
                  {providerFallbacks?.isOverride ? (
                    <span>{t.kvFallbackActive}</span>
                  ) : (
                    <span>{t.kvFallbackStatic}</span>
                  )}
                </div>

                {/* Reorderable Chain List */}
                <div style={{
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.15)',
                  marginBottom: '1rem',
                  padding: '0.25rem 0',
                }}>
                  {activeFallbacks.length > 0 ? (
                    activeFallbacks.map((fbEntry, idx) => {
                      const colonIdx = fbEntry.indexOf(':');
                      const fbId = colonIdx >= 0 ? fbEntry.slice(0, colonIdx) : fbEntry;
                      const fbModel = colonIdx >= 0 ? fbEntry.slice(colonIdx + 1) : '';
                      const fbName = data.providers.find(p => p.id === fbId)?.name || fbId;
                      const models = providerFallbacks?.availableModels?.[fbId] || [];
                      return (
                        <div
                          key={`${fbEntry}-${idx}`}
                          className="fallback-item"
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.6rem 0.8rem',
                            borderBottom: idx < activeFallbacks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                            <span style={{
                              color: '#9ca3af',
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>{idx + 1}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#f3f4f6', flexShrink: 0 }}>{fbName}</span>
                            
                            {/* Model selector */}
                            <select
                              value={fbModel}
                              onChange={(e) => {
                                const newList = [...activeFallbacks];
                                newList[idx] = e.target.value ? `${fbId}:${e.target.value}` : fbId;
                                setActiveFallbacks(newList);
                              }}
                              disabled={operationLoading}
                              className="custom-select"
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                                color: fbModel ? '#60a5fa' : '#9ca3af',
                                fontSize: '0.75rem',
                                outline: 'none',
                                maxWidth: '180px',
                                flexShrink: 1,
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">{t.modelSelectorAuto}</option>
                              {models.map(m => (
                                <option key={m.id} value={m.id}>{m.displayName}</option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                            {/* Up button */}
                            <button
                              onClick={() => {
                                if (idx === 0) return;
                                const nextList = [...activeFallbacks];
                                const tmp = nextList[idx];
                                nextList[idx] = nextList[idx - 1];
                                nextList[idx - 1] = tmp;
                                setActiveFallbacks(nextList);
                              }}
                              disabled={idx === 0 || operationLoading}
                              style={{
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                color: '#d1d5db',
                                fontSize: '0.75rem',
                                cursor: idx === 0 || operationLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              ▲
                            </button>
                            {/* Down button */}
                            <button
                              onClick={() => {
                                if (idx === activeFallbacks.length - 1) return;
                                const nextList = [...activeFallbacks];
                                const tmp = nextList[idx];
                                nextList[idx] = nextList[idx + 1];
                                nextList[idx + 1] = tmp;
                                setActiveFallbacks(nextList);
                              }}
                              disabled={idx === activeFallbacks.length - 1 || operationLoading}
                              style={{
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                color: '#d1d5db',
                                fontSize: '0.75rem',
                                cursor: idx === activeFallbacks.length - 1 || operationLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              ▼
                            </button>
                            {/* Remove button */}
                            <button
                              onClick={() => {
                                const nextList = activeFallbacks.filter((_, i) => i !== idx);
                                setActiveFallbacks(nextList);
                              }}
                              disabled={operationLoading}
                              style={{
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                fontSize: '0.75rem',
                                cursor: operationLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: '#9ca3af', fontSize: '0.9rem', padding: '1.5rem', textAlign: 'center' }}>
                      {t.noFallbacksConfigured}
                    </div>
                  )}
                </div>

                {/* Add Fallback Form */}
                {(() => {
                  const usedProviders = activeFallbacks.map(fb => {
                    const ci = fb.indexOf(':');
                    return ci >= 0 ? fb.slice(0, ci) : fb;
                  });
                  const availableToAdd = data.providers.filter(p => p.id !== selectedProvider && !usedProviders.includes(p.id)) || [];
                  return availableToAdd.length > 0 ? (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <select
                        value={selectedFallbackToAdd}
                        onChange={(e) => setSelectedFallbackToAdd(e.target.value)}
                        disabled={operationLoading}
                        className="custom-select"
                        style={{
                          flex: 1,
                          padding: '0.5rem 0.8rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
                          color: '#fff',
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {availableToAdd.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.id})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (!selectedFallbackToAdd) return;
                          setActiveFallbacks([...activeFallbacks, selectedFallbackToAdd]);
                        }}
                        disabled={operationLoading || !selectedFallbackToAdd}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          color: '#eee',
                          fontSize: '0.85rem',
                          cursor: operationLoading || !selectedFallbackToAdd ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
                        onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                      >
                        {t.btnAddFallback}
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                      {t.noOtherProviders}
                    </div>
                  );
                })()}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  {providerFallbacks?.isOverride && (
                    <button
                      onClick={onResetFallbacks}
                      disabled={operationLoading}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#f87171',
                        fontSize: '0.9rem',
                        cursor: operationLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; }}
                      onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                    >
                      {t.btnResetFallbacks}
                    </button>
                  )}
                  <button
                    onClick={() => onSaveFallbacks(activeFallbacks)}
                    disabled={operationLoading || JSON.stringify(activeFallbacks) === JSON.stringify(providerFallbacks?.current)}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      cursor: operationLoading || JSON.stringify(activeFallbacks) === JSON.stringify(providerFallbacks?.current) ? 'not-allowed' : 'pointer',
                      opacity: operationLoading || JSON.stringify(activeFallbacks) === JSON.stringify(providerFallbacks?.current) ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                    onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                  >
                    {t.btnSaveFallbacks}
                  </button>
                </div>
              </div>

            </div>
          )}
        </section>
      )}
    </div>
  );
}
