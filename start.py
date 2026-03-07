"""
start.py — UniAdvisor AI
Runs both backend and frontend with a single command.

Usage:  python start.py
Stop:   Press CTRL+C
"""

import subprocess
import sys
import os
import time
import signal
import threading

# ── Colors for terminal output ────────────────────────────
GREEN  = "\033[92m"
BLUE   = "\033[94m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

processes = []

def log(prefix, color, line):
    print(f"{color}{BOLD}[{prefix}]{RESET} {line}", flush=True)

def stream_output(process, prefix, color):
    """Stream output from a subprocess in real time."""
    for line in iter(process.stdout.readline, b""):
        try:
            log(prefix, color, line.decode("utf-8", errors="ignore").rstrip())
        except Exception:
            pass

def shutdown(sig=None, frame=None):
    print(f"\n{YELLOW}{BOLD}Shutting down UniAdvisor AI...{RESET}")
    for p in processes:
        try:
            p.terminate()
        except Exception:
            pass
    print(f"{GREEN}✅ All processes stopped. Goodbye!{RESET}")
    sys.exit(0)

signal.signal(signal.SIGINT,  shutdown)
signal.signal(signal.SIGTERM, shutdown)

def check_requirements():
    """Check that required files exist."""
    missing = []
    for f in ["main.py", "rag.py", "ingest.py", "package.json"]:
        if not os.path.exists(f):
            missing.append(f)
    if missing:
        print(f"{RED}❌ Missing files: {', '.join(missing)}{RESET}")
        print(f"{YELLOW}Make sure you're running this from E:\\school project\\{RESET}")
        sys.exit(1)

    if not os.path.exists(".env"):
        print(f"{YELLOW}⚠️  No .env file found. Create one with your GROQ_API_KEY_1{RESET}")

def main():
    check_requirements()

    print(f"""
{BLUE}{BOLD}╔══════════════════════════════════════╗
║       🎓 UniAdvisor AI               ║
║       Dunaújváros Egyetem            ║
║       Starting all services...       ║
╚══════════════════════════════════════╝{RESET}
""")

    # ── Start Backend ─────────────────────────────────────
    print(f"{GREEN}▶ Starting Backend  (http://localhost:8000){RESET}")
    backend = subprocess.Popen(
        [sys.executable, "main.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=os.getcwd(),
    )
    processes.append(backend)

    # Stream backend logs in background thread
    threading.Thread(
        target=stream_output,
        args=(backend, "BACKEND", GREEN),
        daemon=True
    ).start()

    # Give backend 3 seconds to start before launching frontend
    time.sleep(3)

    # ── Start Frontend ────────────────────────────────────
    print(f"{BLUE}▶ Starting Frontend (http://localhost:3000){RESET}")

    # Use npm.cmd on Windows, npm on Mac/Linux
    npm = "npm.cmd" if sys.platform == "win32" else "npm"

    frontend = subprocess.Popen(
        [npm, "run", "dev"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=os.getcwd(),
    )
    processes.append(frontend)

    # Stream frontend logs in background thread
    threading.Thread(
        target=stream_output,
        args=(frontend, "FRONTEND", BLUE),
        daemon=True
    ).start()

    print(f"""
{BOLD}{'─'*42}
  ✅ UniAdvisor AI is running!
  🌐 Open in browser: http://localhost:3000
  🔧 API docs:        http://localhost:8000/docs
  ⏹  Stop:           Press CTRL+C
{'─'*42}{RESET}
""")

    # Keep running and watch for crashes
    while True:
        time.sleep(2)

        if backend.poll() is not None:
            print(f"{RED}❌ Backend crashed! Restarting...{RESET}")
            backend = subprocess.Popen(
                [sys.executable, "main.py"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=os.getcwd(),
            )
            processes[0] = backend
            threading.Thread(
                target=stream_output,
                args=(backend, "BACKEND", GREEN),
                daemon=True
            ).start()

        if frontend.poll() is not None:
            print(f"{RED}❌ Frontend crashed! Restarting...{RESET}")
            frontend = subprocess.Popen(
                [npm, "run", "dev"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=os.getcwd(),
            )
            processes[1] = frontend
            threading.Thread(
                target=stream_output,
                args=(frontend, "FRONTEND", BLUE),
                daemon=True
            ).start()

if __name__ == "__main__":
    main()