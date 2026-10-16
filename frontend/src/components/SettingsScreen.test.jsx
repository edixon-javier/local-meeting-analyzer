import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  systemStatus: undefined,
}));

vi.mock('../api', () => ({
  getConfig: mocks.getConfig,
  updateConfig: mocks.updateConfig,
  getAudioDevices: vi.fn().mockResolvedValue({ data: { devices: [] } }),
  getOllamaModels: vi.fn().mockResolvedValue({ data: { models: [] } }),
  testAiProvider: vi.fn(),
  startAudioTest: vi.fn(),
  stopAudioTest: vi.fn(),
  getAudioTestLevels: vi.fn(),
  getAudioUrl: vi.fn(),
}));

// Canales públicos sin configurar (marcadores) para probar los estados deshabilitados
vi.mock('../appInfo', async () => ({
  ...(await vi.importActual('../appInfo')),
  REPO_URL: '[URL DEL REPOSITORIO]',
  ISSUES_URL: '[URL DEL REPOSITORIO]/issues',
  PRIVACY_URL: '[URL PÚBLICA DE docs/privacy.html]',
  SUPPORT_EMAIL: '[CORREO DE SOPORTE]',
}));

vi.mock('../hooks/useSystem', () => ({
  useSystem: () => ({ showToast: mocks.showToast, isBackendOffline: false, systemStatus: mocks.systemStatus }),
}));

import SettingsScreen from './SettingsScreen';

const BASE_CONFIG = {
  whisper_model: 'small',
  ai_provider: 'local',
  openai_api_key: '••••••••1234',
  has_api_key: true,
  openai_model: 'gpt-4o-mini',
  ollama_model: 'qwen3:4b',
  allow_cloud_fallback: false,
  analysis_focus: '',
  record_mode: 'both',
  mic_device_id: 'default',
  diarize: false,
};

async function renderSettings(configOverrides = {}) {
  mocks.getConfig.mockResolvedValue({ data: { ...BASE_CONFIG, ...configOverrides } });
  render(<SettingsScreen />);
  await screen.findByRole('heading', { name: 'Privacidad' });
}

describe('SettingsScreen: privacidad, soporte y legal', () => {
  beforeEach(() => {
    mocks.showToast.mockClear();
    mocks.updateConfig.mockReset();
    mocks.updateConfig.mockResolvedValue({ data: { status: 'success', config: BASE_CONFIG } });
    window.electronAPI = {
      getAppInfo: vi.fn().mockResolvedValue({ version: '1.6.0', electron: '42.0.0', chrome: '140', os: '10.0.26100', arch: 'x64' }),
      copyDiagnostics: vi.fn().mockResolvedValue('diagnóstico'),
      openLogsFolder: vi.fn().mockResolvedValue(true),
      openLegalDoc: vi.fn().mockResolvedValue(true),
      openExternal: vi.fn(),
    };
  });

  afterEach(() => {
    delete window.electronAPI;
    mocks.systemStatus = undefined;
    localStorage.clear();
  });

  it('fuera de Electron muestra la versión del backend', async () => {
    delete window.electronAPI;
    mocks.systemStatus = { version: '1.6.0' };
    await renderSettings();
    expect(await screen.findByText(/Versión 1\.6\.0/)).toBeInTheDocument();
    expect(screen.queryByText(/desconocida/)).not.toBeInTheDocument();
  });

  it('sin Electron ni backend indica versión desconocida', async () => {
    delete window.electronAPI;
    await renderSettings();
    expect(await screen.findByText(/Versión desconocida/)).toBeInTheDocument();
  });

  it('el índice marca la sección elegida con aria-current', async () => {
    await renderSettings();
    const toc = screen.getByRole('navigation', { name: 'Secciones de configuración' });
    const audio = within(toc).getByRole('button', { name: /Audio/ });
    const privacy = within(toc).getByRole('button', { name: /Privacidad/ });
    expect(audio).toHaveAttribute('aria-current', 'true');
    fireEvent.click(privacy);
    expect(privacy).toHaveAttribute('aria-current', 'true');
    expect(privacy).toHaveClass('is-active');
    expect(audio).not.toHaveAttribute('aria-current');
  });

  it('muestra las secciones nuevas y la clave guardada enmascarada', async () => {
    await renderSettings();
    expect(screen.getByRole('heading', { name: 'Ayuda y soporte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acerca de / Legal' })).toBeInTheDocument();
    expect(screen.getByText('Clave guardada (••••••••1234)')).toBeInTheDocument();
    expect(await screen.findByText(/Versión 1\.6\.0/)).toBeInTheDocument();
    const toggle = screen.getByLabelText(/Usar la nube \(OpenAI\) si el modelo local no está disponible/);
    expect(toggle).not.toBeChecked();
  });

  it('el campo de clave vacío conserva la clave guardada (no se envía openai_api_key)', async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /Guardar Ajustes/i }));
    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledTimes(1));
    const payload = mocks.updateConfig.mock.calls[0][0];
    expect(payload).not.toHaveProperty('openai_api_key');
    expect(payload.allow_cloud_fallback).toBe(false);
    expect(payload.ollama_model).toBe('qwen3:4b');
  });

  it('una clave nueva y el respaldo en la nube se envían solo cuando el usuario los cambia', async () => {
    await renderSettings();
    fireEvent.click(screen.getByLabelText(/Usar la nube \(OpenAI\)/));
    fireEvent.change(screen.getByLabelText(/OpenAI API Key/), { target: { value: '  sk-nueva-clave-1234567890  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Ajustes/i }));
    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledTimes(1));
    const payload = mocks.updateConfig.mock.calls[0][0];
    expect(payload.openai_api_key).toBe('sk-nueva-clave-1234567890');
    expect(payload.allow_cloud_fallback).toBe(true);
  });

  it('"Borrar clave" elimina la clave guardada', async () => {
    mocks.updateConfig.mockResolvedValue({
      data: { status: 'success', config: { ...BASE_CONFIG, openai_api_key: '', has_api_key: false } },
    });
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /Borrar clave/i }));
    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledWith({ openai_api_key: '' }));
    await waitFor(() => expect(screen.queryByText(/Clave guardada/)).not.toBeInTheDocument());
  });

  it('"Ver bienvenida de nuevo" reinicia el onboarding y avisa con un evento', async () => {
    localStorage.setItem('onboarding_completed_v1', '2026-01-01');
    const onOpen = vi.fn();
    window.addEventListener('onboarding:open', onOpen);
    try {
      await renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /Ver bienvenida de nuevo/i }));
      expect(localStorage.getItem('onboarding_completed_v1')).toBeNull();
      expect(onOpen).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('onboarding:open', onOpen);
    }
  });

  it('copia el diagnóstico y abre la carpeta de registros mediante Electron', async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /Copiar diagnóstico/i }));
    await waitFor(() => expect(window.electronAPI.copyDiagnostics).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' })));

    fireEvent.click(screen.getByRole('button', { name: /Abrir carpeta de registros/i }));
    await waitFor(() => expect(window.electronAPI.openLogsFolder).toHaveBeenCalledTimes(1));
  });

  it('los cinco documentos legales se abren por su identificador', async () => {
    await renderSettings();
    const expected = {
      'Política de privacidad': 'privacy',
      'Licencia y términos de uso': 'eula',
      'Aviso de consentimiento de grabación': 'consent',
      'Avisos de software de terceros': 'third_party',
      'Registro de cambios': 'changelog',
    };
    for (const [label, id] of Object.entries(expected)) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(window.electronAPI.openLegalDoc).toHaveBeenCalledWith(id));
    }
    // El enlace a la política pública no aparece mientras su URL sea un marcador
    expect(screen.queryByRole('button', { name: /Política de privacidad en línea/i })).not.toBeInTheDocument();
  });

  it('"Reportar problema" está deshabilitado mientras el canal de soporte sea un marcador', async () => {
    await renderSettings();
    expect(screen.getByRole('button', { name: /Reportar problema/i })).toBeDisabled();
  });

  it('con proveedor OpenAI el respaldo en la nube no aplica y la clave se gestiona en su bloque', async () => {
    await renderSettings({ ai_provider: 'openai' });
    expect(screen.getByLabelText(/Usar la nube \(OpenAI\)/)).toBeDisabled();
    // Un único campo de clave visible (no se duplica en Privacidad)
    expect(screen.getAllByLabelText(/OpenAI API Key/)).toHaveLength(1);
  });

  it('con proveedor Claude muestra el campo de clave de Anthropic y selector de modelo de Claude', async () => {
    await renderSettings({
      ai_provider: 'claude',
      anthropic_api_key: '••••••••5678',
      has_claude_key: true,
      claude_model: 'claude-3-5-haiku-20241022'
    });
    expect(screen.getByLabelText(/Anthropic \(Claude\) API Key/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Modelo de análisis \(Anthropic Claude\)/)).toBeInTheDocument();
    expect(screen.getByText('Clave guardada (••••••••5678)')).toBeInTheDocument();
    expect(screen.getByLabelText(/Usar la nube \(OpenAI\)/)).toBeDisabled();
  });

  it('con proveedor Gemini muestra el campo de clave de Google Gemini y selector de modelo', async () => {
    await renderSettings({
      ai_provider: 'gemini',
      gemini_api_key: '••••••••9012',
      has_gemini_key: true,
      gemini_model: 'gemini-2.0-flash'
    });
    expect(screen.getByLabelText(/Google Gemini API Key/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Modelo de transcripción y análisis \(Google Gemini\)/)).toBeInTheDocument();
    expect(screen.getByText('Clave guardada (••••••••9012)')).toBeInTheDocument();
    expect(screen.getByLabelText(/Usar la nube \(OpenAI\)/)).toBeDisabled();
  });
});
