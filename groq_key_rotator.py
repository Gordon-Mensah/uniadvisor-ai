"""
groq_key_rotator.py  —  Multi-key Groq API rotation for UniAdvisor AI
"""
import os
import re
import logging
from groq import Groq

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "openai/gpt-oss-20b"


def current_model() -> str:
    """Model from the GROQ_MODEL env var (read on every call, so it can be changed at runtime)."""
    return os.getenv("GROQ_MODEL", "").strip() or DEFAULT_MODEL


def is_reasoning_model(model: str) -> bool:
    return model.startswith("openai/gpt-oss")


def reasoning_params(model: str, reasoning_effort: str = "low") -> dict:
    """Extra request parameters so reasoning models return only their final answer.

    gpt-oss: reasoning_effort low/medium/high; include_reasoning=False drops the
             reasoning from the response.
    qwen3:   does not accept reasoning_effort="low"; reasoning_format="hidden"
             returns only the final answer.
    Other models get no extra parameters (Groq rejects them for non-reasoning models).
    """
    if is_reasoning_model(model):
        return {"reasoning_effort": reasoning_effort, "include_reasoning": False}
    if model.startswith("qwen/qwen3"):
        return {"reasoning_format": "hidden"}
    return {}


_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def final_text(response) -> str:
    """Return only the model's final answer, never its reasoning.

    gpt-oss puts reasoning in message.reasoning (and we ask Groq not to send it
    at all); other reasoning models can inline it as <think>...</think>, which
    is stripped here as a safeguard.
    """
    choice = response.choices[0]
    content = _THINK_RE.sub("", choice.message.content or "").strip()
    if not content:
        raise RuntimeError(
            f"Model returned no final answer (finish_reason={choice.finish_reason}). "
            "If finish_reason is 'length', the reasoning used up max_tokens; raise max_tokens."
        )
    return content


class GroqKeyRotator:
    # Optional extra models to try when a key is rate-limited on the main one,
    # e.g. GROQ_FALLBACK_MODELS="openai/gpt-oss-120b". Empty by default so every
    # answer comes from the configured model (important for evaluation runs).
    FALLBACK_MODELS = [m.strip() for m in os.getenv("GROQ_FALLBACK_MODELS", "").split(",") if m.strip()]

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

    def chat(self, messages: list, max_tokens: int = 1024,
             temperature: float = 0.2, model: str = None, reasoning_effort: str = "low"):
        model = model or current_model()
        models_to_try = [model] + [m for m in self.FALLBACK_MODELS if m != model]
        keys_tried = 0
        last_error = None

        while keys_tried < len(self.keys):
            client = self.clients[self.current_key_index]
            key_label = f"key#{self.current_key_index + 1}"

            for m in models_to_try:
                try:
                    # Reasoning tokens count toward max_tokens; keep reasoning short
                    # and don't send it back (we only use the final answer).
                    extra = reasoning_params(m, reasoning_effort)
                    response = client.chat.completions.create(
                        model=m,
                        max_completion_tokens=max_tokens,  # includes reasoning tokens
                        temperature=temperature,
                        messages=messages,
                        **extra,
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