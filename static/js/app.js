/**
 * GeoTrack Pro - Modern Client Application Logic
 * Integrates Leaflet, OSRM Routing, Geocoding Search, and Flask REST API
 */

// Application State
let map;
let currentCoords = null; // { lat, lng }
let startPoint = null;    // { lat, lng, name }
let destPoint = null;     // { lat, lng, name }
let activeTravelMode = 'driving'; // 'driving' | 'walking' | 'cycling'

// Markers & Controls
let currentMarker = null;
let destMarker = null;
let routingControl = null;
let watchId = null;

// Tile Layer References
let tileLayers = {};
let activeTileLayer = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const searchResults = document.getElementById('searchResults');

const startPointInput = document.getElementById('startPointInput');
const destPointInput = document.getElementById('destPointInput');
const swapRouteBtn = document.getElementById('swapRouteBtn');
const calcRouteBtn = document.getElementById('calcRouteBtn');
const clearRouteBtn = document.getElementById('clearRouteBtn');

const locateMeBtn = document.getElementById('locateMeBtn');
const liveTrackingBtn = document.getElementById('liveTrackingBtn');
const liveTrackingText = document.getElementById('liveTrackingText');
const liveDot = document.getElementById('liveDot');

const saveCurrentBtn = document.getElementById('saveCurrentBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historyCountBadge = document.getElementById('historyCountBadge');

const routeSummaryContainer = document.getElementById('routeSummaryContainer');
const routeDistance = document.getElementById('routeDistance');
const routeDuration = document.getElementById('routeDuration');
const turnInstructions = document.getElementById('turnInstructions');

const navigationCard = document.getElementById('navigationCard');
const collapseCardBtn = document.getElementById('collapseCardBtn');
const collapseIcon = document.getElementById('collapseIcon');
const fullscreenBtn = document.getElementById('fullscreenBtn');

const toastEl = document.getElementById('liveToast');
const toastMessage = document.getElementById('toastMessage');
let toastInstance = null;

/**
 * Toast Notification System
 */
function showToast(msg, type = 'info') {
    if (!toastInstance) {
        toastInstance = new bootstrap.Toast(toastEl, { delay: 3500 });
    }
    toastEl.className = 'toast align-items-center text-white border-0 shadow-lg rounded-4';
    if (type === 'success') toastEl.classList.add('bg-success');
    else if (type === 'danger') toastEl.classList.add('bg-danger');
    else if (type === 'warning') toastEl.classList.add('bg-warning', 'text-dark');
    else toastEl.classList.add('bg-primary');

    toastMessage.innerHTML = `<i class="bi bi-info-circle-fill"></i> <span>${msg}</span>`;
    toastInstance.show();
}

/**
 * Initialize Leaflet Map with Multiple Tile Layers
 */
function initMap() {
    // Default coordinates: Manila, Philippines
    const defaultLat = 14.5995;
    const defaultLng = 120.9842;

    map = L.map('map', {
        zoomControl: false // Custom controls positioned cleanly
    }).setView([defaultLat, defaultLng], 14);

    // Reposition zoom controls to bottom-right above FABs
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Setup High-Quality 100% Free Tile Layers (NO API KEY / NO WATERMARK)
    tileLayers.streets = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Style: HOT'
    });

    tileLayers.osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    tileLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri World Imagery'
    });

    tileLayers.topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; OpenStreetMap contributors, &copy; OpenTopoMap'
    });

    // Default layer: Clean Modern Streets (100% Free, NO WATERMARK)
    activeTileLayer = tileLayers.streets;
    activeTileLayer.addTo(map);

    // Click anywhere on map to quickly drop destination pin
    map.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        setDestination(lat, lng, `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    });

    // Auto locate on first load
    locateUser(false);
}

/**
 * Switch Active Map Tile Layer
 */
function switchMapLayer(layerKey) {
    if (!tileLayers[layerKey] || activeTileLayer === tileLayers[layerKey]) return;

    map.removeLayer(activeTileLayer);
    activeTileLayer = tileLayers[layerKey];
    activeTileLayer.addTo(map);

    document.querySelectorAll('.map-layer-opt').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-layer') === layerKey);
    });

    showToast(`Switched map style to ${layerKey.toUpperCase()}`, 'info');
}

/**
 * Detect User GPS Location
 */
function locateUser(centerAndSave = true) {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'danger');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            currentCoords = { lat, lng };

            updateCurrentMarker(lat, lng);

            if (!startPoint) {
                setStartPoint(lat, lng, 'My Location (GPS)');
            }

            if (centerAndSave) {
                map.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
                saveLocationToApi('My GPS Location', lat, lng, 'tracked', 'Auto-saved via GPS');
                showToast('Position updated successfully!', 'success');
            }
        },
        (error) => {
            console.warn('Geolocation error:', error);
            currentCoords = { lat: 14.5995, lng: 120.9842 };
            updateCurrentMarker(currentCoords.lat, currentCoords.lng);
            if (!startPoint) {
                setStartPoint(currentCoords.lat, currentCoords.lng, 'Default (Manila)');
            }
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

/**
 * Pulsing Blue Radar Pin for Current Position
 */
function updateCurrentMarker(lat, lng) {
    const radarIcon = L.divIcon({
        className: 'current-pos-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    if (currentMarker) {
        currentMarker.setLatLng([lat, lng]);
    } else {
        currentMarker = L.marker([lat, lng], { icon: radarIcon })
            .addTo(map)
            .bindPopup('<b>Current Position</b><br>Live GPS Location');
    }
}

/**
 * Custom SVG Marker for Destination Pin
 */
function createCustomPin(color = '#ef4444') {
    return L.divIcon({
        className: 'custom-map-pin',
        html: `
            <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.16344 0 0 7.16344 0 16C0 27.2 16 38 16 38C16 38 32 27.2 32 16C32 7.16344 24.8366 0 16 0Z" fill="${color}"/>
                <circle cx="16" cy="15" r="6" fill="white"/>
            </svg>
        `,
        iconSize: [32, 38],
        iconAnchor: [16, 38],
        popupAnchor: [0, -38]
    });
}

function setStartPoint(lat, lng, name) {
    startPoint = { lat, lng, name };
    startPointInput.value = name;
}

function setDestination(lat, lng, name) {
    destPoint = { lat, lng, name };
    destPointInput.value = name;

    const pinIcon = createCustomPin('#ef4444');

    if (destMarker) {
        destMarker.setLatLng([lat, lng]);
    } else {
        destMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    }

    destMarker.bindPopup(`<b>${escapeHtml(name)}</b><br><small class="text-muted">Destination</small>`).openPopup();
    map.flyTo([lat, lng], 14, { animate: true, duration: 1.0 });

    showToast(`Destination set: ${name}`, 'info');
}

/**
 * Swap Origin and Destination
 */
function swapRoutePoints() {
    if (!startPoint && !destPoint) return;

    const temp = startPoint;
    startPoint = destPoint;
    destPoint = temp;

    startPointInput.value = startPoint ? startPoint.name : '';
    destPointInput.value = destPoint ? destPoint.name : '';

    if (routingControl) {
        calculateRoute();
    }
    showToast('Swapped start and destination.', 'info');
}

/**
 * Search Locations via Flask Nominatim Proxy
 */
async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        showToast('Please type a place to search.', 'warning');
        return;
    }

    searchResults.innerHTML = '<div class="p-3 text-center text-muted small"><span class="spinner-border spinner-border-sm me-2 text-primary"></span>Finding locations...</div>';
    searchResults.classList.remove('d-none');

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!data.success || !data.results || data.results.length === 0) {
            searchResults.innerHTML = '<div class="p-3 text-center text-muted small"><i class="bi bi-geo me-1"></i>No locations found.</div>';
            return;
        }

        searchResults.innerHTML = '';
        data.results.forEach(item => {
            const shortName = item.display_name.split(',')[0];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'list-group-item list-group-item-action py-2 d-flex align-items-start gap-2';
            btn.innerHTML = `
                <i class="bi bi-geo-alt-fill text-danger mt-1 fs-6"></i>
                <div class="overflow-hidden">
                    <div class="fw-bold text-dark text-truncate">${escapeHtml(shortName)}</div>
                    <div class="text-muted text-truncate" style="font-size: 0.75rem;">${escapeHtml(item.display_name)}</div>
                </div>
            `;
            
            btn.addEventListener('click', () => {
                setDestination(item.lat, item.lon, shortName);
                searchResults.classList.add('d-none');
                searchInput.value = shortName;
                clearSearchBtn.classList.remove('d-none');
                saveLocationToApi(shortName, item.lat, item.lon, 'destination', item.display_name);
            });
            searchResults.appendChild(btn);
        });

    } catch (err) {
        searchResults.innerHTML = '<div class="p-3 text-center text-danger small">Search service unavailable.</div>';
    }
}

/**
 * Calculate & Draw Directions Route (Google Maps style)
 */
function calculateRoute() {
    if (!startPoint || !destPoint) {
        showToast('Please specify both starting point and destination!', 'warning');
        return;
    }

    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    showToast('Calculating optimal driving path...', 'info');

    // Route profiles
    let osrmProfile = 'car';
    if (activeTravelMode === 'walking') osrmProfile = 'foot';
    if (activeTravelMode === 'cycling') osrmProfile = 'bike';

    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(startPoint.lat, startPoint.lng),
            L.latLng(destPoint.lat, destPoint.lng)
        ],
        router: L.Routing.osrmv1({
            serviceUrl: `https://router.project-osrm.org/route/v1`
        }),
        lineOptions: {
            styles: [
                { color: '#1a73e8', opacity: 0.9, weight: 6 },
                { color: '#4285f4', opacity: 0.4, weight: 10 }
            ]
        },
        routeWhileDragging: false,
        addWaypoints: false,
        show: false
    }).addTo(map);

    routingControl.on('routesfound', function (e) {
        const route = e.routes[0];
        const summary = route.summary;

        const distKm = (summary.totalDistance / 1000).toFixed(1);
        let durationMin = Math.round(summary.totalTime / 60);

        // Adjust speed heuristic for walking / biking
        if (activeTravelMode === 'walking') durationMin = Math.round((summary.totalDistance / 1000) * 12);
        if (activeTravelMode === 'cycling') durationMin = Math.round((summary.totalDistance / 1000) * 3.5);

        routeDistance.textContent = `${distKm} km`;
        routeDuration.textContent = `${durationMin} min`;

        // Turn-by-turn instruction rendering
        turnInstructions.innerHTML = '';
        const steps = route.instructions || [];
        if (steps.length > 0) {
            const ol = document.createElement('ol');
            ol.className = 'ps-3 mb-0';
            steps.forEach(step => {
                const li = document.createElement('li');
                li.className = 'mb-1';
                li.innerHTML = `${step.text} <span class="text-muted small">(${(step.distance).toFixed(0)}m)</span>`;
                ol.appendChild(li);
            });
            turnInstructions.appendChild(ol);
        } else {
            turnInstructions.innerHTML = '<div class="text-muted">Follow highlighted route on map.</div>';
        }

        routeSummaryContainer.classList.remove('d-none');
        showToast(`Route plotted: ${distKm} km (~${durationMin} min)`, 'success');
    });

    routingControl.on('routingerror', function () {
        showToast('Unable to find drivable route between selected points.', 'danger');
    });
}

/**
 * Clear Active Route
 */
function clearRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    if (destMarker) {
        map.removeLayer(destMarker);
        destMarker = null;
    }
    destPoint = null;
    destPointInput.value = '';
    routeSummaryContainer.classList.add('d-none');
    showToast('Route cleared.', 'info');
}

/**
 * Toggle Live GPS Tracking
 */
function toggleLiveTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        liveDot.className = 'live-dot-off';
        liveTrackingText.textContent = 'Live GPS: OFF';
        showToast('Live tracking paused.', 'info');
    } else {
        if (!navigator.geolocation) {
            showToast('Geolocation not supported.', 'danger');
            return;
        }
        liveDot.className = 'live-dot-on';
        liveTrackingText.textContent = 'Live GPS: ON';
        showToast('Live GPS tracking activated.', 'success');

        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                currentCoords = { lat, lng };
                updateCurrentMarker(lat, lng);
                setStartPoint(lat, lng, 'My Live Location');
            },
            (err) => console.warn(err),
            { enableHighAccuracy: true, maximumAge: 3000 }
        );
    }
}

/**
 * REST API: Save Location
 */
async function saveLocationToApi(name, latitude, longitude, loc_type = 'tracked', notes = '') {
    try {
        const response = await fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, latitude, longitude, loc_type, notes })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            loadLocationHistory();
        }
    } catch (err) {
        console.error('Error saving location:', err);
    }
}

/**
 * REST API: Load Location History
 */
async function loadLocationHistory() {
    try {
        const response = await fetch('/api/locations');
        const result = await response.json();

        historyList.innerHTML = '';
        const locations = result.data || [];
        historyCountBadge.textContent = locations.length;

        if (locations.length === 0) {
            historyEmpty.classList.remove('d-none');
            return;
        }
        historyEmpty.classList.add('d-none');

        locations.forEach(loc => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center px-3 py-2 history-item';
            
            const badge = loc.loc_type === 'previous' 
                ? '<span class="badge bg-secondary-subtle text-secondary rounded-pill" style="font-size: 0.68rem;">Saved</span>'
                : '<span class="badge bg-primary-subtle text-primary rounded-pill" style="font-size: 0.68rem;">Tracked</span>';

            li.innerHTML = `
                <div class="overflow-hidden me-2">
                    <div class="fw-semibold text-truncate text-dark" title="${escapeHtml(loc.name)}">
                        ${escapeHtml(loc.name)}
                    </div>
                    <div class="text-muted" style="font-size: 0.72rem;">
                        ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)} &bull; ${badge}
                    </div>
                </div>
                <div class="d-flex gap-1 flex-shrink-0">
                    <button class="btn btn-sm btn-outline-success rounded-pill py-0 px-2" style="font-size: 0.72rem;" onclick="useAsStart(${loc.latitude}, ${loc.longitude}, '${escapeHtml(loc.name)}')">
                        Start
                    </button>
                    <button class="btn btn-sm btn-light border rounded-circle icon-btn" style="width: 26px; height: 26px;" onclick="focusLocation(${loc.latitude}, ${loc.longitude}, '${escapeHtml(loc.name)}')">
                        <i class="bi bi-eye text-primary"></i>
                    </button>
                    <button class="btn btn-sm btn-light border rounded-circle icon-btn" style="width: 26px; height: 26px;" onclick="deleteLocation(${loc.id})">
                        <i class="bi bi-trash text-danger"></i>
                    </button>
                </div>
            `;
            historyList.appendChild(li);
        });

    } catch (err) {
        console.error('Error loading history:', err);
    }
}

window.useAsStart = function(lat, lng, name) {
    setStartPoint(lat, lng, name);
    map.flyTo([lat, lng], 14, { animate: true, duration: 1.0 });
    // Switch to directions tab
    const dirTabTrigger = document.getElementById('tabDirectionsBtn');
    bootstrap.Tab.getInstance(dirTabTrigger)?.show() || new bootstrap.Tab(dirTabTrigger).show();
    showToast(`Origin set to: ${name}`, 'info');
};

window.focusLocation = function(lat, lng, name) {
    map.flyTo([lat, lng], 15, { animate: true, duration: 1.0 });
    L.popup()
        .setLatLng([lat, lng])
        .setContent(`<b>${escapeHtml(name)}</b><br>Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`)
        .openOn(map);
};

window.deleteLocation = async function(id) {
    try {
        const response = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadLocationHistory();
            showToast('Item deleted from history.', 'info');
        }
    } catch (err) {
        showToast('Failed to delete location.', 'danger');
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ----------------- Event Handlers -----------------

// Search events
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});

searchInput.addEventListener('input', (e) => {
    clearSearchBtn.classList.toggle('d-none', !e.target.value);
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('d-none');
    searchResults.classList.add('d-none');
});

document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput && e.target !== searchBtn) {
        searchResults.classList.add('d-none');
    }
});

// Travel Mode Switcher
document.querySelectorAll('.travel-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.travel-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTravelMode = btn.getAttribute('data-mode');
        if (routingControl) calculateRoute();
    });
});

// Map Layer Switcher
document.querySelectorAll('.map-layer-opt').forEach(btn => {
    btn.addEventListener('click', () => {
        switchMapLayer(btn.getAttribute('data-layer'));
    });
});

// Route & Swap
calcRouteBtn.addEventListener('click', calculateRoute);
clearRouteBtn.addEventListener('click', clearRoute);
swapRouteBtn.addEventListener('click', swapRoutePoints);

// FABs
locateMeBtn.addEventListener('click', () => locateUser(true));
liveTrackingBtn.addEventListener('click', toggleLiveTracking);

// Collapse Panel
collapseCardBtn.addEventListener('click', () => {
    navigationCard.classList.toggle('panel-collapsed');
    const isCollapsed = navigationCard.classList.contains('panel-collapsed');
    collapseIcon.className = isCollapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up';
});

// Fullscreen
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

// Save Pin
saveCurrentBtn.addEventListener('click', () => {
    if (!currentCoords) {
        showToast('No GPS coordinates available yet.', 'warning');
        return;
    }
    const name = prompt('Enter a label for this bookmark:', 'Saved Place');
    if (name) {
        saveLocationToApi(name, currentCoords.lat, currentCoords.lng, 'previous', 'Manual bookmark');
        showToast('Pin saved to history!', 'success');
    }
});

// Clear History
clearHistoryBtn.addEventListener('click', async () => {
    if (!confirm('Clear all location history?')) return;
    try {
        await fetch('/api/locations/clear', { method: 'POST' });
        loadLocationHistory();
        showToast('History cleared.', 'info');
    } catch (err) {
        showToast('Error clearing history.', 'danger');
    }
});

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadLocationHistory();
});
