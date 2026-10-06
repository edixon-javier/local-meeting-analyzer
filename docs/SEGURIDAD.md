# Seguridad: claves expuestas y limpieza del historial

> Documento **interno de mantenimiento**. Cuando hayas completado los pasos 1 y 2, puedes borrarlo antes de hacer público el repositorio. No contiene valores de claves.

## Situación

- Una clave de API de OpenAI (formato `sk-proj-...`) quedó **dentro del historial de git**: el archivo `backend/config.json` se confirmó en los commits `4688ae7` (commit inicial) y `847246c`, y se quitó del árbol de trabajo en `daade9e`. El archivo sigue existiendo en el historial y, además, **en la punta de tres ramas locales**: `feature/audio-upload`, `feature/live-transcription` y `feature/mic-tester`.
- El `backend/config.json` actual (ignorado por git) contiene **otra clave real**. Esa clave vivía en un archivo que los tests reescribían, por lo que también debe considerarse comprometida.
- Hoy el repositorio **no tiene remoto**, así que la clave no se ha subido a ningún servidor. Es el momento ideal para limpiar el historial: después sería mucho más costoso.

## 1. Revocar ambas claves de OpenAI ahora

1. Entra en https://platform.openai.com/api-keys.
2. Elimina (Revoke) **las dos claves**: la del historial y la que está hoy en `backend/config.json`. Si no sabes cuál es cuál, revoca todas las que pertenezcan a este proyecto.
3. Crea una clave nueva solo si la necesitas, y guárdala únicamente en la configuración de la aplicación (Ajustes), nunca en un archivo versionado.
4. Revisa en https://platform.openai.com/usage si hay consumo que no reconozcas y considera fijar un límite de gasto mensual.

Revocar es lo único que protege de verdad: borrar el historial no sirve si la clave sigue activa.

## 2. Purgar `backend/config.json` del historial (antes de añadir cualquier remoto)

Hazlo **antes** de ejecutar `git remote add` o de publicar el repositorio. Usa [`git filter-repo`](https://github.com/newren/git-filter-repo).

Qué hace: reescribe **todo el historial** (las 5 ramas locales `main`, `feature/audio-upload`, `feature/export-and-speaker-rename`, `feature/live-transcription`, `feature/mic-tester`, y la etiqueta `v1.5.0`). Todos los hashes de commit cambian. Por eso conviene hacerlo en un clon limpio, sin tocar tu carpeta de trabajo.

```powershell
# 0) Guarda TODO el trabajo pendiente en un commit (el clon solo contiene lo confirmado).
#    Haz una copia de seguridad completa, fuera del repositorio. El stash y los archivos
#    ignorados (venv, recordings, bin, config.json) NO viajan en un clon.
cd F:\Proyectos
robocopy Extension-reuniones F:\Backups\Extension-reuniones-pre-purga /E /XD venv node_modules recordings

# 1) Instalar git-filter-repo (requiere Python)
pip install git-filter-repo

# 2) Clon limpio (filter-repo exige un clon "fresco")
git clone --no-local F:\Proyectos\Extension-reuniones F:\Proyectos\Extension-reuniones-limpio
cd F:\Proyectos\Extension-reuniones-limpio

# 3) Crear ramas locales para las 4 ramas feature (un clon solo crea la rama activa)
git branch --track feature/audio-upload origin/feature/audio-upload
git branch --track feature/export-and-speaker-rename origin/feature/export-and-speaker-rename
git branch --track feature/live-transcription origin/feature/live-transcription
git branch --track feature/mic-tester origin/feature/mic-tester

# 4) Eliminar el archivo de TODO el historial
git filter-repo --invert-paths --path backend/config.json

# 5) Verificar: no debe devolver ningún resultado
git log --all -p -S "sk-proj"
git log --all --format=%h -- backend/config.json
```

Verificación adicional: `git grep -I "sk-proj" $(git rev-list --all)` tampoco debe encontrar nada. Si `git filter-repo` protesta de que el clon no es "fresco", vuelve a clonar; solo en este clon desechable podrías añadir `--force`. No ejecutes `filter-repo --force` en tu carpeta de trabajo: terminaría con un `git reset --hard` que borraría cambios sin confirmar.

Después de verificar:

1. Renombra la carpeta antigua (`Extension-reuniones` a `Extension-reuniones-ANTIGUA`) y la limpia a `Extension-reuniones`, o trabaja directamente en la limpia.
2. Copia a la carpeta nueva los archivos que git ignora y que necesitas: `backend/config.json` (con la clave **nueva**, nunca la antigua), `bin/ffmpeg.exe` (compilación LGPL), `backend/recordings/` si quieres conservar tus grabaciones y recrea el entorno virtual.
3. `git filter-repo` elimina el remoto `origin` por seguridad; es lo esperado, porque aún no hay remoto real.
4. Conserva la copia de seguridad hasta estar seguro, y bórrala después: **contiene la clave**.
5. Cuando añadas el remoto por primera vez, sube solo el historial limpio.

Notas:

- Si ya hubieras subido el repositorio a algún servidor antes de limpiar, ese servidor conserva la clave: la única defensa es haberla revocado (paso 1).
- No uses `git filter-branch`: es lento y propenso a errores.

## 3. Purgar los blobs de iconos antiguos de 1,6 MB (opcional)

El blob `49ba7f982f5e4f5e967a42b2705bb30e8a27bcef` (1,6 MB) es la imagen antigua usada como `frontend/public/icon.png` y `frontend/src/assets/icon.jpg`. Ahorra poco (el repositorio pesa unos 90 MB casi todo en objetos sueltos que git compactará solo), pero si quieres quitarlo:

1. Confirma primero los iconos nuevos y más ligeros.
2. En el clon limpio, antes o después del paso 4:

```powershell
"49ba7f982f5e4f5e967a42b2705bb30e8a27bcef" | Out-File -Encoding ascii blobs-a-quitar.txt
git filter-repo --strip-blobs-with-ids blobs-a-quitar.txt
git gc --prune=now --aggressive
```

Esto elimina esos dos archivos en los commits antiguos que usaban ese blob. No uses `--strip-blobs-bigger-than`: borraría cualquier imagen grande, incluida una que quieras conservar.

## 4. Escáner de secretos (gitleaks)

Evita que vuelva a ocurrir añadiendo [gitleaks](https://github.com/gitleaks/gitleaks).

**Antes de cada commit** (con [pre-commit](https://pre-commit.com), `pip install pre-commit` y `pre-commit install`), en `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: vX.Y.Z   # sustituye por la última versión: https://github.com/gitleaks/gitleaks/releases
    hooks:
      - id: gitleaks
```

**En CI** (GitHub Actions), como paso adicional del flujo:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Si el repositorio pertenece a una organización, esta acción puede requerir una licencia; alternativa gratuita: descargar el binario y ejecutar `gitleaks detect --source . --redact`.

Consejo adicional: `backend/config.json` ya está en `.gitignore`; mantén ahí cualquier archivo de claves (`.env`, `*.pem`) y usa `backend/config.example.json` (sin valores reales) como plantilla.

## 5. La clave de OpenAI se guarda en texto plano

La aplicación guarda la clave del usuario en `config.json` (en `%APPDATA%\Local Meeting Analyzer` cuando está instalada) **sin cifrar**. Cualquier proceso que se ejecute con el usuario de Windows puede leerla. Mejora futura recomendada:

- Cifrar la clave con **Electron `safeStorage`** (usa DPAPI en Windows) en el proceso principal y guardar solo el valor cifrado, o
- usar **DPAPI** directamente desde el backend (por ejemplo con `pywin32` o `ctypes`).

Mientras tanto, la política de privacidad debe informar de que la clave se almacena localmente y no se envía a ningún otro destino que no sea OpenAI. Además, **no registres nunca la clave en los logs** (comprueba también que las respuestas del endpoint de configuración no la devuelvan completa a la interfaz).
