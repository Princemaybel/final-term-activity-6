import sqlite3
import os
import urllib.request
import urllib.parse
import json
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Use /tmp on Vercel because Vercel serverless functions have a read-only filesystem
if os.environ.get('VERCEL'):
    DB_PATH = '/tmp/database.db'
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

def get_db_connection():
    """Create and return a database connection with dict-like row access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables for location tracking and search history."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS location_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                loc_type TEXT DEFAULT 'tracked',
                notes TEXT DEFAULT '',
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Seed initial sample previous locations if empty
        cursor.execute('SELECT COUNT(*) as count FROM location_history')
        if cursor.fetchone()['count'] == 0:
            sample_locations = [
                ('Rizal Park, Manila', 14.5831, 120.9794, 'previous', 'Sample historical location 1'),
                ('Intramuros, Manila', 14.5896, 120.9747, 'previous', 'Sample historical location 2'),
                ('SM Mall of Asia, Pasay', 14.5353, 120.9826, 'previous', 'Sample historical location 3')
            ]
            cursor.executemany(
                'INSERT INTO location_history (name, latitude, longitude, loc_type, notes) VALUES (?, ?, ?, ?, ?)',
                sample_locations
            )
        conn.commit()

init_db()

# ----------------- Web UI Route -----------------
@app.route('/')
def index():
    """Serve the Map & Navigation interface."""
    return render_template('index.html')

# ----------------- REST API Endpoints -----------------
@app.route('/api/search', methods=['GET'])
def search_location():
    """
    Search for places using OpenStreetMap Nominatim.
    Proxied via Flask to avoid CORS and set a proper User-Agent header.
    """
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({"success": False, "message": "Search query is required."}), 400

    encoded_query = urllib.parse.quote(query)
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_query}&addressdetails=1&limit=5"

    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Activity6-FlaskMapApp/1.0 (contact: student@lab.local)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            results = []
            for item in data:
                results.append({
                    "display_name": item.get("display_name"),
                    "lat": float(item.get("lat")),
                    "lon": float(item.get("lon")),
                    "type": item.get("type", "location")
                })
            return jsonify({"success": True, "results": results}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Search failed: {str(e)}"}), 500

@app.route('/api/locations', methods=['GET'])
def get_locations():
    """Retrieve tracked and saved previous locations."""
    loc_type = request.args.get('type')
    query = 'SELECT * FROM location_history WHERE 1=1'
    params = []

    if loc_type:
        query += ' AND loc_type = ?'
        params.append(loc_type)

    query += ' ORDER BY id DESC'

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        locations = [dict(row) for row in rows]

    return jsonify({"success": True, "count": len(locations), "data": locations}), 200

@app.route('/api/locations', methods=['POST'])
def save_location():
    """Save a new tracked position or destination to history."""
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"success": False, "message": "Invalid JSON body."}), 400

    name = payload.get('name', 'Tracked Location').strip()
    lat = payload.get('latitude')
    lon = payload.get('longitude')
    loc_type = payload.get('loc_type', 'tracked')
    notes = payload.get('notes', '')

    if lat is None or lon is None:
        return jsonify({"success": False, "message": "Latitude and Longitude are required."}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"success": False, "message": "Coordinates must be numbers."}), 400

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO location_history (name, latitude, longitude, loc_type, notes) VALUES (?, ?, ?, ?, ?)',
            (name, lat, lon, loc_type, notes)
        )
        new_id = cursor.lastrowid
        conn.commit()

        cursor.execute('SELECT * FROM location_history WHERE id = ?', (new_id,))
        saved = dict(cursor.fetchone())

    return jsonify({"success": True, "message": "Location saved successfully!", "data": saved}), 201

@app.route('/api/locations/<int:loc_id>', methods=['DELETE'])
def delete_location(loc_id):
    """Delete a location record from history."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM location_history WHERE id = ?', (loc_id,))
        if cursor.rowcount == 0:
            return jsonify({"success": False, "message": "Location record not found."}), 404
        conn.commit()

    return jsonify({"success": True, "message": f"Location #{loc_id} removed."}), 200

@app.route('/api/locations/clear', methods=['POST'])
def clear_locations():
    """Clear all recorded location history."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM location_history')
        conn.commit()

    return jsonify({"success": True, "message": "All location history cleared."}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
