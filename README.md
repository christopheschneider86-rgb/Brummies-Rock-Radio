# 🎸 Brummies Rock Radio

**A Progressive Web App for discovering and streaming radio stations worldwide — with a focus on local connections.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PWA](https://img.shields.io/badge/PWA-enabled-blue.svg)](https://web.dev/progressive-web-apps/)
[![Made with Love](https://img.shields.io/badge/Made%20with-❤-red.svg)](https://github.com/christopheschneider86-rgb/brummies-rock-radio)

---

## 🌍 **The Concept: Think Globally, Listen Locally**

While the internet gives us access to **30,000+ radio stations worldwide**, the listening experience often feels disconnected and overwhelming. 

**Brummies Rock Radio** brings back the sense of **local connection** by letting you:
- 🗺️ **See stations near you** — sorted by actual distance from your location
- 🌐 **Explore the world** — but with the comfort of knowing where each station is
- 📻 **Feel connected** — discover your neighbor's favorite station or find a local gem

**The philosophy:** Global reach should enhance, not replace, the feeling of local community radio.

---

## ✨ **Features**

### 🔍 **Smart Search & Discovery**
- **5 Main Genres**: Rock, Metal, Pop, Classic, Jazz
- **Dynamic Subgenres**: Hard Rock, Death Metal, Synth Pop, and more
- **Country Filter**: Find stations from specific countries
- **Text Search**: Search by station name
- **Intelligent Sorting**: 
  - 📍 **Distance** (closest first — *when GPS data is available*)
  - ⭐ **Favorites** (your starred stations first)
  - 👥 **Popularity** (most listened)
  - 🎵 **Quality** (highest bitrate)
  - 🔤 **Alphabetical**

### 📍 **Location-Based Features**
- **GPS-Based Distance Calculation**: See how far each station is from you
- **Manual Location Selection**: Choose a country if you prefer not to share GPS
- **"No GPS Data" Indicator**: Transparency when station coordinates are unavailable
- **Distance Sorting**: Discover stations in your neighborhood or city

*This is what makes the app special — the ability to feel connected to your local radio scene while having access to the entire world.*

### 🎵 **Powerful Player**
- ▶️ **Play/Pause/Previous/Next** navigation
- 🎚️ **5-Band Equalizer** (Desktop)
  - 80Hz, 400Hz, 1kHz, 3.5kHz, 10kHz
  - Presets: Flat, Rock, Metal, Bass
- 📊 **Real-time Visualizer** (Desktop)
- 🔊 **Volume Control** (Desktop)
- ⭐ **Favorite Stations** — quick access to your saved stations

### 🎭 **Now Playing**
- 📺 **Scrolling Metadata** — shows current track info
- 🔄 **Auto-refresh** — updates every 10 seconds
- 📋 **Copy Info** — copy current track to clipboard
- 🖼️ **Station Logo** — when available

### 🔀 **Auto-Shuffle**
- Automatically switches between your top 20 filtered stations
- **Fixed intervals** or **random timing** (3-10 minutes)
- Perfect for discovering new music

### ⏰ **Sleep Timer**
- Stop playback after X minutes
- Or at a specific time (e.g., 23:00)
- Status display with countdown

### 📜 **History & Statistics**
- **Listening History**: See which stations you played and when
- **Usage Statistics**: Track total listening time per station
- **Session Counter**: See how many times you've tuned into each station
- Click any entry to instantly play that station again

### 📊 **Data Usage Tracking**
- **Current Session**: Real-time data consumption
- **Time Periods**: 1 hour, 24 hours, Week, Month
- **Statistics**: Total usage and daily average
- **Transparency**: Know exactly how much data you're using

### ⚙️ **Settings Panel**
- 🌍 **Language Selection** (prepared for future implementation)
- 🎨 **Theme Selection** (Dark, Darker — more coming)
- 📊 **Data Usage Overview**
- ❤️ **Support/Donation** option
- ℹ️ **About** section

### 📱 **Progressive Web App (PWA)**
- **Installable** on iOS, Android, and Desktop
- **Offline Ready** — cached for reliability
- **Native Feel** — runs like a native app
- **Home Screen Icon** — add to your device

---

## 🎯 **Why This Project?**

### The Problem
Modern streaming services offer millions of songs but lack the **spontaneity** and **local connection** of traditional radio. Internet radio aggregators give you access to thousands of stations but feel **overwhelming** and **disconnected**.

### The Solution
Brummies Rock Radio combines the best of both worlds:

1. **Global Access**: 30,000+ stations from Radio Browser API
2. **Local Feel**: GPS-based sorting lets you find stations "around the corner"
3. **Smart Filtering**: Genre, country, and quality filters help you find what you want
4. **Community Focus**: See where stations are, feel connected to places and communities

### The Vision
Imagine you're in Berlin and want to feel connected to local music. With Brummies Rock Radio, you can:
- See the **5 closest rock stations** in your neighborhood
- Or **explore stations in Tokyo** while understanding their geographic context
- **Feel the connection** to places through their music

*Radio isn't just about the music — it's about the places and people behind it.*

---

## 🚀 **Getting Started**

### Try It Now
Visit the live demo: **[Brummies Rock Radio](https://christopheschneider86-rgb.github.io/Brummies-Rock-Radio/)**

### Run Locally

```bash
# Clone the repository
git clone https://github.com/christopheschneider86-rgb/brummies-rock-radio.git
cd brummies-rock-radio

# Serve locally (Python 3)
python3 -m http.server 8000

# Or use any other HTTP server
# Open http://localhost:8000 in your browser
```

### Install as PWA

#### iOS (Safari)
1. Open the app in Safari
2. Tap the **Share** button
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"**

#### Android (Chrome)
1. Open the app in Chrome
2. Tap the **Menu** (⋮)
3. Tap **"Add to Home screen"**
4. Tap **"Add"**

#### Desktop (Chrome/Edge)
1. Open the app in Chrome or Edge
2. Click the **Install** icon in the address bar
3. Click **"Install"**

---

## 🛠️ **Tech Stack**

- **Vanilla JavaScript** — No frameworks, pure performance
- **CSS Grid & Flexbox** — Responsive layout
- **Web Audio API** — Equalizer and visualizer
- **Service Workers** — Offline support and caching
- **LocalStorage** — Save favorites, settings, and statistics
- **Geolocation API** — GPS-based distance calculation
- **Radio Browser API** — 30,000+ stations worldwide
- **Progressive Web App** — Installable, offline-ready

---

## 📊 **How It Works**

### Distance Calculation
When you enable location access, the app:
1. Gets your GPS coordinates (latitude/longitude)
2. Fetches station coordinates from Radio Browser API
3. Calculates distance using the **Haversine formula**:
   ```javascript
   distance = 2 × R × arcsin(√(sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)))
   ```
4. Sorts stations by distance (closest first)

**Privacy:** Your location is never sent to any server — all calculations happen in your browser.

### Data Usage Estimation
The app estimates data consumption based on:
- Station bitrate (e.g., 128 kbps)
- Listening duration
- Formula: `Data (MB) = (Bitrate × Time) / 8 / 1024 / 1024`

Typical usage:
- **128 kbps**: ~57 MB/hour
- **192 kbps**: ~86 MB/hour
- **320 kbps**: ~144 MB/hour

---

## 🌟 **Screenshots**

### Desktop View
```
┌──────────────────────┬──────────────────────┐
│   🔍 Station Search  │   ▶ Now Playing      │
│   ───────────────    │   ─────────────      │
│   [Filters]          │   [Cover Art]        │
│   [Genre: Rock ▼]    │   Rock Antenne       │
│   [Country: DE ▼]    │   128kbps · ⭐      │
│   [Location: Auto]   │                      │
│                      │   [⏮ ▶ ⏭]          │
│   Sort: [⭐][📍][👥] │                      │
│                      │   🎚️ EQUALIZER      │
│   ┌────────────────┐ │   [Visualizer]       │
│   │ Rock Antenne ⭐│ │                      │
│   │ 📍 12km · 128k │ │   📜 HISTORY        │
│   │ Metal Radio    │ │   15:34 – Rock...   │
│   │ 📍 45km · 192k │ │   15:12 – Metal...  │
│   └────────────────┘ │                      │
└──────────────────────┴──────────────────────┘
          50%                   50%
```

### Mobile View
```
┌──────────────────┐
│ 🎸 Brummies     │
│    Rock Radio ☰ │
├──────────────────┤
│ 🔍 Station Search│
│ [Rock ▼] [DE ▼] │
│ Sort: ⭐📍👥   │
│                  │
│ Rock Antenne  ⭐ │
│ 📍 12km · 128k  │
│                  │
│ Metal Radio      │
│ 📍 45km · 192k  │
├──────────────────┤
│ ▶ NOW PLAYING   │
│ [Cover]          │
│ Rock Antenne     │
│ [⏮ ▶ ⏭]       │
└──────────────────┘
```

---

## 🎨 **Features in Detail**

### Location-Based Discovery
The killer feature of this app is the **distance-based sorting**:

```javascript
// Example: You're in Munich, Germany
Station Search → Genre: Rock → Sort: Distance

Results:
1. Radio Gong 96.3 (Munich)      📍 2 km
2. Bayern 3 (Munich)             📍 5 km  
3. Rock Antenne (Munich)         📍 8 km
4. Sunshine Live (Mannheim)      📍 280 km
5. KISS FM (Berlin)              📍 505 km
```

This brings back the **feeling of local radio** — you know these stations are *around you*, part of *your community*.

But you can also:
- Switch to "Sort: Quality" to find the best-sounding stations
- Switch to "Country: USA" to explore American rock stations
- Use text search to find a specific station anywhere

**Flexibility meets locality.**

---

## 🔮 **Roadmap**

### Planned Features
- [ ] **Multi-language Support** — English, German, Spanish, French
- [ ] **More Themes** — Light mode, High contrast, Custom colors
- [ ] **Podcast Support** — Discover and play podcasts
- [ ] **Social Features** — Share your favorite stations
- [ ] **Station Recommendations** — AI-powered suggestions
- [ ] **Recording** — Save streams for later
- [ ] **Chromecast/AirPlay** — Stream to speakers
- [ ] **Lyrics Display** — Show lyrics when available
- [ ] **Community Ratings** — Let users rate stations

### Technical Improvements
- [ ] **IndexedDB** — Better storage for large datasets
- [ ] **Web Workers** — Offload processing for better performance
- [ ] **Server-Side API** — Real ICY metadata parsing
- [ ] **Advanced Caching** — Smarter offline capabilities

---

## 🤝 **Contributing**

Contributions are welcome! Here's how you can help:

1. **Report Bugs** — Open an issue with details
2. **Suggest Features** — Share your ideas
3. **Submit PRs** — Fix bugs or add features
4. **Translate** — Help make the app multilingual
5. **Test** — Try the app on different devices/browsers

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/christopheschneider86-rgb/brummies-rock-radio.git
cd brummies-rock-radio

# Create a branch
git checkout -b feature/christopheschneider86-rgb

# Make your changes
# Test thoroughly

# Commit and push
git commit -m "Add: Your feature description"
git push origin feature/christopheschneider86-rgb

# Open a Pull Request on GitHub
```

---

## 📜 **License**

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

You're free to:
- ✅ Use commercially
- ✅ Modify
- ✅ Distribute
- ✅ Private use

---

## 🙏 **Acknowledgments**

- **[Radio Browser API](https://www.radio-browser.info/)** — For providing access to 30,000+ radio stations
- **Community Contributors** — Thanks to everyone who helps improve this project
- **Open Source Community** — Built with love using open web standards

---

## 💖 **Support**

If you enjoy this app, consider:
- ⭐ **Starring this repository**
- 🐛 **Reporting bugs** to help improve it
- 💡 **Suggesting features** for future versions

---

## 📧 **Contact**

- **GitHub**: [@christopheschneider86-rgb](https://github.com/christopheschneider86-rgb)
- **Issues**: [Report a bug](https://github.com/christopheschneider86-rgb/brummies-rock-radio/issues)

---

## 🌐 **Data Source**

This app uses the **[Radio Browser Community Database](https://www.radio-browser.info/)**:
- 30,000+ stations worldwide
- Community-maintained
- Free and open
- No API key required

**Note:** Not all stations provide GPS coordinates. When coordinates are unavailable, the app shows "📍 No GPS Data" and those stations appear at the end when sorting by distance.

---

## 🎸 **Made with ❤️ for Radio Lovers**

Bringing back the feeling of local radio in a global world.

*"Think globally, listen locally."*

---

**Star ⭐ this project if you like it!**
