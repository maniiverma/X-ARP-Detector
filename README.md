# ╔══════════════════════════════════════════════════════════════════╗
# ║                 PROJECT: X-ARP DEFENSOR v3.0                     ║
# ║  Enterprise-Grade Multi-Layer ARP Spoofing Prevention & SOC      ║
# ╚══════════════════════════════════════════════════════════════════╝

X-ARP Defensor is a multi-layered, production-grade cybersecurity intelligence platform engineered for real-time Layer-2 network threat monitoring, deterministic vulnerability mitigation, and active digital infrastructure protection. 

The system leverages an event-driven, non-blocking kernel architecture combining low-level hardware raw-packet sniffing with user-space agent telemetry to enforce a strict Zero-Trust model across local subnets.

---

## 🛠️ System Architecture & Data Flow

The ecosystem is structurally separated into three decoupled operational components:


```

```
                  [ TARGET DEVICE ] (Windows/Linux Node)
                          │
                          ▼ (Streams active win32 app/psutil usage)
                   [ agent.py Payload ] 
                          │
                          ▼ Asynchronous JSON Payload via HTTP POST
                          │

```

┌──────────────────────────┴──────────────────────────┐
│                                                     │
▼ Layer-2 Raw Sniffing (Scapy)                        ▼ REST API Ports & WebSockets
┌────────────────────────────────────────────────────────────────────────────────┐
│                           app.py (Kali Linux Central Brain)                    │
│  - Deterministic Parsing   - SQLite WAL Forensics   - Netfilter (iptables) Core│
└────────────────────────────────────────────────────────────────────────────────┘
│
▼ Bidirectional Low-Latency Socket.io Tunnel
│
[ App.jsx React Console ] (Vite HUD UI)

```

1. **Central Brain Backend (`app.py`):** Runs on the security administrator's machine (Kali Linux Server). Utilizes the `Scapy` framework to hook directly onto Layer-2 raw packet drivers, tracking ARP operations (`OP=2`) against a persistent memory baseline.
2. **Endpoint Spy Payload (`agent.py`):** Deployed cross-platform on target nodes. Uses native Win32/Linux binds and `psutil` to sample target active foreground application handles and hardware cycle capacities.
3. **SOC Command Console HUD (`App.jsx`):** A high-fidelity frontend designed with dark cosmic glassmorphism themes, offering low-latency WebSocket visual charting and absolute mitigation controls.

---

## 🔥 Enterprise Features

* **Deterministic Threat Ingestion Engine:** Microsecond processing loops flag Man-in-the-Middle (MITM) redirection vectors the moment a rogue MAC attempts entry spoofing.
* **Autonomous Kernel Isolation (IPS):** Directly injects netfilter system blocks to drop malicious operational streams instantly using native Linux `iptables` hooks.
* **Active Defense Mitigation:** Deploys a Gratuitous ARP auto-correction engine to force-broadcast legitimate subnet baseline state configurations back to targets.
* **Out-of-Band ChatOps Pipelines:** Integration layers dispatch immediate high-severity notifications directly over offsite Discord and Telegram API gateways.
* **Zero-Trust Analytics Layer:** Cross-checks active window titles on endpoints to capture early unauthorized penetration tools execution loops (e.g. Wireshark, NetCut).

---

## 📁 Repository Directory Structure & Upload Mapping

To maintain professional continuous integration frameworks and prevent cross-platform compilation drift, follow this explicit directory configuration layout:

```text
arp-spoof-guard/
├── backend/
│   ├── app.py                <-- Core Backend Command Engine (UPLOAD)
│   ├── agent.py              <-- Endpoint Telemetry Spy Payload (UPLOAD)
│   ├── xarp_vault.db         <-- Local Forensic SQLite Database (IGNORE)
│   └── xarp_env/             <-- Python Virtual Environment (IGNORE)
└── frontend/
    ├── package.json          <-- Declarative Node Dependency Manifest (UPLOAD)
    ├── vite.config.js        <-- Vite Compiler Rules (UPLOAD)
    ├── src/
    │   ├── main.jsx          <-- DOM Mounting Primitive (UPLOAD)
    │   └── App.jsx           <-- React SOC Visual Viewport Console (UPLOAD)
    └── node_modules/         <-- Heavy Third-Party Binary Directory (IGNORE)

```

> ⚠️ **CRITICAL DEPLOYMENT GUARDRAIL:** Third-party binary artifacts (`node_modules/`, `xarp_env/`) and dynamic logs/vault paths (`.db`, `.log`) **MUST NEVER** be committed to GitHub. They trigger compilation conflicts across network nodes.

To enforce this architecture boundary automatically, ensure your `.gitignore` file includes:

```text
node_modules/
xarp_env/
*.db
*.db-wal
*.db-shm
*.log
.DS_Store

```

---

## 🚀 Execution & Environment Provisioning

### 1. Server-Side Infrastructure Activation (app.py)

Deploy your dependencies globally onto the native kernel space, skipping Debian packet restrictions by anchoring explicitly onto fixed versions:

```bash
# Clean historical mismatched packages
sudo pip3 uninstall -y flask-socketio python-socketio python-engineio flask werkzeug

# Provision strict compatible dependency layer
sudo pip3 install flask==2.3.3 werkzeug==2.3.8 flask-cors flask-socketio scapy requests --break-system-packages

# Fire the backend central command engine securely
sudo python3 app.py

```

*Verification Endpoint:* Audit telemetry parameters at `http://localhost:5000/api/health`.

### 2. Frontend SOC Interface Initialization (App.jsx)

Reconstitute a deterministic local workspace dynamically using the declarative `package.json` manifest:

```bash
cd frontend

# Generate machine-optimized package modules cleanly
npm install

# Deploy Vite hot-module reload web development loop
npm run dev

```

*Console Access:* Open `http://localhost:5173` on browser.

### 3. Endpoint Agent Deployment (agent.py)

On any target host node connected to the active subnet path, fire the stealth tracking thread:

```bash
pip install psutil requests
python3 agent.py

```

---

## 🔒 Security Assertions & Design Philosophy

Project EnergonX complies with strict Zero-Trust architecture paradigms:


$$\text{Baseline Verification} = \left( \text{Packet}_{\text{SrcIP}} \in \text{Trusted Cache} \right) \land \left( \text{Packet}_{\text{SrcMAC}} == \text{Baseline}[\text{SrcIP}] \right)$$


Any packet failing this evaluation matrix is instantly dropped by the automated kernel-space containment subsystems.

---

Developed under secure coding standards for real-time multi-layer secure digital infrastructure protection.

```