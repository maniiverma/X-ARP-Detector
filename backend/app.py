# ====================================================================
# X-ARP DEFENSOR — INTEGRATED SOC CORES MODULES v3.0
# Multi-threaded SOC Core | Flask + SocketIO + Scapy + ChatOps
# ====================================================================

import os
import sys
import json
import time
import sqlite3
import threading
import subprocess
import ipaddress
import logging
import requests
from datetime import datetime
from collections import defaultdict

# ── Logging Setup ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s — %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('xarp_defensor.log')
    ]
)
log = logging.getLogger('XARP')

# ── Root Privilege Check ─────────────────────────────────────────────
if os.geteuid() != 0:
    log.error("Root privileges required. Run: sudo python3 app.py")
    sys.exit(1)

# ── Dependency Imports with Verification Arrays ──────────────────────
try:
    from flask import Flask, jsonify, request
    from flask_cors import CORS
    from flask_socketio import SocketIO
except ImportError as e:
    log.error(f"Missing Flask dependencies: {e}")
    log.error("Fix: pip install flask flask-cors flask-socketio")
    sys.exit(1)

try:
    from scapy.all import sniff, ARP, Ether, srp, conf as scapy_conf
    scapy_conf.verb = 0  # Suppress internal scapy debugging verbose output
except ImportError:
    log.error("Scapy framework not installed. Fix: pip install scapy")
    sys.exit(1)

# ── App Initialization ───────────────────────────────────────────────
app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(32).hex()
CORS(app, resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    ping_timeout=20,
    ping_interval=10,
    logger=False,
    engineio_logger=False
)

# ── Operational Configuration Variables ──────────────────────────────
DB_PATH            = "xarp_vault.db"
INTERFACE          = os.environ.get("XARP_IFACE", "wlan0")   # Target interface lock
RATE_LIMIT_WINDOW  = 5     # seconds — suppress duplicate alerts per IP context
WHITELIST_FILE     = "whitelist.json"
CHATOPS_FILE       = "chatops.json"

# ── State Containers (Thread-safe via structural context lock) ───────
_lock                  = threading.Lock()
trusted_baseline       = {}      # ip -> mac
active_endpoints       = {}      # ip -> telemetry data mapping dictionary
blocked_macs           = set()   # MAC flags active drop configurations
blocked_ips            = set()   # IP targets blocks tracking
whitelist_macs         = set()   # Whitelist targets hardware drops exemption
whitelist_ips          = set()   # Exception IP address arrays
auto_mitigation        = False
anti_poisoning         = False
_alert_rate_cache      = defaultdict(float)  # ip -> last_alert_time index tracking
_pps_counter           = 0       # metrics packets throughput tracking metrics
_pps_lock              = threading.Lock()
_chatops_config        = {"discord_url": "", "telegram_token": "", "telegram_chat": ""}


# ════════════════════════════════════════════════════════════════════
# DATABASE FRAMEWORK PERSISTENCE
# ════════════════════════════════════════════════════════════════════

def db_connect():
    """Returns a thread-safe SQLite connection abstraction layer."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # Concurrent execution pipelines optimized
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn

def init_database():
    with db_connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS incidents (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp    TEXT    NOT NULL,
                ip           TEXT    NOT NULL,
                legit_mac    TEXT    NOT NULL,
                attacker_mac TEXT    NOT NULL,
                severity     TEXT    DEFAULT 'CRITICAL',
                status       TEXT    DEFAULT 'FLAGGED'
            );

            CREATE TABLE IF NOT EXISTS firewall_rules (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp    TEXT    NOT NULL,
                target       TEXT    NOT NULL,
                mode         TEXT    NOT NULL,
                action       TEXT    NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_incidents_ip ON incidents(ip);
            CREATE INDEX IF NOT EXISTS idx_incidents_ts ON incidents(timestamp);
        """)
    log.info("Database initialized persistently: %s", DB_PATH)


# ════════════════════════════════════════════════════════════════════
# SYSTEM PERSISTENCE UTILITIES
# ════════════════════════════════════════════════════════════════════

def load_whitelist():
    global whitelist_macs, whitelist_ips
    if os.path.exists(WHITELIST_FILE):
        try:
            with open(WHITELIST_FILE) as f:
                data = json.load(f)
            whitelist_macs = set(m.lower() for m in data.get("macs", []))
            whitelist_ips  = set(data.get("ips", []))
            log.info("Whitelist parameters synchronized: %d MACs, %d IPs", len(whitelist_macs), len(whitelist_ips))
        except Exception as e:
            log.warning("Whitelist loading exception parameter dropped: %s", e)

def save_whitelist():
    with open(WHITELIST_FILE, "w") as f:
        json.dump({"macs": list(whitelist_macs), "ips": list(whitelist_ips)}, f, indent=2)

def load_chatops():
    global _chatops_config
    if os.path.exists(CHATOPS_FILE):
        try:
            with open(CHATOPS_FILE) as f:
                _chatops_config.update(json.load(f))
            log.info("ChatOps automation API parameters initialized.")
        except Exception as e:
            log.warning("ChatOps initialization error configuration warning: %s", e)

def save_chatops():
    with open(CHATOPS_FILE, "w") as f:
        json.dump(_chatops_config, f, indent=2)


# ════════════════════════════════════════════════════════════════════
# CHATOPS OFFSITE NOTIFICATION CHANNELS PIPELINES
# ════════════════════════════════════════════════════════════════════

def dispatch_chatops_alerts(ip, legit_mac, attacker_mac):
    """Dispatches asynchronous notification alerts over API hooks."""
    with _lock:
        discord_url = _chatops_config.get("discord_url", "")
        tg_token = _chatops_config.get("telegram_token", "")
        tg_chat = _chatops_config.get("telegram_chat", "")

    message_string = (
        f"🚨 [X-ARP SECURITY ALERT]\n"
        f"Intrusion Vector Signature: Layer-2 ARP Spoofing Attack Caught!\n"
        f"Attacker Host IP Target: {ip}\n"
        f"Rogue Attacker Hardware MAC: {attacker_mac.upper()}\n"
        f"Legitimate Gateway Baseline MAC: {legit_mac.upper()}\n"
        f"System Status Action Blocked: {'ISOLATED & PACKET DROP APPLIED' if auto_mitigation else 'FLAGGED & INVESTIGATING'}"
    )

    # Dispatch via Discord Webhook Pipeline
    if discord_url:
        try:
            payload = {"content": message_string}
            requests.post(discord_url, json=payload, timeout=3)
        except Exception as ex:
            log.error("Discord offsite delivery timeout exception: %s", ex)

    # Dispatch via Telegram Messaging Core Bot API
    if tg_token and tg_chat:
        try:
            target_tg_endpoint = f"https://api.telegram.org/bot{tg_token}/sendMessage"
            payload = {"chat_id": tg_chat, "text": message_string}
            requests.post(target_tg_endpoint, json=payload, timeout=3)
        except Exception as ex:
            log.error("Telegram API endpoint packet routing exception: %s", ex)


# ════════════════════════════════════════════════════════════════════
# NETWORK BASELINE STRUCTURAL INTERFACING
# ════════════════════════════════════════════════════════════════════

def detect_local_subnet():
    """Auto-detects active subnet parameters from the adapter runtime state."""
    try:
        result = subprocess.check_output(
            ["ip", "-4", "addr", "show", INTERFACE],
            stderr=subprocess.DEVNULL
        ).decode()
        for line in result.splitlines():
            line = line.strip()
            if line.startswith("inet "):
                cidr = line.split()[1]
                network = ipaddress.IPv4Network(cidr, strict=False)
                return str(network)
    except Exception as e:
        log.warning("Subnet query mapping execution dropped: %s — falling back to 10.74.131.0/24", e)
    return "10.74.131.0/24"

def build_network_baseline():
    """ARP sweeps the subnet mapping system interfaces dynamically into trusted lists."""
    global trusted_baseline
    subnet = detect_local_subnet()
    log.info("Starting sub-layer mapping architecture ARP sweep on target: %s ...", subnet)
    try:
        answered, _ = srp(
            Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=subnet),
            iface=INTERFACE, timeout=3, verbose=0
        )
        with _lock:
            for sent, recv in answered:
                ip  = recv[ARP].psrc
                mac = recv[ARP].hwsrc.lower()
                trusted_baseline[ip] = mac
        log.info("Trusted layer security network state baseline compiled: %d hosts locked.", len(trusted_baseline))
    except Exception as e:
        log.error("ARP scanning error exception code: %s", e)


# ════════════════════════════════════════════════════════════════════
# CORE FIREWALL MITIGATION PIPELINE (iptables Integration)
# ════════════════════════════════════════════════════════════════════

def _run(cmd, check=False):
    try:
        subprocess.run(cmd, shell=True, check=check,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError as e:
        log.error("Core command routing error system failure [%s]: %s", cmd, e)
        return False

def firewall_block_mac(mac):
    if mac.lower() in whitelist_macs:
        log.info("Target device hardware signature whitelisted. Skipping drops: %s", mac)
        return False
    success = _run(f"iptables -C INPUT -m mac --mac-source {mac} -j DROP 2>/dev/null || "
                   f"iptables -A INPUT -m mac --mac-source {mac} -j DROP")
    if success:
        with _lock:
            blocked_macs.add(mac.lower())
        _log_firewall_rule(mac, "mac", "block")
        log.info("Linux kernel dropping rule injected successfully for hardware identifier: %s", mac)
    return success

def firewall_unblock_mac(mac):
    _run(f"iptables -D INPUT -m mac --mac-source {mac} -j DROP")
    with _lock:
        blocked_macs.discard(mac.lower())
    _log_firewall_rule(mac, "mac", "unblock")
    log.info("Isolation policy flushed for target hardware signature: %s", mac)
    return True

def firewall_block_ip(ip):
    if ip in whitelist_ips:
        log.info("Target routing identity whitelisted. Skipping drops: %s", ip)
        return False
    success = _run(f"iptables -C INPUT -s {ip} -j DROP 2>/dev/null || "
                   f"iptables -A INPUT -s {ip} -j DROP")
    if success:
        with _lock:
            blocked_ips.add(ip)
        _log_firewall_rule(ip, "ip", "block")
        log.info("Linux network boundary dropped security block applied to target IP: %s", ip)
    return success

def firewall_unblock_ip(ip):
    _run(f"iptables -D INPUT -s {ip} -j DROP")
    with _lock:
        blocked_ips.discard(ip)
    _log_firewall_rule(ip, "ip", "unblock")
    log.info("Isolation routing rules flushed for target node IP: %s", ip)
    return True

def _log_firewall_rule(target, mode, action):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with db_connect() as conn:
        conn.execute(
            "INSERT INTO firewall_rules (timestamp, target, mode, action) VALUES (?,?,?,?)",
            (ts, target, mode, action)
        )


# ════════════════════════════════════════════════════════════════════
# CORE DEFENSE RECOVERY ENGINE (Gratuitous ARP Injection)
# ════════════════════════════════════════════════════════════════════

def send_arp_correction(ip, real_mac):
    """Forces active automated mitigation packets to reverse active poisoning vectors."""
    try:
        from scapy.all import sendp, ARP, Ether
        pkt = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(
            op=2, pdst="255.255.255.255",
            psrc=ip, hwsrc=real_mac
        )
        sendp(pkt, iface=INTERFACE, count=3, verbose=0)
        log.info("Recovery framework baseline correction cache burst dispatched: %s → %s", ip, real_mac)
    except Exception as e:
        log.error("Active injection layer drop error: %s", e)


# ════════════════════════════════════════════════════════════════════
# THREAT DETECTION MATRIX CORE PROCESSOR
# ════════════════════════════════════════════════════════════════════

def process_packet(packet):
    global _pps_counter
    with _pps_lock:
        _pps_counter += 1

    if not (packet.haslayer(ARP) and packet[ARP].op == 2):
        return

    src_ip  = packet[ARP].psrc
    src_mac = packet[ARP].hwsrc.lower()

    with _lock:
        baseline_copy = dict(trusted_baseline)
        wl_macs = set(whitelist_macs)
        wl_ips  = set(whitelist_ips)

    # Exemption validations rules enforcement
    if src_ip in wl_ips or src_mac in wl_macs:
        return

    if src_ip not in baseline_copy:
        with _lock:
            trusted_baseline[src_ip] = src_mac
        return

    legit_mac = baseline_copy[src_ip]
    if src_mac == legit_mac:
        return  # Package authenticated cleanly 

    # ── SPOOFING ATTACK TRACKED TRACE LAYER ───────────────────────────
    now = time.time()
    if now - _alert_rate_cache[src_ip] < RATE_LIMIT_WINDOW:
        return  # Throttled routing duplicate alert validation constraints
    _alert_rate_cache[src_ip] = now

    status = "CONTAINED" if auto_mitigation else "FLAGGED"
    log.warning("ARP POISONING ATTEMPT CAPTURED: %s mapping to %s (True Baseline: %s) → Mitigation: %s", 
                src_ip, src_mac, legit_mac, status)

    if auto_mitigation:
        firewall_block_mac(src_mac)
        firewall_block_ip(src_ip)

    if anti_poisoning:
        threading.Thread(target=send_arp_correction, args=(src_ip, legit_mac), daemon=True).start()

    # Trigger asynchronous out-of-band ChatOps routing thread
    threading.Thread(target=dispatch_chatops_alerts, args=(src_ip, legit_mac, src_mac), daemon=True).start()

    _save_and_broadcast_incident(src_ip, legit_mac, src_mac, status)

def _save_and_broadcast_incident(ip, legit_mac, attacker_mac, status):
    ts = datetime.now().strftime("%H:%M:%S")
    with db_connect() as conn:
        cur = conn.execute(
            "INSERT INTO incidents (timestamp, ip, legit_mac, attacker_mac, severity, status) VALUES (?,?,?,?,?,?)",
            (ts, ip, legit_mac, attacker_mac, "CRITICAL", status)
        )
        incident_id = cur.lastrowid

    # Synced fields explicitly with React camelCase naming parameters map expectations
    payload = {
        "id": incident_id, "timestamp": ts, "ip": ip,
        "legitMac": legit_mac, "attackerMac": attacker_mac,
        "threatLevel": "CRITICAL", "status": status
    }
    socketio.emit("arp_alert_stream", payload)

def packet_sniffer_daemon():
    log.info("Threat raw packet capture worker daemon linked onto adapter interface: %s", INTERFACE)
    while True:
        try:
            sniff(iface=INTERFACE, filter="arp", prn=process_packet, store=0)
        except Exception as e:
            log.error("Network interface listener dropped: %s — recovering socket loop in 3s", e)
            time.sleep(3)


# ════════════════════════════════════════════════════════════════════
# CORE ANALYTICS BROADCASTER
# ════════════════════════════════════════════════════════════════════

def pps_metrics_broadcaster():
    """Emits packet velocity metrics coordinates arrays data streams down onto interface HUD."""
    global _pps_counter
    while True:
        time.sleep(1)
        with _pps_lock:
            count = _pps_counter
            _pps_counter = 0
        socketio.emit("graph_metrics_stream", {"pps": count, "ts": time.time()})


# ════════════════════════════════════════════════════════════════════
# SYSTEM CONTROLLER API INTERFACE
# ════════════════════════════════════════════════════════════════════

def _get_history():
    with db_connect() as conn:
        rows = conn.execute(
            "SELECT id, timestamp, ip, legit_mac, attacker_mac, severity, status "
            "FROM incidents ORDER BY id DESC LIMIT 200"
        ).fetchall()
    return [dict(r) for r in rows]

def _get_network_map():
    with _lock:
        nodes = []
        for ip, mac in trusted_baseline.items():
            ep = active_endpoints.get(ip, {})
            is_blocked = ip in blocked_ips or mac.lower() in blocked_macs
            nodes.append({
                "ip": ip, "mac": mac,
                "status": "BLOCKED" if is_blocked else ep.get("status", "ONLINE"),
                "activeTasks": ep.get("activeWindow", "Idle Context Shell"),
                "performance": (
                    f"CPU {ep['cpuLoad']:.0f}%  RAM {ep['ramAllocation']:.0f}%"
                    if ep else "Awaiting Agent Enrollment Sync"
                ),
                "lastSeen": ep.get("lastSeen", "—"),
            })
    return nodes


@app.route('/api/stats', methods=['GET'])
def api_stats():
    with _lock:
        b_macs = list(blocked_macs)
        b_ips  = list(blocked_ips)
        wl_count = len(whitelist_macs) + len(whitelist_ips)
        device_count = len(trusted_baseline)

    history = _get_history()
    # Explicit transformation matrices formatting to clean mapping array records down to React states expectations
    mapped = [{
        "id":           h["id"],
        "timestamp":    h["timestamp"],
        "ip":           h["ip"],
        "legitMac":     h["legit_mac"],
        "attackerMac":  h["attacker_mac"],
        "threatLevel":  h["severity"],
        "status":       h["status"],
    } for h in history]

    return jsonify({
        "monitoredDevices": device_count,
        "whitelistCount":   wl_count,
        "autoMitigation":   auto_mitigation,
        "antiPoisoning":    anti_poisoning,
        "networkMap":       _get_network_map(),
        "blockedMacs":      b_macs,
        "blockedIps":       b_ips,
        "history":          mapped,
        "subnetMask":       detect_local_subnet().split("/")[1] if "/" in detect_local_subnet() else "24",
        "chatops":          _chatops_config,
        "interface":        INTERFACE,
    })


@app.route('/api/toggle-feature', methods=['POST'])
def api_toggle_feature():
    global auto_mitigation, anti_poisoning
    data = request.get_json(silent=True) or {}
    feature = data.get("feature", "")
    state = False
    with _lock:
        if feature == "autoMitigation":
            auto_mitigation = not auto_mitigation
            state = auto_mitigation
        elif feature == "antiPoisoning":
            anti_poisoning = not anti_poisoning
            state = anti_poisoning
        else:
            return jsonify({"error": f"Unknown target subsystem: {feature}"}), 400
    log.info("Subsystem operational status changed parameter: %s → %s", feature, state)
    return jsonify({"feature": feature, "state": state})


@app.route('/api/mitigate', methods=['POST'])
def api_mitigate():
    data = request.get_json(silent=True) or {}
    target = data.get("target", "").strip()
    mode   = data.get("mode", "mac").strip()
    action = data.get("action", "block").strip()

    if not target:
        return jsonify({"error": "Missing dynamic target constraint identifier"}), 400
    if mode not in ("mac", "ip"):
        return jsonify({"error": "Target mapping selection invalid structure"}), 400
    if action not in ("block", "unblock"):
        return jsonify({"error": "Action pipeline mode matrix invalid specification"}), 400

    if mode == "mac":
        ok = firewall_block_mac(target) if action == "block" else firewall_unblock_mac(target)
    else:
        ok = firewall_block_ip(target) if action == "block" else firewall_unblock_ip(target)

    return jsonify({"ok": ok, "target": target, "mode": mode, "action": action})


@app.route('/api/whitelist', methods=['GET'])
def api_whitelist_get():
    with _lock:
        return jsonify({"macs": list(whitelist_macs), "ips": list(whitelist_ips)})

@app.route('/api/whitelist', methods=['POST'])
def api_whitelist_add():
    data = request.get_json(silent=True) or {}
    mac = data.get("mac", "").lower().strip()
    ip  = data.get("ip", "").strip()
    with _lock:
        if mac: whitelist_macs.add(mac)
        if ip:  whitelist_ips.add(ip)
    save_whitelist()
    return jsonify({"ok": True})

@app.route('/api/whitelist', methods=['DELETE'])
def api_whitelist_remove():
    data = request.get_json(silent=True) or {}
    mac = data.get("mac", "").lower().strip()
    ip  = data.get("ip", "").strip()
    with _lock:
        whitelist_macs.discard(mac)
        whitelist_ips.discard(ip)
    save_whitelist()
    return jsonify({"ok": True})


@app.route('/api/configure-chatops', methods=['POST'])
def api_configure_chatops():
    global _chatops_config
    data = request.get_json(silent=True) or {}
    with _lock:
        _chatops_config.update({
            "discord_url":     data.get("discord_url", ""),
            "telegram_token":  data.get("telegram_token", ""),
            "telegram_chat":   data.get("telegram_chat", ""),
        })
    save_chatops()
    log.info("ChatOps operational communication credentials saved successfully.")
    return jsonify({"ok": True})


@app.route('/api/agent-telemetry', methods=['POST'])
def api_agent_telemetry():
    data   = request.get_json(silent=True) or {}
    client = request.remote_addr
    with _lock:
        active_endpoints[client] = {
            "ip":             client,
            "mac":            trusted_baseline.get(client, "—"),
            "status":         "ONLINE",
            "activeWindow":   data.get("activeWindow", "Idle Managed Session Workspace"),
            "cpuLoad":        float(data.get("cpuLoad", 0)),
            "ramAllocation":  float(data.get("ramAllocation", 0)),
            "lastSeen":       datetime.now().strftime("%H:%M:%S"),
        }
    socketio.emit("agent_registry_update", {"ip": client})
    return jsonify({"status": "ok"})


@app.route('/api/baseline/refresh', methods=['POST'])
def api_baseline_refresh():
    threading.Thread(target=build_network_baseline, daemon=True).start()
    return jsonify({"ok": True, "message": "Baseline generation sweep triggered"})


@app.route('/api/incidents', methods=['GET'])
def api_incidents():
    return jsonify(_get_history())


@app.route('/api/incidents/clear', methods=['DELETE'])
def api_incidents_clear():
    with db_connect() as conn:
        conn.execute("DELETE FROM incidents")
    log.info("Forensic databank logs cleared out successfully.")
    return jsonify({"ok": True})


@app.route('/api/health', methods=['GET'])
def api_health():
    return jsonify({
        "status": "online",
        "interface": INTERFACE,
        "auto_mitigation": auto_mitigation,
        "anti_poisoning": anti_poisoning,
        "baseline_hosts": len(trusted_baseline),
        "blocked_macs": len(blocked_macs),
        "blocked_ips": len(blocked_ips),
        "time": datetime.now().isoformat(),
    })


# ── SocketIO Core Events ──────────────────────────────────────────────

@socketio.on('connect')
def on_connect():
    log.info("Frontend terminal session mapped securely: %s", request.sid)

@socketio.on('disconnect')
def on_disconnect():
    log.info("Frontend link terminated channel: %s", request.sid)

@socketio.on('toggle_ips')
def on_toggle_ips(data):
    global auto_mitigation
    with _lock:
        auto_mitigation = bool(data.get("enabled", False))
    log.info("IPS operational mitigation matrix toggled via socket: %s", auto_mitigation)


# ════════════════════════════════════════════════════════════════════
# OPERATIONAL COMMAND ENTRY ENGINE STARTUP
# ════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("""
╔═══════════════════════════════════════════════════════╗
║       X-ARP DEFENSOR — SOC CORE ENGINE v3.0           ║
║       ARP Spoofing Detection & Mitigation Suite       ║
╚═══════════════════════════════════════════════════════╝
""")

    # Verify adapter interface constraints visibility boundaries
    interfaces = os.listdir('/sys/class/net/')
    if INTERFACE not in interfaces:
        log.warning("Interface connection checkpoint signature '%s' missing. Available descriptors: %s", INTERFACE, interfaces)
        log.warning("Override target configuration before run: XARP_IFACE=wlan0 sudo python3 app.py")

    init_database()
    load_whitelist()
    load_chatops()

    # Launch background operational processing worker matrices loops threads
    threading.Thread(target=build_network_baseline, daemon=True).start()
    threading.Thread(target=packet_sniffer_daemon, daemon=True).start()
    threading.Thread(target=pps_metrics_broadcaster, daemon=True).start()

    log.info("Central SecOps API engine securely bound to address context: 0.0.0.0:5000")
    log.info("Forensic integrity verification route target: http://localhost:5000/api/health")

    try:
        socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        log.info("System operational termination instruction context caught. Exiting cleanly.")
        sys.exit(0)
