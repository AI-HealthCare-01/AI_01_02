import subprocess
import time

import requests

p = subprocess.Popen(["uv", "run", "uvicorn", "app.main:app", "--port", "8085"])
time.sleep(3)

try:
    routes = requests.get("http://127.0.0.1:8085/api/openapi.json").json()
    paths = list(routes["paths"].keys())
    print("\n\n--- PATHS FOUND ---")
    for path in paths:
        print(path)
finally:
    p.terminate()
