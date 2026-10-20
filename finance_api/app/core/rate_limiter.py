from collections import defaultdict, deque
import threading
import time
from typing import Deque, Dict, Optional, Tuple

from fastapi import HTTPException, status
from app.core.config import settings

class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int = 10, window_seconds: int = 7200):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check_rate_limit(self, key: str, current_time: Optional[float] = None) -> Tuple[bool, int, int]:
        now = current_time if current_time is not None else time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            timestamps = self._hits[key]
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()

            if len(timestamps) >= self.max_requests:
                oldest_timestamp = timestamps[0]
                retry_after = max(1, int(oldest_timestamp + self.window_seconds - now))
                return False, 0, retry_after

            timestamps.append(now)
            remaining = self.max_requests - len(timestamps)

            if len(self._hits) > 500:
                self._prune_expired_locked(cutoff)

            return True, remaining, 0

    def get_remaining(self, key: str, current_time: Optional[float] = None) -> int:
        now = current_time if current_time is not None else time.time()
        cutoff = now - self.window_seconds
        with self._lock:
            timestamps = self._hits[key]
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()
            return max(0, self.max_requests - len(timestamps))

    def reset(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is not None:
                self._hits.pop(key, None)
            else:
                self._hits.clear()

    def _prune_expired_locked(self, cutoff: float) -> None:
        expired = [k for k, q in self._hits.items() if not q or q[-1] <= cutoff]
        for k in expired:
            del self._hits[k]

login_rate_limiter = SlidingWindowRateLimiter(
    max_requests=settings.LOGIN_RATE_LIMIT_MAX_HITS,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
)

def enforce_login_rate_limit(key: str) -> Tuple[int, int]:
    allowed, remaining, retry_after = login_rate_limiter.check_rate_limit(key)
    if not allowed:
        hours = retry_after // 3600
        minutes = max(1, (retry_after % 3600) // 60) if hours == 0 else (retry_after % 3600) // 60
        time_msg = f"{hours} hour(s) and {minutes} minute(s)" if hours > 0 else f"{minutes} minute(s)"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts for this user. Rate limit of {login_rate_limiter.max_requests} hits per 2 hours exceeded. Please try again in {time_msg}.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(login_rate_limiter.max_requests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time() + retry_after)),
            },
        )
    return remaining, login_rate_limiter.max_requests
