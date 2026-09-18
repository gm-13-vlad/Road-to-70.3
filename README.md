# Road to 70.3 — Virtual Cycling Trainer

A free, open-source virtual cycling trainer that connects to your smart bike trainer via Bluetooth or ANT+. Train for your half-Ironman with real terrain simulation, automatic resistance control, and a full metrics dashboard.

## Features

- **Outdoor Road View** — Ride a 3D road that winds and climbs with your route's real elevation
- **Bluetooth + ANT+ Support** — Connect via Bluetooth (FTMS) or ANT+ USB dongle (FE-C)
- **Heart Rate Monitor** — Connect a Bluetooth or ANT+ HR strap
- **Terrain Simulation** — Routes with hills and descents that automatically adjust trainer resistance
- **ERG Structured Workouts** — 8 built-in sessions that hold your trainer at a target wattage
- **5 Built-in Routes** — From easy recovery spins to the full 90km Half Ironman bike leg
- **Live Dashboard** — Power, speed, cadence, heart rate, gradient, distance, time, elevation gain
- **Power Zones** — Color-coded based on your FTP
- **Ride History** — Every ride is saved locally and listed for later
- **TCX Export** — Download any ride and upload it to Strava, Garmin Connect or TrainingPeaks
- **Manual Mode** — Ride without a trainer using simulated physics
- **Ride Summary** — Full stats plus a recorded power / heart rate / elevation chart

## Routes

| Route | Distance | Difficulty | Description |
|-------|----------|------------|-------------|
| Flat Recovery Spin | 15 km | Easy | Gentle undulations for recovery days |
| Rolling Countryside | 25 km | Moderate | Rolling 3-5% hills for endurance |
| Sprint Intervals | 20 km | Moderate | Punchy 6-8% hills for interval training |
| Mountain Pass | 30 km | Hard | Sustained 8 km climb at 5.5% average |
| Half Ironman 70.3 | 90 km | Brutal | Full 70.3 bike leg with mixed terrain |

## The Road View

The main ride screen is a scrolling outdoor road rendered with classic pseudo-3D
projection — the same technique arcade racers used before real 3D hardware.

- The road's **elevation is your actual route**. On the Mountain Pass climb the road
  rears up and the horizon closes in; over the top it drops away and the view opens out.
  Elevation is deliberately exaggerated so gradient is something you *see*, not just read.
- The road **winds**, with roadside trees, bushes, rocks and kilometre signs going by.
- **Sky changes with the time of day** you're actually riding — daylight, golden hour,
  dusk, or a starfield at night.
- Your rider **pedals in time with your real cadence** and the camera bobs with it.

A slim **elevation profile** sits along the bottom showing where you are in the route
(or, in a workout, the interval timeline). Hit **Profile View** at any time to swap the
road for the full-size chart, and **Road View** to go back.

## Workouts (ERG Mode)

In ERG mode the app writes a **target wattage** to your trainer and the trainer holds
it regardless of your gear or cadence — just pedal. Targets are calculated from the
FTP you enter on the start screen, and the **Intensity** slider during the ride
scales every target from 50% to 150% if the session is too easy or too hard.

| Workout | Duration | Focus |
|---------|----------|-------|
| Recovery Spin | 30 min | Recovery |
| Endurance Z2 | 80 min | Aerobic base |
| Sweet Spot 3x12 | 70 min | Sustained power |
| Threshold 2x20 | 75 min | FTP |
| Over-Unders | 72 min | Lactate clearance |
| VO2max 5x3 | 55 min | Top end |
| 70.3 Race Simulation | 120 min | Race specificity |
| FTP Test (20 min) | 57 min | Testing |

## Ride History & Export

Every finished ride is saved to your browser's local storage and listed under the
**History** tab. Any ride can be exported as a **.TCX** file, the standard Garmin
training format, which uploads directly to:

- **Strava** — Upload Activity → File
- **Garmin Connect** — Import Data
- **TrainingPeaks**, **intervals.icu**, and most other training platforms

Exported files include per-second timestamps, power, cadence, heart rate, speed,
distance and elevation.

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
2. **Pick a session** — Choose a **Route** (terrain simulation) or a **Workout** (ERG target power)
3. **Choose protocol** — Toggle between Bluetooth and ANT+ at the top of the connection section
4. **Connect your trainer** — Click "Connect Trainer" and select your device (Bluetooth pairing dialog or ANT+ USB dongle)
5. **Optionally connect HR** — Pair a separate heart rate monitor (works with both protocols)
6. **Start riding** — On a route the app adjusts resistance to match the gradient; in a workout it holds you at target watts
7. **Export it** — Finish the ride and download a .TCX for Strava or Garmin Connect

### Manual Mode

No trainer? Click "Start Without Trainer" to ride with simulated physics. Speed adjusts automatically based on gradient.

## Trainer Compatibility

### Bluetooth (FTMS)

Works with any smart trainer that supports the **FTMS (Fitness Machine Service)** Bluetooth protocol:

- Wahoo KICKR / KICKR Core / KICKR Snap
- Tacx NEO / Flux / Flow
- Elite Direto / Suito / Zumo
- Saris H3
- Most other modern smart trainers

### ANT+ (FE-C)

Works with any smart trainer that supports the **ANT+ FE-C (Fitness Equipment Control)** protocol. Requires an **ANT+ USB dongle** (Garmin/Dynastream USB stick):

- All trainers listed above also support ANT+ FE-C
- Older trainers that only have ANT+ (no Bluetooth)
- ANT+ heart rate straps (automatically detected on the same dongle)

## Browser Requirements

- **Chrome 56+** or **Edge 79+** (Web Bluetooth and WebUSB support required)
- Safari and Firefox do not support Web Bluetooth or WebUSB
- Must be served over HTTPS or localhost
- **For ANT+**: Plug in an ANT+ USB dongle before connecting. On Linux, you may need to add a udev rule for the Garmin USB ANT+ stick (vendor `0x0fcf`)

## How It Works

### Bluetooth Mode

Uses the **FTMS (Fitness Machine Service)** protocol:

- **Reads** indoor bike data (power, cadence, speed) from characteristic `0x2AD2`
- **Writes** simulation parameters (gradient, rolling resistance, wind) to the control point `0x2AD9`
- **ERG mode** writes Set Target Power (opcode `0x05`) to the same control point
- The trainer's firmware converts the gradient into actual brake resistance

### ANT+ Mode

Uses the **FE-C (Fitness Equipment Control)** profile via **WebUSB**:

- Communicates with a Garmin/Dynastream ANT+ USB dongle (VID `0x0FCF`)
- Opens FE-C channel (device type `0x11`) for trainer data and control
- Opens HR channel (device type `0x78`) for heart rate strap data
- Reads data pages: General FE Data (speed), Trainer Data (power, cadence)
- Sends Track Resistance page (`0x33`) to set gradient on the trainer
- Sends Target Power page (`0x31`) for ERG workouts
- Both channels share the same dongle — no extra hardware needed for HR

## License

MIT
