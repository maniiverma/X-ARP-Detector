# Project EnergonX — X-ARP Defensor

> An advanced Layer-2 network threat detection and response platform focused on ARP spoofing detection, endpoint telemetry, and real-time SOC visibility.

![License](https://img.shields.io/badge/license-Educational-blue)
![Status](https://img.shields.io/badge/status-Active%20Development-green)
![Stack](https://img.shields.io/badge/stack-Flask%20%7C%20React%20%7C%20Scapy%20%7C%20SQLite-black)

## Overview

**Project EnergonX / X-ARP Defensor** is a cybersecurity-focused full-stack system built to detect, analyze, and respond to ARP spoofing attacks inside local networks. The platform combines packet-level inspection, endpoint telemetry, forensic logging, and a real-time monitoring interface to simulate how a compact Security Operations Center (SOC) tool could function in a controlled environment.

Unlike a basic academic proof-of-concept, this project is structured as a modular security suite with clear separation between backend detection logic, endpoint visibility agents, and frontend monitoring components. The design emphasizes extensibility, observability, and operational clarity.

---

## Objectives

The project is designed to achieve the following goals:

- Detect suspicious ARP reply behavior in real time.
- Maintain trusted IP-to-MAC baseline mappings for local hosts.
- Trigger defensive actions when malicious ARP poisoning is identified.
- Collect endpoint-side process and application telemetry for additional context.
- Visualize alerts and system state through a modern web dashboard.
- Preserve security events for later review and forensic analysis.

---

## Core Capabilities

### 1. ARP Spoofing Detection Engine
The backend continuously inspects ARP traffic and compares observed sender mappings against a trusted baseline. If a device claims ownership of an IP address that belongs to another MAC address, the event is treated as suspicious and escalated.

### 2. Active Mitigation Workflow
When enabled, the system can respond to identified spoofing attempts through defensive controls such as alerting, containment logic, and corrective network actions. This makes the platform useful not only for passive monitoring but also for incident response demonstrations.

### 3. Endpoint Telemetry Collection
The endpoint agent captures lightweight host context such as active processes, foreground application behavior, and selected system indicators. This helps correlate network anomalies with potentially suspicious activity on monitored machines.

### 4. Real-Time SOC Dashboard
The frontend provides a centralized interface for viewing alerts, network events, agent updates, and mitigation status. The dashboard is intended to resemble a compact SOC console rather than a generic student UI.

### 5. Local Forensic Storage
Security events can be written to a local SQLite database for historical analysis, replay, and audit purposes. This supports demonstrations involving event timelines and incident reporting.

---

## Architecture

```text
                         ┌───────────────────────────────┐
                         │      Monitored Endpoint       │
                         │   (Windows/Linux Host Node)   │
                         └──────────────┬────────────────┘
                                        │
                         Process / Usage / Host Telemetry
                                        │
                                        ▼
                               ┌────────────────┐
                               │    agent.py    │
                               │ Endpoint Agent │
                               └───────┬────────┘
                                       │ HTTP/JSON
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               app.py Backend                                 │
│------------------------------------------------------------------------------│
│  - ARP packet sniffing via Scapy                                             │
│  - Baseline IP/MAC verification                                              │
│  - Alert generation and mitigation logic                                     │
│  - SQLite event persistence                                                  │
│  - REST API + WebSocket/Socket.IO communication                              │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                │ Real-time events / API responses
                                ▼
                     ┌────────────────────────────────┐
                     │     React Frontend (App.jsx)   │
                     │  Security Dashboard / SOC View │
                     └────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|------|------------|---------|
| Backend | Python, Flask | API services and orchestration |
| Packet Analysis | Scapy | ARP sniffing and packet inspection |
| Realtime Transport | Flask-SocketIO / WebSockets | Live alert streaming |
| Endpoint Agent | Python, psutil, requests | Host telemetry collection |
| Frontend | React, Vite | Monitoring dashboard |
| Storage | SQLite | Event logging and lightweight forensics |
| System Defense | iptables / OS networking controls | Defensive enforcement |

---

## Repository Layout

```text
arp-spoof-guard/
├── backend/
│   ├── app.py
│   ├── agent.py
│   ├── xarp_vault.db          # generated locally, do not commit
│   └── xarp_env/              # virtual environment, do not commit
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   └── App.jsx
│   └── node_modules/          # generated locally, do not commit
└── README.md
```

---

## Installation

### Backend Setup

```bash
cd backend
python3 -m venv xarp_env
source xarp_env/bin/activate
pip install flask flask-cors flask-socketio scapy requests psutil
```

> Run the backend with elevated privileges only when packet sniffing or network control features require it.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Agent Setup

```bash
cd backend
pip install psutil requests
python3 agent.py
```

---

## Execution Flow

1. Start the backend service on the monitoring machine.
2. Launch the React dashboard for live visualization.
3. Deploy and run the endpoint agent on one or more hosts.
4. The backend listens for ARP traffic and incoming endpoint telemetry.
5. Suspicious events are logged, pushed to the dashboard, and optionally used for response actions.

---

## Detection Logic

The security model relies on a baseline validation process:

\[
\text{Trusted}(IP) \Rightarrow MAC_{observed} = MAC_{baseline}
\]

If an observed ARP reply violates this mapping rule, the packet source is treated as potentially malicious.

A simplified detection interpretation:

- If a known IP suddenly advertises a different MAC address, flag the event.
- If repeated mismatches occur, raise severity.
- If mitigation is enabled, trigger the configured defense routine.

---

## Security Design Principles

This project is built around several important security concepts:

- **Zero-Trust Thinking:** No network identity is trusted without validation.
- **Defense in Depth:** Detection, telemetry, logging, and response operate together.
- **Least Persistence:** Sensitive runtime artifacts should not be committed to version control.
- **Operational Visibility:** Analysts should be able to understand what happened, when, and why.
- **Controlled Use:** The tool is intended for labs, demos, and authorized environments only.

---

## Sample Use Cases

- Demonstrating ARP spoofing detection in a cybersecurity lab.
- Building a college major project with a professional architecture.
- Showcasing full-stack security engineering skills in a portfolio.
- Practicing incident visualization and alert correlation workflows.
- Extending the system toward NAC, EDR, or internal SOC automation ideas.

---

## API and Health Design

Example backend health endpoint:

```http
GET /api/health
```

Possible response structure:

```json
{
  "status": "ok",
  "service": "x-arp-defensor",
  "sniffer": "active",
  "database": "connected"
}
```

Other useful API categories may include:

- `/api/alerts`
- `/api/agents`
- `/api/events`
- `/api/mitigation`

---

## .gitignore

Use a strict `.gitignore` to prevent unnecessary or sensitive files from entering version control:

```gitignore
node_modules/
xarp_env/
*.db
*.db-wal
*.db-shm
*.log
.env
.DS_Store
__pycache__/
*.pyc
```

---

## Recommended Enhancements

To move this project closer to production-grade engineering, the following improvements are recommended:

- Add authentication and role-based access control to the dashboard.
- Encrypt telemetry traffic between agent and backend.
- Introduce signed agent registration and trust onboarding.
- Add structured logging and severity classification.
- Containerize services with Docker for reproducible deployment.
- Create unit and integration tests for detection workflows.
- Add CI/CD checks for linting, testing, and dependency scanning.
- Implement alert export in JSON/CSV/PDF formats.
- Add attack simulation scripts for controlled testing.

---

## Limitations

This project is advanced, but it should still be presented honestly:

- ARP protection is limited to local network scope.
- Mitigation behavior depends on operating system privileges and environment configuration.
- Endpoint telemetry depth depends on platform-specific access.
- Real-world deployment requires stronger authentication, encryption, hardening, and legal controls.

---

## Ethical Use Notice

This software must be used only in authorized environments such as personal labs, academic demonstrations, controlled enterprise testing, or approved security research settings. Running network inspection or mitigation tooling on networks without permission may violate law, policy, or ethical standards.

---

## Why This Project Stands Out

Project EnergonX is not just a single-script ARP detector. It represents a broader security engineering approach that combines:

- Network threat detection
- Endpoint context collection
- Incident visualization
- Defensive response logic
- Forensic event retention
- Full-stack implementation discipline

This makes it a strong portfolio project for cybersecurity, SOC engineering, blue-team development, and secure full-stack system design.

---

**Mani Verma**  
Cybersecurity Student / Security-Focused Developer  
Punjab, India

---

## License

This project can be released under an educational, MIT, or custom academic license depending on submission requirements. Add a dedicated `LICENSE` file before public release.
