"""API P95 Latency 성능 테스트 스크립트.

실행 방법:
  uv run python scripts/performance_test.py --base-url http://localhost:8000 --email test@test.com --password pass123

출력:
  각 엔드포인트별 Min / Mean / P50 / P95 / P99 / Max 테이블
"""

from __future__ import annotations

import argparse
import statistics
import sys
import time
from datetime import date

import httpx

ENDPOINTS: list[tuple[str, str]] = [
    ("GET", "/api/v1/schedules/daily?date={today}"),
    ("GET", "/api/v1/reminders"),
    ("GET", "/api/v1/notifications"),
    ("GET", "/api/v1/notifications/unread-count"),
    ("GET", "/api/v1/guides/jobs/latest"),
    ("GET", "/api/v1/user/me"),
    ("GET", "/api/v1/diaries/{today}"),
]

ITERATIONS = 100


def percentile(data: list[float], pct: float) -> float:
    sorted_data = sorted(data)
    idx = int(len(sorted_data) * pct / 100)
    idx = min(idx, len(sorted_data) - 1)
    return sorted_data[idx]


def login(client: httpx.Client, base_url: str, email: str, password: str) -> str:
    resp = client.post(
        f"{base_url}/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def measure_endpoint(
    client: httpx.Client,
    base_url: str,
    method: str,
    path: str,
    token: str,
    iterations: int,
) -> list[float]:
    url = f"{base_url}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    latencies: list[float] = []

    for _ in range(iterations):
        start = time.perf_counter()
        try:
            if method == "GET":
                resp = client.get(url, headers=headers)
            else:
                resp = client.post(url, headers=headers, json={})
            _ = resp.status_code
        except httpx.HTTPError:
            pass
        elapsed_ms = (time.perf_counter() - start) * 1000
        latencies.append(elapsed_ms)

    return latencies


def main() -> None:
    parser = argparse.ArgumentParser(description="API P95 Latency 성능 테스트")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API 서버 URL")
    parser.add_argument("--email", required=True, help="테스트 계정 이메일")
    parser.add_argument("--password", required=True, help="테스트 계정 비밀번호")
    parser.add_argument("--iterations", type=int, default=ITERATIONS, help="반복 횟수 (기본: 100)")
    args = parser.parse_args()

    today = date.today().isoformat()

    with httpx.Client(timeout=30.0) as client:
        print(f"로그인 중... ({args.base_url})")
        try:
            token = login(client, args.base_url, args.email, args.password)
        except Exception as e:
            print(f"로그인 실패: {e}")
            sys.exit(1)
        print("로그인 성공\n")

        print(f"{'Endpoint':<50} {'Min':>8} {'Mean':>8} {'P50':>8} {'P95':>8} {'P99':>8} {'Max':>8}")
        print("-" * 108)

        all_pass = True
        for method, path_template in ENDPOINTS:
            path = path_template.replace("{today}", today)
            latencies = measure_endpoint(client, args.base_url, method, path, token, args.iterations)

            min_ms = min(latencies)
            mean_ms = statistics.mean(latencies)
            p50 = percentile(latencies, 50)
            p95 = percentile(latencies, 95)
            p99 = percentile(latencies, 99)
            max_ms = max(latencies)

            pass_fail = "PASS" if p95 < 3000 else "FAIL"
            if p95 >= 3000:
                all_pass = False

            label = f"{method} {path}"
            if len(label) > 48:
                label = label[:48]
            print(
                f"{label:<50} {min_ms:>7.1f} {mean_ms:>7.1f} {p50:>7.1f} "
                f"{p95:>7.1f} {p99:>7.1f} {max_ms:>7.1f}  {pass_fail}"
            )

        print("-" * 108)
        print(f"\n결과: {'ALL PASS — 모든 API P95 < 3초' if all_pass else 'FAIL — P95 > 3초 엔드포인트 존재'}")
        print(f"반복 횟수: {args.iterations}회 / 서버: {args.base_url}")


if __name__ == "__main__":
    main()
