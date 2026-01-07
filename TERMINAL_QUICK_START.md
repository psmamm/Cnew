# Terminal Quick Start Guide

## 🚀 Terminal öffnen und testen

### Schritt 1: Frontend Development Server starten

```powershell
# Im Projekt-Verzeichnis
cd C:\Users\Leand\Desktop\CIRCL

# Development Server starten
npm run dev
```

Der Server läuft normalerweise auf: **http://localhost:5173** (oder einem anderen Port, siehe Terminal-Ausgabe)

### Schritt 2: Terminal-Seite öffnen

Nach dem Start des Development Servers:

1. **Im Browser öffnen:**
   ```
   http://localhost:5173/terminal
   ```

2. **Oder über die Navigation:**
   - Nach dem Login im Dashboard
   - Direkt zur URL: `/terminal` navigieren

### Schritt 3: Was du sehen solltest

Das **High-Frequency Trading Terminal** mit:

#### Layout:
- **Header Bar** (oben): Symbol-Selector, Preis, Stats (Mark, Index, 24h High/Low, Vol, OI, Funding)
- **Chart Panel** (60% links): TradingView Advanced Chart
- **Orderbook Panel** (20% Mitte): WebGL Orderbook mit Echtzeit-Updates
- **Deal Ticket** (20% rechts): Bybit UTA 2.0 Style mit Risk-First Input
- **Positions Panel** (unten): Positions/Orders/History Tabs

#### Features zum Testen:

1. **Symbol wechseln:**
   - Klicke auf das Symbol im Header (z.B. "BTCUSDT")
   - Wähle ein anderes Symbol (ETHUSDT, BNBUSDT, etc.)
   - Chart und Orderbook sollten sich synchron aktualisieren

2. **Orderbook:**
   - Siehst du Bid/Ask Levels mit Depth Bars
   - Aggregation Toggle (0.1, 0.5, 1.0) testen
   - Echtzeit-Updates (wenn WebSocket verbunden)

3. **Deal Ticket:**
   - Risk Amount eingeben (z.B. $50)
   - Entry Price und Stop Loss setzen
   - Position Size wird automatisch berechnet (Qty = Risk / (Entry - SL))
   - Leverage Slider testen
   - Margin Mode (Isolated/Cross) wechseln

4. **Performance:**
   - Orderbook sollte 20+ Updates/Sekunde verarbeiten können
   - Symbol-Wechsel sollte smooth sein (< 150ms Fade-Transition)
   - 60 FPS durch RAF Throttling

### Schritt 4: Backend (optional, für Order Execution)

Wenn du Orders platzieren möchtest:

```powershell
# In einem neuen Terminal-Fenster
.\start-backend.ps1
```

Backend läuft auf: **http://127.0.0.1:8787**

## 📁 Neue Dateien & Komponenten

### Terminal Komponenten:
- `src/react-app/pages/Terminal.tsx` - Haupt-Layout
- `src/react-app/components/terminal/TerminalHeader.tsx` - Header mit Symbol-Selector
- `src/react-app/components/terminal/TradingViewChart.tsx` - Chart mit Symbol-Sync
- `src/react-app/components/terminal/WebGLOrderbook.tsx` - Orderbook mit Performance-Optimierungen
- `src/react-app/components/terminal/TerminalDealTicket.tsx` - Deal Ticket (Bybit UTA 2.0)
- `src/react-app/components/terminal/PositionsPanel.tsx` - Positions/Orders Panel

### Performance Utilities:
- `src/react-app/utils/rafThrottle.ts` - RequestAnimationFrame Throttling
- `src/react-app/utils/ringBuffer.ts` - Ring Buffer für Orderbook-Updates
- `src/react-app/utils/webglPool.ts` - WebGL Object Pooling

### Hooks & Context:
- `src/react-app/contexts/SymbolContext.tsx` - Globaler Symbol-State
- `src/react-app/hooks/useSymbolSync.ts` - Symbol-Synchronisation
- `src/react-app/hooks/useBybitOrderbook.ts` - Bybit V5 WebSocket Integration

### Types:
- `src/react-app/types/terminal.ts` - TypeScript Type Definitions

## 🎨 Theme & Styling

Bybit Dark Mode Theme ist in `src/react-app/index.css` definiert:
- Hintergrund: `#0B0E11`
- Panel: `#161A1E`
- Border: `#2B2F36`
- Text Primary: `#EAECEF`
- Text Muted: `#848E9C`
- Bid: `#2EAD65` (Grün)
- Ask: `#F6465D` (Rot)
- Accent: `#F0B90B` (Bybit Gold)

## 🔧 Troubleshooting

### Terminal lädt nicht:
- Prüfe ob `npm run dev` läuft
- Prüfe Browser-Konsole auf Fehler
- Stelle sicher, dass du eingeloggt bist (Protected Route)

### Orderbook zeigt keine Daten:
- Prüfe WebSocket-Verbindung in Browser DevTools (Network → WS)
- Prüfe ob Bybit WebSocket erreichbar ist
- Prüfe Browser-Konsole auf Fehler

### Chart zeigt nichts:
- TradingView Widget benötigt Internet-Verbindung
- Prüfe ob TradingView Script geladen wird (Network Tab)
- Prüfe Browser-Konsole auf Fehler

## 📊 Performance Monitoring

Öffne Browser DevTools → Performance Tab:
- Frame Rate sollte bei ~60 FPS sein
- Orderbook Updates sollten < 16ms pro Frame sein
- Symbol Switch sollte < 150ms dauern
