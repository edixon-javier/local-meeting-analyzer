/**
 * scripts/setup.js
 * Script de aprovisionamiento inicial y configuración de dependencias para el proyecto.
 * Configura el entorno virtual de Python, instala dependencias de backend y frontend.
 */

const { spawn, execSync } = require('child_process');
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
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

function runCommand(command, args, cwd, stepName) {
  return new Promise((resolve, reject) => {
    log(stepName, `Ejecutando: ${command} ${args.join(' ')}...`, COLORS.cyan);
    
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      stdio: 'inherit'
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

async function main() {
  log('Setup', 'Iniciando configuración automática de dependencias...', COLORS.bright + COLORS.blue);

  // 1. Verificar prerrequisitos
  try {
    execSync('python --version');
    log('Prereq', 'Python detectado en el PATH.', COLORS.green);
  } catch (e) {
    log('Prereq ERROR', 'Python no se encontró en el PATH. Por favor instala Python 3.10+ y agrégalo al PATH.', COLORS.red);
    process.exit(1);
  }

  try {
    execSync('node --version');
    log('Prereq', 'Node.js detectado en el PATH.', COLORS.green);
  } catch (e) {
    log('Prereq ERROR', 'Node.js no se encontró en el PATH. Por favor instala Node.js >= 18.', COLORS.red);
    process.exit(1);
  }

  // 2. Configuración del backend (venv y pip)
  const venvPath = path.join(BACKEND_DIR, 'venv');
  const pipPath = path.join(venvPath, 'Scripts', 'pip.exe');
  
  if (!fs.existsSync(venvPath)) {
    log('Backend', 'Creando entorno virtual Python (venv)...', COLORS.cyan);
    try {
      await runCommand('python', ['-m', 'venv', 'venv'], BACKEND_DIR, 'Venv Creation');
    } catch (e) {
      log('Backend ERROR', 'No se pudo crear el entorno virtual de Python.', COLORS.red);
      process.exit(1);
    }
  } else {
    log('Backend', 'Entorno virtual Python (venv) ya existe.', COLORS.green);
  }

  log('Backend', 'Instalando dependencias de Python (requirements.txt)...', COLORS.cyan);
  try {
    await runCommand(pipPath, ['install', '-r', 'requirements.txt'], BACKEND_DIR, 'Python Deps');
  } catch (e) {
    log('Backend ERROR', 'Error instalando dependencias de Python.', COLORS.red);
    process.exit(1);
  }

  // 3. Configuración del frontend (npm install)
  log('Frontend', 'Instalando dependencias de Node.js (Electron + React)...', COLORS.cyan);
  try {
    await runCommand('npm', ['install'], FRONTEND_DIR, 'Frontend Deps');
  } catch (e) {
    log('Frontend ERROR', 'Error instalando dependencias de Node.js.', COLORS.red);
    process.exit(1);
  }

  log('Setup', '¡Configuración completada con éxito!', COLORS.bright + COLORS.green);
  log('Setup', 'Ahora puedes iniciar el proyecto en desarrollo ejecutando: npm run dev', COLORS.yellow);
}

main();
