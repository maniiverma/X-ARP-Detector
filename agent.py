# target-pc par run karne ke liye script: agent.py
import sys
import time
import socket
import requests
import psutil

# APNE KALI LINUX BACKEND SERVER KA IP ADDRESS YAHAN INJECT KAREIN
SERVER_URL = "http://10.74.131.202:5000/api/agent-telemetry"

def get_foreground_app():
    """OS native layers ko bypass karke exact active front window ka naam resolve karega"""
    try:
        if sys.platform == "win32":
            import win32gui
            import win32process
            window = win32gui.GetForegroundWindow()
            _, pid = win32process.GetWindowThreadProcessId(window)
            proc = psutil.Process(pid)
            title = win32gui.GetWindowText(window)
            return f"{proc.name()} ({title[:30]})"
        else:
            # Fallback for Linux machines via X11 check internals
            import subprocess
            out = subprocess.check_output(["xdotool", "getwindowfocus", "getwindowname"]).decode("utf-8").strip()
            return out if out else "Terminal Ops"
    except Exception:
        # Emergency backup locator: standard process scanner fallback
        try:
            for proc in psutil.process_iter(['name', 'cpu_percent']):
                if proc.info['name'].lower() in ['chrome', 'firefox', 'msedge', 'code', 'vlc']:
                    return f"{proc.info['name']} (Active Work)"
        except Exception: pass
        return "Idle Desktop Environment"

def main():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        my_ip = s.getsockname()[0]
        s.close()
    except Exception:
        my_ip = "127.0.0.1"

    print(f"[*] Advanced Cyber Agent Online. Targeting core framework: {SERVER_URL}")

    while True:
        try:
            payload = {
                "ip": my_ip,
                "hostname": socket.gethostname(),
                "activeTask": get_foreground_app(),
                "cpu": psutil.cpu_percent(),
                "ram": psutil.virtual_memory().percent
            }
            requests.post(SERVER_URL, json=payload, timeout=2)
        except Exception as e:
            print(f"[-] Transmission delay vector: {e}")
        time.sleep(2)

if __name__ == "__main__":
    main()
