import asyncio
import contextlib
import os
from typing import Dict, Optional
from uuid import uuid4

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

if not TOKEN:
    raise RuntimeError("Отсутствует TELEGRAM_BOT_TOKEN в .env")


class SessionStore:
    def __init__(self) -> None:
        self._by_session: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def bind(self, session_id: str, user_id: int) -> None:
        async with self._lock:
            self._by_session[session_id] = user_id

    async def get_user(self, session_id: str) -> Optional[int]:
        async with self._lock:
            return self._by_session.get(session_id)


store = SessionStore()
bot = Bot(token=TOKEN)
dp = Dispatcher()


class ResultPayload(BaseModel):
    session_id: str
    outcome: str
    promo_code: Optional[str] = None

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, value: str) -> str:
        if value not in {"win", "lose"}:
            raise ValueError("Недопустимый исход")
        return value


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse("static/index.html")


@app.get("/api/session")
async def create_session() -> Dict[str, str]:
    return {"session_id": uuid4().hex}


@app.get("/api/check-registration")
async def check_registration(session_id: str) -> Dict[str, bool]:
    user_id = await store.get_user(session_id)
    return {"registered": user_id is not None}


@app.post("/api/result")
async def report_result(payload: ResultPayload) -> Dict[str, bool]:
    if not payload.session_id:
        raise HTTPException(status_code=400, detail="session_id обязателен")

    user_id = await store.get_user(payload.session_id)
    delivered = False
    text = "Проигрыш"

    if payload.outcome == "win":
        if not payload.promo_code:
            raise HTTPException(status_code=400, detail="promo_code обязателен при победе")
        text = f"Победа! Промокод выдан: <code>{payload.promo_code}</code>"

    if user_id:
        await bot.send_message(user_id, text, parse_mode="HTML")
        delivered = True

    return {"delivered": delivered}


@dp.message(CommandStart(deep_link=True))
async def deep_start(message: Message) -> None:
    parts = message.text.split(maxsplit=1) if message.text else []
    if len(parts) < 2:
        await message.answer("Добавьте код сессии из сайта.")
        return

    session_id = parts[1]
    await store.bind(session_id, message.from_user.id)
    await message.answer("Связка сессии выполнена. Возвращайтесь в игру!")


@dp.message(CommandStart())
async def plain_start(message: Message) -> None:
    await message.answer("Откройте сайт, нажмите «Привязать Telegram» и запустите бота снова.")


@app.on_event("startup")
async def on_startup() -> None:
    app.state.bot_task = asyncio.create_task(dp.start_polling(bot))


@app.on_event("shutdown")
async def on_shutdown() -> None:
    app.state.bot_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await app.state.bot_task
    await bot.session.close()

