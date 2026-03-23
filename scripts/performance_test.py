"""API P95 Latency 성능 테스트 스크립트.

실행 방법:
  # 순차 테스트 (기본)
  uv run python scripts/performance_test.py --base-url http://localhost:8000 --email test@test.com --password pass123

  # 동시 접속 테스트 (10명 동시, 각 10회)
  uv run python scripts/performance_test.py --base-url http://localhost:8000 --email test@test.com --password pass123 --concurrent 10

출력:
  각 엔드포인트별 Min / Mean / P50 / P95 / P99 / Max 테이블
"""

from __future__ import annotations

import argparse
import asyncio
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
) -> tuple[list[float], int]:
    url = f"{base_url}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    latencies: list[float] = []
    errors = 0

    for _ in range(iterations):
        start = time.perf_counter()
        try:
            if method == "GET":
                resp = client.get(url, headers=headers)
            else:
                resp = client.post(url, headers=headers, json={})
            if resp.status_code >= 400:
                errors += 1
        except httpx.HTTPError:
            errors += 1
        elapsed_ms = (time.perf_counter() - start) * 1000
        latencies.append(elapsed_ms)

    return latencies, errors


async def _async_request(
    client: httpx.AsyncClient,
    url: str,
    method: str,
    headers: dict[str, str],
) -> tuple[float, bool]:
    """단일 비동기 요청 → (레이턴시 ms, 에러 여부) 반환."""
    start = time.perf_counter()
    is_error = False
    try:
        if method == "GET":
            resp = await client.get(url, headers=headers)
        else:
            resp = await client.post(url, headers=headers, json={})
        if resp.status_code >= 400:
            is_error = True
    except httpx.HTTPError:
        is_error = True
    return (time.perf_counter() - start) * 1000, is_error


async def measure_endpoint_concurrent(
    base_url: str,
    method: str,
    path: str,
    token: str,
    concurrent: int,
    iterations_per_user: int,
) -> tuple[list[float], int]:
    """동시 접속 성능 측정: concurrent명이 각 iterations_per_user회 요청."""
    url = f"{base_url}{path}"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=30.0) as client:

        async def _worker() -> list[tuple[float, bool]]:
            results = []
            for _ in range(iterations_per_user):
                results.append(await _async_request(client, url, method, headers))
            return results

        worker_results = await asyncio.gather(*[_worker() for _ in range(concurrent)])

    all_latencies: list[float] = []
    errors = 0
    for worker in worker_results:
        for ms, is_err in worker:
            all_latencies.append(ms)
            if is_err:
                errors += 1
    return all_latencies, errors


def run_sequential(args: argparse.Namespace, today: str) -> bool:
    """순차 테스트 실행."""
    with httpx.Client(timeout=30.0) as client:
        print(f"로그인 중... ({args.base_url})")
        try:
            token = login(client, args.base_url, args.email, args.password)
        except Exception as e:
            print(f"로그인 실패: {e}")
            sys.exit(1)
        print("로그인 성공\n")

        print(f"[순차 테스트] iterations={args.iterations}")
        print(f"{'Endpoint':<50} {'Min':>8} {'Mean':>8} {'P50':>8} {'P95':>8} {'P99':>8} {'Max':>8} {'Err':>5}")
        print("-" * 115)

        all_pass = True
        for method, path_template in ENDPOINTS:
            path = path_template.replace("{today}", today)
            latencies, errors = measure_endpoint(client, args.base_url, method, path, token, args.iterations)

            min_ms = min(latencies)
            mean_ms = statistics.mean(latencies)
            p50 = percentile(latencies, 50)
            p95 = percentile(latencies, 95)
            p99 = percentile(latencies, 99)
            max_ms = max(latencies)

            pass_fail = "PASS" if p95 < 3000 and errors == 0 else "FAIL"
            if pass_fail == "FAIL":
                all_pass = False

            label = f"{method} {path}"
            if len(label) > 48:
                label = label[:48]
            print(
                f"{label:<50} {min_ms:>7.1f} {mean_ms:>7.1f} {p50:>7.1f} "
                f"{p95:>7.1f} {p99:>7.1f} {max_ms:>7.1f}  {errors:>4}  {pass_fail}"
            )

        print("-" * 115)
        print(f"\n결과: {'ALL PASS — 모든 API P95 < 3초' if all_pass else 'FAIL — P95 > 3초 엔드포인트 존재'}")
        print(f"반복 횟수: {args.iterations}회 / 서버: {args.base_url}")
        return all_pass


def run_concurrent(args: argparse.Namespace, today: str) -> bool:
    """동시 접속 테스트 실행."""
    with httpx.Client(timeout=30.0) as client:
        print(f"로그인 중... ({args.base_url})")
        try:
            token = login(client, args.base_url, args.email, args.password)
        except Exception as e:
            print(f"로그인 실패: {e}")
            sys.exit(1)
        print("로그인 성공\n")

    iterations_per_user = max(1, args.iterations // args.concurrent)
    total_requests = args.concurrent * iterations_per_user

    print(
        f"[동시 접속 테스트] concurrent={args.concurrent}, iterations_per_user={iterations_per_user}, total={total_requests}"
    )
    print(f"{'Endpoint':<50} {'Min':>8} {'Mean':>8} {'P50':>8} {'P95':>8} {'P99':>8} {'Max':>8}")
    print("-" * 115)

    all_pass = True
    for method, path_template in ENDPOINTS:
        path = path_template.replace("{today}", today)
        latencies, errors = asyncio.run(
            measure_endpoint_concurrent(args.base_url, method, path, token, args.concurrent, iterations_per_user)
        )

        if not latencies:
            continue

        min_ms = min(latencies)
        mean_ms = statistics.mean(latencies)
        p50 = percentile(latencies, 50)
        p95 = percentile(latencies, 95)
        p99 = percentile(latencies, 99)
        max_ms = max(latencies)

        pass_fail = "PASS" if p95 < 3000 and errors == 0 else "FAIL"
        if pass_fail == "FAIL":
            all_pass = False

        label = f"{method} {path}"
        if len(label) > 48:
            label = label[:48]
        print(
            f"{label:<50} {min_ms:>7.1f} {mean_ms:>7.1f} {p50:>7.1f} "
            f"{p95:>7.1f} {p99:>7.1f} {max_ms:>7.1f}  {errors:>4}  {pass_fail}"
        )

    print("-" * 115)
    print(f"\n결과: {'ALL PASS — 모든 API P95 < 3초' if all_pass else 'FAIL — P95 > 3초 엔드포인트 존재'}")
    print(f"동시 접속: {args.concurrent}명 × {iterations_per_user}회 = {total_requests}건 / 서버: {args.base_url}")
    return all_pass


def main() -> None:
    parser = argparse.ArgumentParser(description="API P95 Latency 성능 테스트")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API 서버 URL")
    parser.add_argument("--email", required=True, help="테스트 계정 이메일")
    parser.add_argument("--password", required=True, help="테스트 계정 비밀번호")
    parser.add_argument("--iterations", type=int, default=ITERATIONS, help="반복 횟수 (기본: 100)")
    parser.add_argument("--concurrent", type=int, default=0, help="동시 접속 수 (0=순차, N=동시 N명)")
    args = parser.parse_args()

    today = date.today().isoformat()

    if args.concurrent > 0:
        run_concurrent(args, today)
    else:
        run_sequential(args, today)


if __name__ == "__main__":
    main()
