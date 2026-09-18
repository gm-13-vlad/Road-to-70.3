# Road to 70.3 — Virtual Cycling Trainer

A free, open-source virtual cycling trainer that connects to your smart bike trainer via Bluetooth. Train for your half-Ironman with real terrain simulation, automatic resistance control, and a full metrics dashboard.

## Features

- **Smart Trainer Connection** — Connects to any FTMS-compatible smart trainer via Web Bluetooth
- **Heart Rate Monitor** — Connect a separate Bluetooth HR strap
- **Terrain Simulation** — Routes with hills and descents that automatically adjust trainer resistance
- **5 Built-in Routes** — From easy recovery spins to the full 90km Half Ironman bike leg
- **Live Dashboard** — Power, speed, cadence, heart rate, gradient, distance, time, elevation gain
- **Power Zones** — Color-coded based on your FTP
- **Manual Mode** — Ride without a trainer using simulated physics
- **Ride Summary** — Full stats and elevation chart after each ride

## Routes

| Route | Distance | Difficulty | Description |
|-------|----------|------------|-------------|
| Flat Recovery Spin | 15 km | Easy | Gentle undulations for recovery days |
| Rolling Countryside | 25 km | Moderate | Rolling 3-5% hills for endurance |
| Sprint Intervals | 20 km | Moderate | Punchy 6-8% hills for interval training |
| Mountain Pass | 30 km | Hard | Sustained 8 km climb at 5.5% average |
| Half Ironman 70.3 | 90 km | Brutal | Full 70.3 bike leg with mixed terrain |

## Quick Start

The app runs as static files — no build step, no npm install.

### Option 1: Python (simplest)

```bash
cd Road-to-70.3
python3 -m http.server 8000
```

Open `http://localhost:8000` in Chrome or Edge.

### Option 2: Node.js

```bash
npx serve .
```

### Option 3: Any HTTPS server

Web Bluetooth requires a secure context (HTTPS or localhost). Any static file server will work.

## Usage

1. **Set your profile** — Enter rider weight, bike weight, and FTP
2. **Select a route** — Pick from 5 built-in routes with terrain previews
3. **Connect your trainer** — Click "Connect Trainer" and select your device
4. **Optionally connect HR** — Pair a separate heart rate monitor
5. **Start riding** — The app reads your power/speed/cadence and adjusts resistance based on terrain

### Manual Mode

No trainer? Click "Start Without Trainer" to ride with simulated physics. Speed adjusts automatically based on gradient.

## Trainer Compatibility

Works with any smart trainer that supports the **FTMS (Fitness Machine Service)** Bluetooth protocol, including:

- Wahoo KICKR / KICKR Core / KICKR Snap
- Tacx NEO / Flux / Flow
- Elite Direto / Suito / Zumo
- Saris H3
- Most other modern smart trainers

## Browser Requirements

- **Chrome 56+** or **Edge 79+** (Web Bluetooth support required)
- Safari and Firefox do not support Web Bluetooth
- Must be served over HTTPS or localhost

## How It Works

The app uses the **FTMS (Fitness Machine Service)** Bluetooth protocol:

- **Reads** indoor bike data (power, cadence, speed) from characteristic `0x2AD2`
- **Writes** simulation parameters (gradient, rolling resistance, wind) to the control point `0x2AD9`
- The trainer's firmware converts the gradient into actual brake resistance
- Gradient changes are throttled to prevent flooding the trainer

## License

MIT
