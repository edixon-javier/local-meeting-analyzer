import asyncio
import time
import httpx
from typing import List

# Estado global del Heartbeat
ollama_online = False
active_listeners: List[asyncio.Queue] = []
cached_models: List[str] = []
last_models_update: float = 0.0

async def check_ollama_status(url: str = "http://127.0.0.1:11434/api/tags") -> bool:
    global cached_models, last_models_update
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=2.0)
            if response.status_code == 200:
                try:
                    data = response.json().get("models", [])
                    models = [m["name"] for m in data if isinstance(m, dict) and "name" in m]
                    if models:
                        cached_models = models
                        last_models_update = time.time()
                except Exception:
                    pass
                return True
            return False
    except Exception:
        return False

async def warm_up_ollama(analyzer):
    try:
        print("[Heartbeat] Iniciando precalentamiento (warm-up) del modelo Ollama...")
        # Llama a _call_ollama de forma no bloqueante para cargar el modelo en memoria
        # Usamos run_in_executor porque _call_ollama es síncrono (usa requests)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None, 
            analyzer.local_provider._call_ollama, 
            "Warm up: responde con una palabra."
        )
        print("[Heartbeat] Precalentamiento del modelo Ollama completado.")
    except Exception as e:
        print(f"[Heartbeat] Error durante el precalentamiento de Ollama: {e}")

async def notify_listeners(status: str):
    event_data = f"data: {{\"event\": \"ollama_status\", \"status\": \"{status}\"}}\n\n"
    # Notificar a todas las conexiones SSE abiertas de forma segura
    for queue in list(active_listeners):
        await queue.put(event_data)

async def start_ollama_heartbeat(analyzer):
    global ollama_online
    print("[Heartbeat] Iniciando tarea en segundo plano para monitoreo de Ollama...")
    
    # Primera comprobación inmediata
    ollama_online = await check_ollama_status()
    
    while True:
        await asyncio.sleep(12.0)
        current_status = await check_ollama_status()
        
        if current_status != ollama_online:
            ollama_online = current_status
            status_str = "online" if ollama_online else "offline"
            print(f"[Heartbeat] Ollama cambió de estado a: {status_str.upper()}")
            
            # Notificar
            await notify_listeners(status_str)
            
            # Si pasó a online, disparar calentamiento del modelo
            if ollama_online:
                asyncio.create_task(warm_up_ollama(analyzer))
