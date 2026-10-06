# Guía de lanzamiento: tus tareas paso a paso

Esta guía cubre **lo que solo tú puedes hacer** para publicar Local Meeting Analyzer 1.6.0. Todo lo técnico ya está hecho, y todo se hace con cuentas y servicios **gratuitos**.

Sigue las fases en orden: cada una prepara los datos que necesita la siguiente.

| Fase | Qué | Tiempo aprox. | Costo |
|---|---|---|---|
| 1 | Crear cuentas (GitHub y Microsoft Partner Center) | 30 min (y hasta 1-2 días de verificación de Microsoft) | 0 |
| 2 | Rellenar tus datos en los documentos | 30-45 min | 0 |
| 3 | Subir el código a GitHub y activar la página de privacidad | 20 min | 0 |
| 4 | Probar la app en un Windows limpio (Windows Sandbox) | 1-2 h | 0 |
| 5 | Publicar la primera versión en GitHub | 20 min | 0 |
| 6 | Publicar en Microsoft Store | 1-2 h (y 1-3 días de certificación) | 0 |
| 7 | (Opcional) Firma gratuita con SignPath | 1 h (y espera de aprobación) | 0 |
| 8 | Después del lanzamiento | continuo | 0 |

---

## Fase 1 — Crear las cuentas

### 1.1 Decide estos datos antes de empezar

Apúntalos en un papel; los usarás en todas las fases:

- **Titular:** tu nombre legal completo, o el de tu empresa si tienes una.
- **Correo de contacto y de soporte:** recomendado: crea un Gmail **solo para la app** (p. ej. `localmeetinganalyzer.soporte@gmail.com`). Así no expones tu correo personal y puedes delegarlo más adelante.
- **País/jurisdicción:** el país cuyas leyes rigen los documentos (normalmente tu país de residencia).
- **Fecha de entrada en vigor:** el día en que publiques (p. ej. `15 de octubre de 2026`).
- **Usuario de GitHub y nombre del repositorio:** p. ej. `edixon-Lizcano/local-meeting-analyzer`.

### 1.2 GitHub

1. Si no tienes cuenta, créala en https://github.com/signup.
2. Crea un repositorio **vacío y público** en https://github.com/new:
   - Nombre: `local-meeting-analyzer` (o el que elegiste).
   - **No** marques "Add a README", ni ".gitignore", ni "license": el repositorio ya los tiene.
3. **No subas nada todavía.** Primero rellena tus datos (fase 2).

Con esto ya conoces dos URLs:

- Repositorio: `https://github.com/USUARIO/REPO`
- Política de privacidad: `https://USUARIO.github.io/REPO/privacy.html` (funcionará en la fase 3)

### 1.3 Microsoft Partner Center (para la Store)

1. Entra en https://storedeveloper.microsoft.com y regístrate como **desarrollador individual**. Es gratis y no pide tarjeta.
2. Completa la verificación de identidad que te pida. Puede tardar desde minutos hasta un par de días.
3. Cuando tengas acceso: **Apps y juegos → Nueva aplicación → Aplicación MSIX o PWA** → reserva el nombre `Local Meeting Analyzer`.
   - Si el nombre está ocupado, reserva otro (p. ej. `Meeting Analyzer Local`) y avísame para cambiar `productName` y `displayName` en el proyecto.
4. Ve a **Administración del producto → Identidad del producto** y copia estos tres valores:
   - `Package/Identity/Name`
   - `Package/Identity/Publisher` (empieza por `CN=`)
   - `Package/Properties/PublisherDisplayName`

---

## Fase 2 — Rellenar tus datos

### 2.1 Sustituye los marcadores

Abre cada archivo y reemplaza los marcadores por tus datos (en VS Code: **Ctrl+Shift+H**, Buscar y reemplazar en archivos).

| Marcador | Valor | Archivos |
|---|---|---|
| `[NOMBRE DEL TITULAR]` | Tu nombre legal | `legal/EULA.txt`, `legal/PRIVACY.md`, `docs/privacy.html`, `docs/store-listing.md` |
| `[CORREO DE CONTACTO]` | Correo de la app | los mismos 4 |
| `[PAÍS/JURISDICCIÓN]` | Tu país | `legal/EULA.txt`, `legal/PRIVACY.md`, `docs/privacy.html` |
| `[FECHA DE ENTRADA EN VIGOR]` | Fecha de publicación | `legal/EULA.txt`, `legal/PRIVACY.md`, `docs/privacy.html` |
| `[URL DEL REPOSITORIO]` | `https://github.com/USUARIO/REPO` | `legal/*`, `docs/privacy.html`, `README.md`, `docs/SOPORTE.md`, `docs/store-listing.md`, `frontend/src/appInfo.js` |
| `[CORREO DE SOPORTE]` | Correo de la app | `frontend/src/appInfo.js`, `docs/SOPORTE.md` |
| `[URL PÚBLICA DE docs/privacy.html]` | `https://USUARIO.github.io/REPO/privacy.html` | `frontend/src/appInfo.js`, `docs/store-listing.md` |
| `[USUARIO]` / `[REPOSITORIO]` | Tu usuario y repo de GitHub | `docs/store-listing.md` |
| `REEMPLAZAR-usuario-github` / `REEMPLAZAR-repositorio` | Tu usuario y repo de GitHub | `.github/ISSUE_TEMPLATE/config.yml`, `frontend/package.json` (bloque `publish`) |
| `REEMPLAZAR.PartnerCenter.PackageIdentityName` | `Package/Identity/Name` | `frontend/package.json` (bloque `appx`, `identityName`) |
| `CN=REEMPLAZAR-PartnerCenter-PackageIdentityPublisher` | `Package/Identity/Publisher` completo, con `CN=` | `frontend/package.json` (`appx.publisher`) |
| `REEMPLAZAR con PublisherDisplayName de Partner Center` | `PublisherDisplayName` | `frontend/package.json` (`appx.publisherDisplayName`) |

**No los rellenes todavía:** `[URL DE LA FICHA EN MICROSOFT STORE]` (`appInfo.js`) y `[ENLACE DE MICROSOFT STORE]` (`README.md`). Los tendrás cuando la Store apruebe la app (fase 6).

**No toques:** `docs/DISTRIBUCION.md` ni `frontend/src/utils/support.test.js`. Sus `REEMPLAZAR` y marcadores son ejemplos a propósito.

### 2.2 Borra las notas para el desarrollador

- `legal/EULA.txt`: borra el bloque `[NOTA PARA EL DESARROLLADOR ...]` del principio, hasta la línea en blanco. **Importante:** este archivo se muestra en el instalador.
- `legal/PRIVACY.md`, `legal/CONSENT_NOTICE.md`, `docs/privacy.html`, `docs/store-listing.md`: borra los comentarios `<!-- ... -->` con notas para el desarrollador.

`legal/EULA.txt` debe seguir guardado como **UTF-8 con BOM**. VS Code lo respeta si no cambias la codificación (abajo a la derecha debe decir "UTF-8 with BOM").

### 2.3 Comprueba que no quede ninguno

Este comando debe devolver solo `[URL DE LA FICHA EN MICROSOFT STORE]` y `[ENLACE DE MICROSOFT STORE]`:

```powershell
git grep -n -E "\[(NOMBRE DEL TITULAR|CORREO|URL|PAÍS|FECHA|ENLACE|USUARIO|REPOSITORIO)|REEMPLAZAR" -- . ":!docs/DISTRIBUCION.md" ":!docs/SEGURIDAD.md" ":!docs/GUIA-LANZAMIENTO.md" ":!frontend/src/utils/support.test.js"
```

### 2.4 Verifica y guarda

```powershell
cd frontend
npm run lint
npm test
cd ..
git add -A
git commit -m "docs: datos del titular, soporte y URLs públicas"
```

> ¿Te atascas? Pídeme "rellena los marcadores con estos datos: ..." y lo hago yo.

---

## Fase 3 — Subir a GitHub

### 3.1 (Opcional) Quitar el icono antiguo del historial

Ahorra 1,6 MB y **solo se puede hacer antes del primer push**. Instrucciones en `docs/SEGURIDAD.md`, sección 3. Si no te importa el tamaño, sáltalo.

### 3.2 Última revisión de secretos

No debe devolver nada:

```powershell
git log --all -p | Select-String -Pattern "sk-proj-[A-Za-z0-9_-]{20,}"
```

### 3.3 Subir

```powershell
git remote add origin https://github.com/USUARIO/REPO.git
git push -u origin main
git push origin v1.5.0
```

Las ramas `feature/*` son antiguas y ya están integradas, así que no hace falta subirlas.

### 3.4 Activar la página de privacidad (GitHub Pages)

1. En el repositorio: **Settings → Pages**.
2. **Source:** "Deploy from a branch". **Branch:** `main`, carpeta `/docs`. Pulsa **Save**.
3. Espera 1-2 minutos y abre `https://USUARIO.github.io/REPO/privacy.html`. Debe verse la política de privacidad.

### 3.5 Revisar que el CI funcione

1. Pestaña **Actions**: el push a `main` lanza el flujo "Build". Debe terminar en verde (unos 15-25 min).
2. Al terminar, abre la ejecución y descarga los **Artifacts**: el instalador `.exe` y el paquete `.appx`. Los usarás en la fase 4.
3. Es la primera vez que se genera el `.appx` (en el PC de desarrollo no se pudo probar). Si el flujo falla en ese paso, copia el error del log y tráemelo.

> El `.exe` del CI lleva la versión LGPL de FFmpeg. **No uses ni compartas** un instalador generado en tu PC, porque tu `bin/ffmpeg.exe` local es GPL.

---

## Fase 4 — Probar en un Windows limpio (Windows Sandbox)

Windows Sandbox viene gratis con tu Windows 11 Pro. Es un Windows nuevo y desechable: se borra al cerrarlo.

### 4.1 Activarlo (una sola vez)

1. Menú Inicio → busca **"Activar o desactivar las características de Windows"**.
2. Marca **"Espacio aislado de Windows"** (Windows Sandbox) → Aceptar → reinicia.

### 4.2 Configuración con micrófono y más memoria

1. Pon el `.exe` descargado del CI en una carpeta, p. ej. `C:\PruebasApp`.
2. Crea en el escritorio un archivo `PruebaApp.wsb` con este contenido y ábrelo con doble clic:

```xml
<Configuration>
  <MemoryInMB>8192</MemoryInMB>
  <AudioInput>Enable</AudioInput>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>C:\PruebasApp</HostFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
</Configuration>
```

### 4.3 Lista de pruebas

Dentro del Sandbox, la carpeta aparece en el escritorio. Marca cada punto:

- [ ] Al ejecutar el `.exe`, Windows muestra SmartScreen ("Windows protegió su PC"). Pulsa **Más información → Ejecutar de todas formas**. Es lo esperado porque no está firmado.
- [ ] El instalador muestra la **licencia y términos de uso** sin caracteres raros en las tildes.
- [ ] La app arranca sin pedir Python ni Node.
- [ ] Aparece la **bienvenida**. El paso "Tu equipo" muestra RAM, CPU y disco.
- [ ] Paso Ollama: "Descargar Ollama" abre la web. Instálalo, vuelve y pulsa "Ya lo instalé — verificar".
- [ ] Descarga del modelo `qwen3:4b` con barra de progreso (unos 2,5 GB; tarda según tu conexión).
- [ ] El paso de consentimiento no deja terminar sin marcar la casilla.
- [ ] Graba 1-2 minutos hablando y transcribe. La primera vez descarga el modelo de Whisper.
- [ ] Analiza la grabación: resumen, tareas y decisiones en español.
- [ ] Historial, chat con la reunión y exportar acta.
- [ ] **Ajustes → Ayuda y soporte:** "Copiar diagnóstico", "Abrir carpeta de registros" y "Ver bienvenida de nuevo".
- [ ] Ajustes → Privacidad: la opción de usar la nube está **desactivada** por defecto.
- [ ] Ctrl+Shift+R con la ventana minimizada inicia o detiene la grabación.
- [ ] Desinstala desde Configuración → Aplicaciones: no debe dar error.

**Si algo falla:** en Ajustes → "Copiar diagnóstico", pega el texto en un archivo y tráemelo junto con lo que hiciste. Los registros están en `%APPDATA%\Local Meeting Analyzer\logs`.

---

## Fase 5 — Primera versión en GitHub (v1.6.0)

1. En `CHANGELOG.md`, cambia `## [1.6.0] - Sin publicar` por `## [1.6.0] - AAAA-MM-DD` con la fecha de hoy.
2. Guarda, etiqueta y sube:

```powershell
git commit -am "chore(release): 1.6.0"
git tag v1.6.0
git push origin main v1.6.0
```

3. En **Actions** verás el flujo de la etiqueta. Comprueba que la etiqueta coincide con la versión de `frontend/package.json` y crea un **borrador de Release** con el `.exe`, `latest.yml` y `.blockmap`.
4. Ve a **Releases** y edita el borrador: pega la sección 1.6.0 del CHANGELOG como notas y pulsa **Publish release**.

Desde ahora, quien instale el `.exe` recibirá las actualizaciones automáticamente.

**Para cada versión futura:**

1. Sube la versión en `frontend/package.json`, `package.json` y `backend/core/version.py`.
2. Añade la entrada al CHANGELOG.
3. Crea la etiqueta `vX.Y.Z` y súbela.
4. Publica el borrador.

---

## Fase 6 — Microsoft Store

La guía detallada está en `docs/DISTRIBUCION.md`, sección 4, y los textos listos para pegar en `docs/store-listing.md`. Resumen:

1. En Partner Center, abre tu app → **Iniciar el envío**.
2. **Precios y disponibilidad:** Gratis, todos los mercados (o los que quieras).
3. **Propiedades:**
   - Categoría **Productividad**.
   - URL de privacidad: `https://USUARIO.github.io/REPO/privacy.html`.
   - Sitio web: tu repositorio.
   - Soporte: tu correo.
4. **Clasificación por edades:** responde el cuestionario con las respuestas de `docs/store-listing.md`.
5. **Paquetes:** sube el `.appx` del release 1.6.0, de los artefactos del CI de la etiqueta. Debe haberse compilado con los datos de identidad de Partner Center que pusiste en la fase 2.
6. **Descripciones de la Store (español):**
   - Copia la descripción de `docs/store-listing.md`. Las **dos primeras líneas** deben avisar que requiere Ollama.
   - Sube al menos 1 captura de pantalla (mínimo 1366×768). Las de la pantalla de grabación, el análisis y la bienvenida funcionan bien.
7. **Opciones de envío → Capacidades restringidas:** pega la justificación de `runFullTrust` de `docs/store-listing.md`.
8. **Enviar a la Store.** La certificación tarda de horas a 3 días hábiles. Si la rechazan, el correo dice el motivo exacto: tráemelo y lo corregimos.
9. Cuando esté publicada, rellena `[URL DE LA FICHA EN MICROSOFT STORE]` (`frontend/src/appInfo.js`) y `[ENLACE DE MICROSOFT STORE]` (`README.md`), y haz commit.

La Store firma el paquete y lo actualiza sola: los usuarios de la Store **no ven el aviso de SmartScreen**.

---

## Fase 7 — (Opcional) Firma gratuita del `.exe` con SignPath

Elimina el aviso de SmartScreen también para quien descarga desde GitHub. Requisitos que ya cumples: licencia OSI (AGPL-3.0), repositorio público y builds en CI. Te falta **una release ya publicada** (fase 5).

1. Solicítalo en https://signpath.org (programa para proyectos open source).
2. Cuando te aprueben, pídeme "integra SignPath en el CI". Hay que añadir su acción al flujo y poner `publisherName` en `frontend/package.json` para que electron-updater verifique la firma.

Detalles y alternativas de pago en `docs/DISTRIBUCION.md`, sección 6.

---

## Fase 8 — Después del lanzamiento

- **Soporte:** revisa GitHub Issues (las plantillas ya están configuradas) y el correo de la app. Responde aunque sea con un "lo reviso".
- **Reseñas de la Store:** Partner Center → Reseñas. Responder mejora la valoración.
- **Donaciones (gratis):** activa GitHub Sponsors (https://github.com/sponsors) o crea un Ko-fi. Si quieres, te añado el archivo `.github/FUNDING.yml` y un enlace en Ajustes.
- **Ingresos más adelante:** la AGPL te permite cobrar por la versión de la Store, ofrecer instalación o soporte a empresas y aceptar patrocinios. Lo que no puedes es cerrar el código.
- **Revisión legal:** los documentos legales son borradores de buena fe. Para un lanzamiento gratuito suelen bastar; **si empiezas a cobrar**, conviene que un abogado los revise.
- **Limpieza local:** cuando estés seguro de que todo está bien, borra la copia del historial anterior. Contiene la clave ya revocada:
  `C:\Users\abata\AppData\Local\Temp\claude\F--Proyectos-Extension-reuniones\bd66edd4-4f47-4151-825e-e4fbdbc70b84\scratchpad\git-backup-pre-purge`
- **Pendientes técnicos opcionales** (pídemelos cuando quieras): gitleaks en el CI, cifrar la clave de OpenAI con DPAPI y excluir `cudnn64_9.dll` del backend congelado.
