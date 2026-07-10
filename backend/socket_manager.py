from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        user_id_str = str(user_id)
        if user_id_str in self.active_connections:
            websocket = self.active_connections[user_id_str]
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(user_id_str)

manager = ConnectionManager()
