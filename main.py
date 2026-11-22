from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio, random, json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Здесь подключаете реальные источники: MQTT, Home Assistant API, serial и т.д.
def read_sensors():
    return {
        "living_room_temp": round(random.uniform(20.0, 24.0), 1),
        "kitchen_light": random.choice([True, False]),
        "front_door_locked": True,
        "energy_usage_kw": round(random.uniform(1.2, 3.5), 2),
        "rooms": [
            {"id": "living", "name": "Гостиная", "temp": 22.4, "humidity": 45},
            {"id": "kitchen", "name": "Кухня", "temp": 23.1, "humidity": 50},
            {"id": "bedroom", "name": "Спальня", "temp": 21.0, "humidity": 42},
        ],
    }

@app.get("/api/smart-home/status")
def status():
    return read_sensors()

@app.post("/api/smart-home/devices/{device_id}/toggle")
def toggle(device_id: str):
    # вызов реального переключения (HA service call, MQTT publish и пр.)
    return {"ok": True, "device_id": device_id}

# Live-обновления через WebSocket (опционально, но для умного дома самое то)
@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_text(json.dumps(read_sensors()))
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass


# uvicorn main:app --reload --port 8000