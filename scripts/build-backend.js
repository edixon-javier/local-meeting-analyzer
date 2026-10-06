/**
 * scripts/build-backend.js
 * Congela el backend de Python con PyInstaller (onedir) para empaquetarlo con Electron.
 * Salida: backend/dist/meeting-backend/meeting-backend.exe (+ _internal/)
 *
 * Usa backend/venv por defecto. Para otro intérprete: BACKEND_PYTHON=C:\ruta\python.exe
 */

const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function log(step, msg, color = COLORS.gray) {
  console.log(`${color}[${step}]${COLORS.reset} ${msg}`);
}

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const SPEC_FILE = path.join(BACKEND_DIR, 'meeting_backend.spec');
const DIST_DIR = path.join(BACKEND_DIR, 'dist');
const WORK_DIR = path.join(BACKEND_DIR, 'build', 'pyinstaller');
const OUTPUT_DIR = path.join(DIST_DIR, 'meeting-backend');
const OUTPUT_EXE = path.join(OUTPUT_DIR, 'meeting-backend.exe');
const FFMPEG_EXE = path.join(ROOT_DIR, 'bin', 'ffmpeg.exe');

const PYTHON = process.env.BACKEND_PYTHON || path.join(BACKEND_DIR, 'venv', 'Scripts', 'python.exe');

function runCommand(command, args, cwd, stepName) {
  return new Promise((resolve, reject) => {
    log(stepName, `Ejecutando: ${command} ${args.join(' ')}...`, COLORS.cyan);

    // Sin shell: las rutas con espacios llegan intactas
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    proc.on('error', (err) => {
      log(stepName, `No se pudo ejecutar: ${err.message}`, COLORS.red);
      reject(err);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log(stepName, 'Completado con éxito.', COLORS.green);
        resolve();
      } else {
        log(stepName, `Falló con código de salida: ${code}`, COLORS.red);
        reject(new Error(`${stepName} falló`));
      }
    });
  });
}

function folderSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? folderSize(full) : fs.statSync(full).size;
  }
  return total;
}

function hasPyInstaller() {
  try {
    const version = execFileSync(PYTHON, ['-m', 'PyInstaller', '--version'], { encoding: 'utf-8' }).trim();
    log('Prereq', `PyInstaller ${version} detectado.`, COLORS.green);
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  log('Build Backend', 'Congelando el backend de Python con PyInstaller...', COLORS.bright + COLORS.blue);

  // 1. Verificar intérprete
  if (!fs.existsSync(PYTHON)) {
    log('Prereq ERROR', `No se encontró Python en ${PYTHON}. Ejecuta primero: npm run setup`, COLORS.red);
    process.exit(1);
  }
  try {
    const version = execFileSync(PYTHON, ['--version'], { encoding: 'utf-8' }).trim();
    log('Prereq', `Usando ${version} (${PYTHON})`, COLORS.green);
  } catch (e) {
    log('Prereq ERROR', `No se pudo ejecutar ${PYTHON}: ${e.message}`, COLORS.red);
    process.exit(1);
  }

  // 2. Dependencias de build (PyInstaller)
  if (!hasPyInstaller()) {
    log('Prereq', 'PyInstaller no está instalado. Instalando requirements-build.txt...', COLORS.yellow);
    try {
      await runCommand(PYTHON, ['-m', 'pip', 'install', '-r', 'requirements-build.txt'], BACKEND_DIR, 'Build Deps');
    } catch (e) {
      log('Prereq ERROR', 'Error instalando dependencias de build.', COLORS.red);
      process.exit(1);
    }
  }

  // 3. PyInstaller
  try {
    await runCommand(
      PYTHON,
      ['-m', 'PyInstaller', SPEC_FILE, '--noconfirm', '--clean', '--distpath', DIST_DIR, '--workpath', WORK_DIR],
      BACKEND_DIR,
      'PyInstaller'
    );
  } catch (e) {
    log('Build ERROR', 'PyInstaller falló. Revisa la salida anterior.', COLORS.red);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_EXE)) {
    log('Build ERROR', `No se generó ${OUTPUT_EXE}`, COLORS.red);
    process.exit(1);
  }

  const sizeMb = (folderSize(OUTPUT_DIR) / (1024 * 1024)).toFixed(1);
  log('Build Backend', `Backend congelado en ${OUTPUT_DIR} (${sizeMb} MB)`, COLORS.bright + COLORS.green);

  // 4. Aviso: electron-builder también empaqueta bin/ffmpeg.exe
  if (!fs.existsSync(FFMPEG_EXE)) {
    log('Aviso', `No existe ${FFMPEG_EXE}. Descarga un build LGPL de ffmpeg antes de empaquetar (ver docs/DISTRIBUCION.md).`, COLORS.yellow);
  }
}

main();
