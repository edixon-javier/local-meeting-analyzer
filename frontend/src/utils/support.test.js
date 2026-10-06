import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPlaceholder } from '../appInfo';

const INFO = { version: '1.6.0', os: '10.0.26100', arch: 'x64', isStore: false };

// Carga support.js con valores de appInfo simulados (el módulo lee las constantes al importarse)
async function loadSupport(overrides = {}) {
  vi.resetModules();
  vi.doMock('../appInfo', async () => {
    const actual = await vi.importActual('../appInfo');
    return { ...actual, ...overrides };
  });
  return import('./support');
}

describe('isPlaceholder', () => {
  it('detecta marcadores entre corchetes y valores vacíos', () => {
    expect(isPlaceholder('[CORREO DE SOPORTE]')).toBe(true);
    expect(isPlaceholder('[URL DEL REPOSITORIO]/issues')).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder(undefined)).toBe(true);
  });

  it('acepta valores reales', () => {
    expect(isPlaceholder('https://github.com/acme/app/issues')).toBe(false);
    expect(isPlaceholder('soporte@example.com')).toBe(false);
  });
});

describe('support', () => {
  afterEach(() => {
    vi.doUnmock('../appInfo');
    vi.resetModules();
  });

  it('sin canales configurados no hay destino para reportar', async () => {
    const support = await loadSupport();
    expect(support.canReportProblem()).toBe(false);
    expect(support.buildReportTarget(INFO)).toBeNull();
  });

  it('con repositorio real abre un nuevo issue con versión, sistema y pasos prellenados', async () => {
    const support = await loadSupport({ ISSUES_URL: 'https://github.com/acme/app/issues' });
    const target = support.buildReportTarget(INFO, { title: 'Falla al grabar' });
    expect(target.channel).toBe('github');
    const url = new URL(target.url);
    expect(url.origin + url.pathname).toBe('https://github.com/acme/app/issues/new');
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('title')).toBe('Falla al grabar');
    expect(url.searchParams.get('version')).toBe('1.6.0');
    expect(url.searchParams.get('os')).toContain('Windows 11');
    expect(url.searchParams.get('steps')).toContain('1.');
    // No se adjunta ningún registro automáticamente
    expect(url.searchParams.get('body')).toContain('Copiar diagnóstico');
  });

  it('sin repositorio pero con correo usa mailto:', async () => {
    const support = await loadSupport({ SUPPORT_EMAIL: 'soporte@example.com' });
    const target = support.buildReportTarget(INFO);
    expect(target.channel).toBe('email');
    expect(target.url.startsWith('mailto:soporte@example.com?subject=')).toBe(true);
    expect(decodeURIComponent(target.url)).toContain('Versión: 1.6.0');
  });

  it('enmascara claves de API en los detalles y limita su tamaño', async () => {
    const support = await loadSupport({ SUPPORT_EMAIL: 'soporte@example.com' });
    const target = support.buildReportTarget(INFO, { details: `fallo con sk-abcdefghijklmnop ${'x'.repeat(5000)}` });
    const decoded = decodeURIComponent(target.url);
    expect(decoded).not.toContain('abcdefghijklmnop');
    expect(decoded).toContain('sk-***');
    expect(target.url.length).toBeLessThan(4000);
  });

  it('reportProblem abre la URL con electronAPI.openExternal', async () => {
    const support = await loadSupport({ ISSUES_URL: 'https://github.com/acme/app/issues' });
    const openExternal = vi.fn();
    window.electronAPI = { openExternal };
    try {
      expect(await support.reportProblem({ info: INFO })).toBe('github');
      expect(openExternal).toHaveBeenCalledTimes(1);
      expect(openExternal.mock.calls[0][0]).toMatch(/^https:\/\/github\.com\/acme\/app\/issues\/new\?/);
    } finally {
      delete window.electronAPI;
    }
  });

  it('reportProblem devuelve null y no abre nada si no hay canal', async () => {
    const support = await loadSupport();
    const openExternal = vi.fn();
    window.electronAPI = { openExternal };
    try {
      expect(await support.reportProblem({ info: INFO })).toBeNull();
      expect(openExternal).not.toHaveBeenCalled();
    } finally {
      delete window.electronAPI;
    }
  });

  it('loadAppInfo usa los valores por defecto fuera de Electron', async () => {
    const support = await loadSupport();
    const info = await support.loadAppInfo();
    expect(info.version).toBe('desconocida');
  });

  it('describeOs distingue Windows 10 y 11', async () => {
    const support = await loadSupport();
    expect(support.describeOs({ os: '10.0.19045', arch: 'x64' })).toBe('Windows 10 (10.0.19045), x64');
    expect(support.describeOs({ os: '10.0.26100', arch: 'x64', isStore: true })).toBe(
      'Windows 11 (10.0.26100), x64, Microsoft Store'
    );
  });
});
