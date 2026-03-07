"""
groq_key_rotator.py  —  Multi-key Groq API rotation for UniAdvisor AI
"""
import os
import logging
from groq import Groq

logger = logging.getLogger(__name__)


class GroqKeyRotator:
    FALLBACK_MODELS = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "gemma2-9b-it",
    ]

    def __init__(self, keys: list = None):
        if keys:
            self.keys = [k.strip() for k in keys if k and k.strip()]
        else:
            self.keys = []
            i = 1
            while True:
                key = os.getenv(f"GROQ_API_KEY_{i}")
                if not key:
                    if i == 1:
                        key = os.getenv("GROQ_API_KEY")
                        if key:
                            self.keys.append(key.strip())
                    break
                self.keys.append(key.strip())
                i += 1

        if not self.keys:
            raise RuntimeError(
                "No Groq API keys found. Set GROQ_API_KEY_1, GROQ_API_KEY_2 ... in your .env file."
            )

        self.clients = [Groq(api_key=k) for k in self.keys]
        self.current_key_index = 0
        logger.info(f"GroqKeyRotator ready with {len(self.keys)} key(s)")

    def _is_rate_limit(self, error: Exception) -> bool:
        msg = str(error)
        return "429" in msg or "rate_limit_exceeded" in msg or "Rate limit" in msg

    def _next_key(self):
        self.current_key_index = (self.current_key_index + 1) % len(self.keys)

    def chat(self, messages: list, max_tokens: int = 1000,
             temperature: float = 0.2, model: str = "llama-3.3-70b-versatile"):
        models_to_try = [model] + [m for m in self.FALLBACK_MODELS if m != model]
        keys_tried = 0
        last_error = None

        while keys_tried < len(self.keys):
            client = self.clients[self.current_key_index]
            key_label = f"key#{self.current_key_index + 1}"

            for m in models_to_try:
                try:
                    response = client.chat.completions.create(
                        model=m,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        messages=messages,
                    )
                    return response
                except Exception as e:
                    if self._is_rate_limit(e):
                        logger.warning(f"Rate limit on {key_label} / {m} — trying next")
                        last_error = e
                        continue
                    else:
                        raise

            logger.warning(f"All models exhausted on {key_label} — rotating key")
            self._next_key()
            keys_tried += 1

        raise last_error


_rotator = None

def get_groq_rotator() -> GroqKeyRotator:
    global _rotator
    if _rotator is None:
        _rotator = GroqKeyRotator()
    return _rotator