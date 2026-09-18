/**
 * scripts/orchestrator.js
 * Orquestador principal de procesos para el entorno de desarrollo (Windows-First).
 * Controla el ciclo de vida, consolida logs con colores y limpia procesos zombies.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');

// Colores ANSI para salida consolidada
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function log(service, msg, color = COLORS.gray) {
  const time = new Date().toLocaleTimeString();
  const cleanMsg = msg.toString().trim();
  if (!cleanMsg) return;
  
  // Separar líneas para que cada una tenga el prefijo de servicio
  const lines = cleanMsg.split('\n');
  lines.forEach(line => {
    console.log(`${COLORS.gray}[${time}]${COLORS.reset} ${color}[${service}]${COLORS.reset} ${line}`);
  });
}

const activeProcesses = [];
let isShuttingDown = false;

// Resolver rutas
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const VENV_PYTHON = path.join(BACKEND_DIR, 'venv', 'Scripts', 'python.exe');
const LOCAL_FFMPEG = path.join(ROOT_DIR, 'bin', 'ffmpeg.exe');

// Cargar configuración centralizada desde el archivo .env
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine && !cleanLine.startsWith('#')) {
        const parts = cleanLine.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        process.env[key] = val;
      }
    });
  }
}
loadEnv();

// Configuración de puertos centralizados
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '8765');
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173');
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434');

// Lógica de eliminación profunda de árboles de procesos en Windows
function killProcessTree(pid, name) {
  return new Promise((resolve) => {
    log('System', `Aniquilando árbol de procesos para ${name} (PID: ${pid})...`, COLORS.yellow);
    // En Windows se usa taskkill /f /t para matar el árbol
    exec(`taskkill /pid ${pid} /f /t`, (error, stdout, stderr) => {
      // Ignorar errores si el proceso ya terminó
      resolve();
    });
  });
}

// Limpieza de todos los procesos al salir
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n');
  log('System', 'Cerrando todos los servicios de forma limpia...', COLORS.magenta);
  
  // Detener todos los procesos en orden inverso de inicio
  const killPromises = activeProcesses.reverse().map(p => killProcessTree(p.pid, p.name));
  await Promise.all(killPromises);
  
  log('System', 'Todos los procesos cerrados. ¡Hasta luego!', COLORS.green);
  process.exit(0);
}

// Capturar señales del sistema operativo
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  log('System ERROR', err.message, COLORS.red);
  console.error(err);
  shutdown();
});

// Comprobar si un puerto está libre en el sistema (intenta escuchar)
function checkPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false); // Si hay error (como puerto ocupado), no está libre
    });
    server.once('listening', () => {
      server.close();
      resolve(true); // Si pudimos escuchar, está libre
    });
    // Escucha en todas las interfaces para ser robusto
    server.listen(port);
  });
}

// Comprobar si un puerto ya está escuchando (intenta conectarse)
function checkPortListening(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.once('connect', () => {
      socket.destroy();
      resolve(true); // Se conectó, está escuchando
    });
    socket.once('error', () => {
      resolve(false); // No se pudo conectar, no está escuchando aún
    });
    // Intenta conectar a localhost (resuelve IPv4 e IPv6 automáticamente en Node.js)
    socket.connect(port, 'localhost');
  });
}

// Pre-flight checks
async function runPreFlightChecks() {
  log('Pre-flight', 'Iniciando validaciones del entorno...', COLORS.cyan);

  // 1. Validar FFmpeg (local o en PATH del sistema)
  let ffmpegFound = false;
  if (fs.existsSync(LOCAL_FFMPEG)) {
    log('Pre-flight', `FFmpeg local verificado en: ${LOCAL_FFMPEG}`, COLORS.green);
    ffmpegFound = true;
  } else {
    try {
      const { execSync } = require('child_process');
      execSync('ffmpeg -version', { stdio: 'ignore' });
      log('Pre-flight', 'FFmpeg verificado en el PATH del sistema.', COLORS.green);
      ffmpegFound = true;
    } catch {
      ffmpegFound = false;
    }
  }

  if (!ffmpegFound) {
    log('Pre-flight ERROR', `No se encontró ffmpeg en /bin ni en el PATH del sistema.`, COLORS.red);
    log('Pre-flight TIP', 'Instala FFmpeg en el sistema o añade ffmpeg.exe en la carpeta bin/ del proyecto.', COLORS.yellow);
    process.exit(1);
  }

  // 2. Validar entorno virtual Python
  if (!fs.existsSync(VENV_PYTHON)) {
    log('Pre-flight WARNING', 'No se encontró el entorno virtual (backend/venv).', COLORS.yellow);
    log('Pre-flight', 'Por favor corre "npm run setup" para inicializar las dependencias.', COLORS.yellow);
    process.exit(1);
  }
  log('Pre-flight', 'Entorno virtual Python verificado.', COLORS.green);

  // 3. Comprobar puertos
  const backendPortFree = await checkPortFree(BACKEND_PORT);
  if (!backendPortFree) {
    log('Pre-flight ERROR', `El puerto ${BACKEND_PORT} (FastAPI Backend) ya está en uso.`, COLORS.red);
    process.exit(1);
  }
  const frontendPortFree = await checkPortFree(FRONTEND_PORT);
  if (!frontendPortFree) {
    log('Pre-flight ERROR', `El puerto ${FRONTEND_PORT} (Vite Dev Server) ya está en uso.`, COLORS.red);
    process.exit(1);
  }
  log('Pre-flight', `Puertos ${BACKEND_PORT} y ${FRONTEND_PORT} disponibles.`, COLORS.green);
}

// Poll de HTTP para ver si el backend FastAPI responde
function waitForBackend(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    log('System', 'Esperando respuesta del Backend API...', COLORS.cyan);
    
    const interval = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Timeout esperando al Backend.'));
        return;
      }
      
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {
        // Ignorar errores de conexión mientras levanta
      });
    }, 1000);
  });
}

// Iniciar procesos
async function main() {
  await runPreFlightChecks();
  
  // 1. Verificar Ollama de forma informativa (no bloqueante)
  const ollamaRunning = !(await checkPortFree(OLLAMA_PORT));
  if (!ollamaRunning) {
    log('OllamaInfo', `Ollama no está activo en el puerto ${OLLAMA_PORT}.`, COLORS.yellow);
    log('OllamaInfo', 'El backend iniciará en modo Híbrido, usando OpenAI si está configurado.', COLORS.yellow);
    log('OllamaInfo', 'Puedes iniciar Ollama más tarde y la aplicación lo detectará en caliente.', COLORS.yellow);
  } else {
    log('OllamaInfo', `Ollama detectado y corriendo en el puerto ${OLLAMA_PORT}.`, COLORS.green);
  }

  // 2. Levantar Backend FastAPI (Python)
  log('Backend', 'Iniciando servidor de FastAPI...', COLORS.cyan);
  const backendProc = spawn(VENV_PYTHON, ['main.py'], {
    cwd: BACKEND_DIR,
    shell: true,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });
  
  activeProcesses.push({ name: 'FastAPI Backend', pid: backendProc.pid });
  
  backendProc.stdout.on('data', (data) => log('Backend', data, COLORS.cyan));
  backendProc.stderr.on('data', (data) => log('Backend ERR', data, COLORS.red));
  
  backendProc.on('close', (code) => {
    if (!isShuttingDown) {
      log('Backend', `El proceso terminó inesperadamente con código: ${code}`, COLORS.red);
      shutdown();
    }
  });

  // Esperar a que el backend responda el status check
  try {
    await waitForBackend(`http://127.0.0.1:${BACKEND_PORT}/status`);
    log('Backend', `FastAPI Backend listo y respondiendo en puerto ${BACKEND_PORT}.`, COLORS.green);
  } catch (e) {
    log('Backend ERROR', e.message, COLORS.red);
    shutdown();
    return;
  }

  // 3. Levantar Vite Dev Server (Node)
  log('Vite', 'Iniciando servidor de desarrollo de Vite...', COLORS.blue);
  const viteProc = spawn('npm.cmd', ['run', 'dev:vite'], {
    cwd: FRONTEND_DIR,
    shell: true,
    env: { 
      ...process.env, 
      VITE_BACKEND_URL: `http://localhost:${BACKEND_PORT}`
    }
  });
  
  activeProcesses.push({ name: 'Vite Dev Server', pid: viteProc.pid });
  
  viteProc.stdout.on('data', (data) => log('Vite', data, COLORS.blue));
  viteProc.stderr.on('data', (data) => log('Vite ERR', data, COLORS.red));
  
  viteProc.on('close', (code) => {
    if (!isShuttingDown) {
      log('Vite', `El proceso terminó con código: ${code}`, COLORS.red);
      shutdown();
    }
  });

  // Esperar a que Vite levante su puerto (verificando que esté escuchando)
  let viteReady = false;
  for (let i = 0; i < 15; i++) {
    const isListening = await checkPortListening(FRONTEND_PORT);
    if (isListening) {
      viteReady = true;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (!viteReady) {
    log('Vite ERROR', `El servidor de Vite no levantó en el puerto ${FRONTEND_PORT}.`, COLORS.red);
    shutdown();
    return;
  }
  log('Vite', `Vite Dev Server listo en puerto ${FRONTEND_PORT}.`, COLORS.green);

  // 4. Levantar Electron Shell (React Dev App)
  log('Electron', 'Iniciando interfaz de escritorio Electron...', COLORS.green);
  const electronProc = spawn('npx.cmd', ['electron', '.'], {
    cwd: FRONTEND_DIR,
    shell: true,
    env: { 
      ...process.env, 
      NODE_ENV: 'development',
      VITE_DEV_URL: `http://localhost:${FRONTEND_PORT}`
    }
  });
  
  activeProcesses.push({ name: 'Electron Shell', pid: electronProc.pid });
  
  electronProc.stdout.on('data', (data) => log('Electron', data, COLORS.green));
  electronProc.stderr.on('data', (data) => log('Electron ERR', data, COLORS.red));
  
  electronProc.on('close', (code) => {
    log('Electron', `Aplicación de escritorio cerrada (código: ${code}).`, COLORS.magenta);
    shutdown();
  });
}

main();
