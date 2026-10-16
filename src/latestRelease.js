import { useEffect, useState } from 'react';

// Última versión publicada en GitHub Releases. El botón de descarga apunta directamente al
// instalador .exe (sin pasar por la página de Releases, que confunde con latest.yml y .blockmap).
// Si la API de GitHub no responde, se usa la página de la última versión como respaldo.
const REPO = 'edixon-javier/local-meeting-analyzer';
export const RELEASES_PAGE_URL = `https://github.com/${REPO}/releases/latest`;

let cached = null;

function fetchLatestRelease() {
  if (!cached) {
    cached = fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((release) => {
        const asset = (release.assets || []).find((a) => /Setup-.*\.exe$/i.test(a.name));
        if (!asset) return null;
        return {
          url: asset.browser_download_url,
          fileName: asset.name,
          version: String(release.tag_name || '').replace(/^v/, ''),
          sizeMB: Math.round(asset.size / (1024 * 1024)),
        };
      })
      .catch(() => null);
  }
  return cached;
}

export function useLatestRelease() {
  const [release, setRelease] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchLatestRelease().then((r) => { if (alive) setRelease(r); });
    return () => { alive = false; };
  }, []);
  return release;
}
