# Final Term Activity 6: Map Navigation & Location Tracking Web Interface for Flask API

An interactive, full-stack mapping and GPS tracking application built using **Flask**, **SQLite**, **Leaflet.js**, **OpenStreetMap**, and **Leaflet Routing Machine (OSRM)**.

---

## 💡 Why This Approach is Recommended Over Google Maps API

| Feature | Google Maps JavaScript API | Leaflet.js + OpenStreetMap (Implemented) |
|---|---|---|
| **API Key / Billing Required** | ⚠️ Yes (Requires Credit Card & Cloud Account) | ✅ **100% Free & No Credit Card or API Key** |
| **Setup Complexity** | Complex console configuration | ✅ **Instant setup via CDN** |
| **Turn-by-turn Navigation** | Directions API (Charged per request) | ✅ **Built-in free routing via OSRM** |
| **Search (Geocoding)** | Places API (Quota limited) | ✅ **Free OpenStreetMap Nominatim search** |
| **School/Lab Friendly** | High chance of quota / billing errors | ✅ **Ideal for academic projects & lab submissions** |

---

## 📁 Project Architecture

```text
final_term_activity_6/
├── app.py                  # Flask backend (Search proxy, Location REST API, SQLite)
├── database.db             # SQLite database storing location history & tracking points
├── templates/
│   └── index.html          # Split-panel view: Search & Directions sidebar + Leaflet Map
├── static/
│   ├── css/
│   │   └── style.css       # Map layout, custom pulsing GPS markers, responsive styles
│   └── js/
│       └── app.js          # Leaflet map, GPS Geolocation, Routing Machine, & Fetch API
└── README.md               # Guide and documentation
```

---

## 🌟 Key Features

1. **Location Search & Autocomplete:**
   - Search any landmark, address, or city via OpenStreetMap's Nominatim search engine.
   - Proxied through Flask (`/api/search?q=...`) to prevent browser CORS and rate-limiting issues.
2. **Current & Live GPS Tracking:**
   - **Locate Me:** Detects user's real-time latitude & longitude using the HTML5 Geolocation API.
   - **Live GPS Tracking:** Continuously tracks and updates your position as you move (`watchPosition`).
   - Custom pulsing blue indicator on the map.
3. **Turn-by-turn Directions (Like Google Maps):**
   - Calculates the driving route from your **current or previous location** to the destination.
   - Displays real-world road path (polyline), total distance in **km**, and estimated travel time in **minutes**.
   - Expandable turn-by-turn instruction list (e.g. *"Turn left onto Taft Avenue in 300m"*).
4. **Previous Locations History (Flask REST API + SQLite):**
   - Automatically and manually records past locations in SQLite via `POST /api/locations`.
   - **"Use as Start" button:** Easily set any past location as the route starting point to navigate from where you were previously.
   - **"View on Map" & "Delete":** Inspect or clean up past locations anytime.

---

## 🚀 How to Run the Application

1. Open PowerShell and navigate to the project directory:
   ```powershell
   cd "C:\Users\CCS-Lab4\.gemini\antigravity\scratch\final_term_activity_6"
   ```

2. Start the Flask application:
   ```powershell
   python app.py
   ```

3. Open your browser and go to:
   ```text
   http://127.0.0.1:5000/
   ```

4. When prompted by your browser, click **"Allow"** on the location prompt so the map can detect your position.
