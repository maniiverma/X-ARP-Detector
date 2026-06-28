#!/usr/bin/env bash
# ================================================================
# X-ARP DEFENSOR — SETUP & LAUNCH SCRIPT
# Run: sudo bash start.sh [interface]
# ================================================================

set -e

IFACE="${1:-}"   # first arg = interface, e.g. sudo bash start.sh wlan0

echo "╔══════════════════════════════════════════════╗"
echo "║   X-ARP DEFENSOR — SETUP & LAUNCH v3.0       ║"
echo "╚══════════════════════════════════════════════╝"

# ── Root check ──────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "[!] This script must be run as root."
  echo "    Usage: sudo bash start.sh [interface]"
  exit 1
fi

# ── Python check ────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "[!] python3 not found. Install it first."
  exit 1
fi

PY=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "[+] Python $PY detected"

# ── pip install ─────────────────────────────────────────────────
echo "[*] Installing Python dependencies..."
pip3 install -q -r requirements.txt
echo "[+] Dependencies installed."

# ── Detect active interface if not provided ──────────────────────
if [ -z "$IFACE" ]; then
  # Pick the first interface that has a default route
  IFACE=$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')
  if [ -z "$IFACE" ]; then
    # Fallback: first non-loopback interface
    IFACE=$(ls /sys/class/net/ | grep -v lo | head -1)
  fi
fi

if [ -z "$IFACE" ]; then
  echo "[!] Could not detect network interface. Specify one:"
  ls /sys/class/net/
  echo "    Usage: sudo bash start.sh <interface>"
  exit 1
fi

echo "[+] Using interface: $IFACE"

# ── iptables check ───────────────────────────────────────────────
if ! command -v iptables &>/dev/null; then
  echo "[!] iptables not found. Install: apt install iptables"
  echo "    Mitigation features will be disabled."
else
  echo "[+] iptables available."
fi

# ── Launch ───────────────────────────────────────────────────────
echo ""
echo "[*] Starting X-ARP DEFENSOR on interface '$IFACE' ..."
echo "[*] API → http://0.0.0.0:5000"
echo "[*] Health → http://localhost:5000/api/health"
echo ""

export XARP_IFACE="$IFACE"
exec python3 app.py
