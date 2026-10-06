# Seguridad: claves expuestas y limpieza del historial

> Documento de mantenimiento. No contiene valores de claves, así que puede quedarse en el repositorio público.

## Estado: resuelto (2026-10-06)

| Paso | Estado |
|---|---|
| Revocar las dos claves de OpenAI (la del historial y la de `backend/config.json`) | ✅ Hecho por el propietario |
| Purgar `backend/config.json` de todo el historial | ✅ Hecho y verificado |
| Purgar el icono antiguo de 1,6 MB del historial | ⏸️ Opcional, pendiente (sección 3) |
| Escáner de secretos (gitleaks) en pre-commit o CI | ⏳ Pendiente (sección 4) |
| Cifrar la clave de OpenAI en disco | ⏳ Mejora futura (sección 5) |

### Qué pasó

Una clave de API de OpenAI (formato `sk-proj-...`) quedó dentro del historial de git. El archivo `backend/config.json` se confirmó en el commit inicial y en un commit posterior, y después se quitó del árbol de trabajo. El archivo seguía en el historial y en la punta de tres ramas `feature/*`. La clave que había en el `backend/config.json` local también se consideró comprometida, porque vivía en un archivo que los tests reescribían; los tests ya están aislados en un directorio temporal. El repositorio nunca tuvo remoto, así que la clave no llegó a ningún servidor.

## 1. Revocar las claves ✅

Hecho en https://platform.openai.com/api-keys. Recomendaciones que siguen vigentes:

- Si necesitas OpenAI, crea una clave nueva y guárdala solo desde **Ajustes** de la aplicación, nunca en un archivo versionado.
- El `backend/config.json` local (ignorado por git) todavía contiene la clave **revocada**. Sustitúyela desde Ajustes o bórrala.
- Revisa https://platform.openai.com/usage y fija un límite de gasto mensual.

## 2. Purga del historial ✅

**Método usado.** Como no había remoto y el árbol de trabajo estaba limpio, se hizo en la propia carpeta y no en un clon:

1. Copia de seguridad completa de `.git` antes de empezar.
2. `git filter-branch --index-filter 'git rm --cached --ignore-unmatch backend/config.json' --tag-name-filter cat -- --branches --tags`. Reescribió las 6 ramas y la etiqueta `v1.5.0`.
3. Borrado de `refs/original/*`, del stash, que apuntaba al historial antiguo, y de los reflogs (`git reflog expire --expire=now --all`).
4. `git gc --prune=now --aggressive`.

**Verificación:**

- 0 apariciones de claves en todo el historial: `git log --all -p | grep -E "sk-proj-[A-Za-z0-9_-]{20,}"`.
- Ningún commit contiene `backend/config.json`, y los objetos de git que lo guardaban ya no existen.
- El contenido de cada rama es idéntico al anterior salvo ese archivo, y el número de commits no cambió.
- `git fsck --full` no da errores.

**Consecuencias:**

- Cambiaron **todos los hashes de commit**. Los hashes que aparezcan en documentos antiguos ya no son válidos.
- La copia de seguridad previa a la purga quedó en la carpeta temporal de la sesión de Claude Code (`scratchpad/git-backup-pre-purge`). Contiene la clave revocada; bórrala cuando ya no la necesites.

**Si vuelve a ocurrir.** Revoca la clave primero, porque borrar el historial no sirve si la clave sigue activa. Si ya se subió a un remoto, el servidor conserva una copia: la única defensa es la revocación. Para repositorios grandes es preferible [`git filter-repo`](https://github.com/newren/git-filter-repo) en un clon limpio:

```powershell
pip install git-filter-repo
git clone --no-local F:\Proyectos\Extension-reuniones F:\Proyectos\Extension-reuniones-limpio
cd F:\Proyectos\Extension-reuniones-limpio
git filter-repo --invert-paths --path RUTA/DEL/ARCHIVO
git log --all -p | Select-String -Pattern "sk-proj-[A-Za-z0-9_-]{20,}"   # no debe devolver nada
```

## 3. Purgar el icono antiguo de 1,6 MB (opcional)

El blob `49ba7f982f5e4f5e967a42b2705bb30e8a27bcef` (1,6 MB) es la imagen antigua usada como `frontend/public/icon.png` y `frontend/src/assets/icon.jpg`. Hoy el repositorio comprimido pesa unos 2,1 MB, y la mayor parte es ese blob. No es un problema de seguridad; quitarlo solo reduce el tamaño de los clones. Si quieres hacerlo, hazlo **antes del primer `git push`**, porque vuelve a cambiar los hashes:

```powershell
pip install git-filter-repo
"49ba7f982f5e4f5e967a42b2705bb30e8a27bcef" | Out-File -Encoding ascii blobs-a-quitar.txt
git filter-repo --strip-blobs-with-ids blobs-a-quitar.txt --force
git gc --prune=now --aggressive
```

Usa `--force` solo con el árbol de trabajo limpio (todo confirmado), porque `filter-repo` termina con un `git reset --hard`.

## 4. Escáner de secretos (gitleaks)

Para evitar que vuelva a ocurrir, añade [gitleaks](https://github.com/gitleaks/gitleaks).

**Antes de cada commit.** Instala [pre-commit](https://pre-commit.com) (`pip install pre-commit`, luego `pre-commit install`) y crea `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: vX.Y.Z   # sustituye por la última versión: https://github.com/gitleaks/gitleaks/releases
    hooks:
      - id: gitleaks
```

**En CI (GitHub Actions)**, como paso adicional del flujo:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Para repositorios de una cuenta personal es gratis. Si el repositorio pertenece a una organización, la acción puede requerir licencia; la alternativa gratuita es descargar el binario y ejecutar `gitleaks detect --source . --redact`.

`backend/config.json` y `.env` ya están en `.gitignore`. Mantén ahí cualquier archivo de claves (`*.pem`, etc.) y usa `backend/config.example.json`, sin valores reales, como plantilla.

## 5. La clave de OpenAI se guarda sin cifrar en disco

Desde la versión 1.6.0, `GET /config` devuelve la clave **enmascarada** y los registros enmascaran cualquier `sk-...`. Aun así, la aplicación la guarda **sin cifrar** en `config.json` (en `%APPDATA%\Local Meeting Analyzer` cuando está instalada), y cualquier proceso que se ejecute con el mismo usuario de Windows puede leerla. Mejora futura recomendada:

- Cifrarla con **Electron `safeStorage`** (usa DPAPI en Windows) en el proceso principal y guardar solo el valor cifrado, o
- usar **DPAPI** directamente desde el backend (con `ctypes`, sin dependencias nuevas).

La política de privacidad (`legal/PRIVACY.md`) ya informa de que la clave se guarda localmente y sin cifrar.
