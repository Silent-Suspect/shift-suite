import { useState, useEffect } from 'react'
import './App.css'

// Public URL (Safe to expose, password protected via Script itself)
const API_URL = "https://script.google.com/macros/s/AKfycbzwbZaDkU3PChn2xEmzrUQh8PQIQRDFuFe-iELJUsG5X-PDOIZXet5YjYiwa1zug54/exec";

function App() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [decodedResults, setDecodedResults] = useState([])
  const [stations, setStations] = useState([])

  // Settings State (persisted in localStorage)
  const [showSettings, setShowSettings] = useState(false)
  const [apiPassword, setApiPassword] = useState(() => localStorage.getItem('shift_api_pw') || '')
  const [useShortNames, setUseShortNames] = useState(() => localStorage.getItem('shift_pref_short') === 'true')

  const [statusMsg, setStatusMsg] = useState('')

  // 1. Data Loading with Password from Settings
  // Deduplicate helper with Quality Check
  const deduplicate = (list) => {
    const isValid = (val) => {
      const n = Number(String(val).replace(',', '.'));
      return !isNaN(n) && n !== 0 && Math.abs(n) < 180;
    };

    const map = new Map();
    list.forEach(item => {
      const existing = map.get(item.c);
      const itemHasGPS = isValid(item.lat) && isValid(item.lng);
      const existingHasGPS = existing && isValid(existing.lat) && isValid(existing.lng);

      // Keep existing if it has GPS, unless new one also has GPS (overwrite? usually last is best)
      // Strategy: If new one is valid, take it. If existing is valid and new is not, keep existing.
      if (!existing || (!existingHasGPS && itemHasGPS)) {
        map.set(item.c, item);
      } else if (existingHasGPS && itemHasGPS) {
        // Both valid - maybe update with newer? Let's take the last one in list (usually fresher from append)
        map.set(item.c, item);
      }
    });
    return Array.from(map.values());
  };

  useEffect(() => {
    // A) Try local cache first
    const cached = localStorage.getItem('shift_stations')
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setStations(deduplicate(parsed));
      } catch (e) { console.error(e) }
    }

    // B) Fetch if password exists
    if (apiPassword) {
      setStatusMsg('Lade Daten...')
      fetch(`${API_URL}?password=${encodeURIComponent(apiPassword)}`)
        .then(res => res.json())
        .then(response => {
          if (response.data) {
            const uniqueData = deduplicate(response.data);
            setStations(uniqueData)
            localStorage.setItem('shift_stations', JSON.stringify(uniqueData))
            setStatusMsg(`✅ Daten aktuell (${uniqueData.length} Stationen)`)
            setTimeout(() => setStatusMsg(''), 3000)
          } else if (response.error) {
            setStatusMsg('❌ Passwort falsch')
          }
        })
        .catch(() => setStatusMsg('❌ Offline / Fehler'))
    } else {
      setStatusMsg('🔒 Bitte Setup durchführen (Zahnrad)')
    }
  }, [apiPassword])

  // Save Settings
  const saveSettings = () => {
    localStorage.setItem('shift_api_pw', apiPassword)
    localStorage.setItem('shift_pref_short', useShortNames)
    setShowSettings(false)
    // Trigger re-fetch is handled by useEffect dependency on apiPassword
    window.location.reload() // Reload to force clean state and fetch
  }

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Decoder Logic (Updated for Shortnames)
  useEffect(() => {
    if (!searchQuery.trim() || stations.length === 0) {
      setDecodedResults([])
      return
    }

    const processTerm = (term) => {
      // 1. Exact Match
      const exact = stations.find(s => s.c === term)
      if (exact) {
        // Display Logic: Use ShortName if enabled AND available, else Name
        const displayName = (useShortNames && exact.s) ? exact.s : exact.n;
        return { code: term, name: displayName, found: true }
      }

      // 2. Loose Name Match
      if (term.length > 2) {
        const nameMatch = stations.find(s => s.n.toUpperCase().includes(term))
        if (nameMatch) {
          const displayName = (useShortNames && nameMatch.s) ? nameMatch.s : nameMatch.n;
          return { code: term, name: displayName + ` (${nameMatch.c})`, found: true }
        }
      }

      return { code: term, name: '?', found: false }
    }

    // Two-Stage Parsing (Hard Separators -> Split by Space)
    const chunks = searchQuery.toUpperCase().split(/[-+,>]+/).map(c => c.trim()).filter(c => c)
    let finalResults = []

    chunks.forEach(chunk => {
      const mainMatch = processTerm(chunk)
      if (mainMatch.found) {
        finalResults.push(mainMatch)
      } else {
        // Greedy Split Strategy
        const tokens = chunk.split(/\s+/).filter(s => s)
        if (tokens.length > 0) {
          let foundAny = false
          let i = 0
          while (i < tokens.length) {
            let bestMatch = null
            const baseMatch = processTerm(tokens[i])
            if (baseMatch.found) bestMatch = { m: baseMatch, c: 1 }

            let temp = tokens[i]
            for (let j = i + 1; j < tokens.length; j++) {
              temp += " " + tokens[j]
              const merged = processTerm(temp)
              if (merged.found) bestMatch = { m: merged, c: j - i + 1 }
            }

            if (bestMatch) {
              finalResults.push(bestMatch.m)
              foundAny = true
              i += bestMatch.c
            } else {
              finalResults.push(baseMatch)
              i++
            }
          }
          if (!foundAny) finalResults.push(mainMatch)
        } else {
          finalResults.push(mainMatch)
        }
      }
    })

    // 3. Calculate Distances
    const getDistance = (lat1, lon1, lat2, lon2) => {
      const l1 = Number(lat1), ln1 = Number(lon1), l2 = Number(lat2), ln2 = Number(lon2);
      if (!l1 || !ln1 || !l2 || !ln2) return 0;

      const R = 6371; // Radius of the earth in km
      const dLat = (l2 - l1) * (Math.PI / 180);
      const dLon = (ln2 - ln1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(l1 * (Math.PI / 180)) * Math.cos(l2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let lastValidStation = null;
    const resultsWithDist = finalResults.map(item => {
      if (!item.found) return item;

      const currentStation = stations.find(s => s.c === item.code);
      let dist = 0;

      // Simplified check: Rely on getDistance to handle missing/invalid values
      if (currentStation && currentStation.lat && lastValidStation) {
        dist = getDistance(lastValidStation.lat, lastValidStation.lng, currentStation.lat, currentStation.lng);
      }

      if (currentStation && currentStation.lat) {
        lastValidStation = currentStation;
      }

      // Debug: Log if something weird happens
      if (dist === NaN) dist = 0;

      return { ...item, dist: dist > 0 ? Math.round(dist) : null };
    });

    setDecodedResults(resultsWithDist)
  }, [searchQuery, stations, useShortNames])

  const tools = [
    { id: 'tracker', title: '⏱️ Tracker', desc: 'Live Zeiterfassung', url: 'https://silent-suspect.github.io/shift-tracker/', class: 'tracker-card' },
    { id: 'reporter', title: '📊 Auswertung', desc: 'Statistiken & PDF Export', url: 'https://silent-suspect.github.io/shift-reporter/', class: 'reporter-card' },
    { id: 'travel', title: '📒 Fahrtenbuch', desc: 'Protokoll aller Fahrten', url: 'https://silent-suspect.github.io/shift-travel-report/', class: 'travel-card' }
  ]

  // ... inside App component ...
  const [showManager, setShowManager] = useState(false)
  const [managerSearch, setManagerSearch] = useState('')
  const [filterMode, setFilterMode] = useState('missing') // 'all', 'missing', 'present'
  const [editData, setEditData] = useState({}) // { code: {lat, lng} }
  const [isSaving, setIsSaving] = useState(false)

  // Filter Stations for Manager
  const filteredStations = stations.filter(s => {
    const matchesSearch = managerSearch === '' ||
      s.c.includes(managerSearch.toUpperCase()) ||
      s.n.toUpperCase().includes(managerSearch.toUpperCase());

    let matchesFilter = true;
    if (filterMode === 'missing') matchesFilter = !s.lat || !s.lng;
    if (filterMode === 'present') matchesFilter = Boolean(s.lat && s.lng);

    return matchesSearch && matchesFilter;
  }).slice(0, 50); // Limit usage to avoid lag

  // Handle Input Change for GPS
  const handleEditChange = (code, field, value) => {
    setEditData(prev => ({
      ...prev,
      [code]: { ...prev[code], [field]: value }
    }))
  }

  // Save Station GPS
  const saveStation = (station) => {
    const edits = editData[station.c] || {};
    const newLat = edits.lat !== undefined ? edits.lat : (station.lat || '');
    const newLng = edits.lng !== undefined ? edits.lng : (station.lng || '');

    // Normalize Input (allow dot or comma)
    const latStr = String(newLat).trim().replace(',', '.');
    const lngStr = String(newLng).trim().replace(',', '.');

    let payloadLat = '';
    let payloadLng = '';

    // Validate Lat
    if (latStr !== '') {
      const n = parseFloat(latStr);
      if (isNaN(n)) { alert(`Lat für ${station.c} ist keine gültige Zahl!`); return; }
      payloadLat = parseFloat(n.toFixed(5));
    }

    // Validate Lng
    if (lngStr !== '') {
      const n = parseFloat(lngStr);
      if (isNaN(n)) { alert(`Lng für ${station.c} ist keine gültige Zahl!`); return; }
      payloadLng = parseFloat(n.toFixed(5));
    }

    // Confirm if BOTH are empty (Deletion)
    if (payloadLat === '' && payloadLng === '') {
      if (!window.confirm(`GPS Daten für ${station.c} wirklich löschen?`)) return;
    }

    setIsSaving(true);

    const payload = {
      password: apiPassword,
      code: station.c,
      lat: payloadLat,
      lng: payloadLng
    };

    fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Update Local State immediately
          const updatedStations = stations.map(s =>
            s.c === station.c ? { ...s, lat: payloadLat || null, lng: payloadLng || null } : s
          );
          setStations(updatedStations);
          localStorage.setItem('shift_stations', JSON.stringify(updatedStations));

          setStatusMsg(`✅ ${station.c} gespeichert`);
          setTimeout(() => setStatusMsg(''), 2000);

          // Clear Edit Data
          const newEdits = { ...editData };
          delete newEdits[station.c];
          setEditData(newEdits);
        } else {
          alert('Fehler: ' + data.error);
        }
        setIsSaving(false);
      })
      .catch(e => {
        console.error(e);
        alert('Speicher-Fehler: ' + e.message + '\nFalls "Failed to fetch", ist das Script evtl. alt? (Deploy -> New Version)');
        setIsSaving(false);
      });
  }

  return (
    <div className="app-container">
      {/* Settings Button */}
      <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙️</button>

      {/* Data Manager Button (Database Icon) */}
      <button className="manager-btn" onClick={() => setShowManager(true)}>🗄️</button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Einstellungen</h2>
            {/* ... existing settings form ... */}
            <div className="form-group">
              <label>API Passwort (Google Script)</label>
              <input
                type="password"
                value={apiPassword}
                onChange={e => setApiPassword(e.target.value)}
                placeholder="Dein Passwort..."
              />
            </div>

            <div className="form-check" onClick={() => setUseShortNames(!useShortNames)}>
              <input type="checkbox" checked={useShortNames} readOnly />
              <span>Kurznamen verwenden (Spalte C)</span>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={saveSettings}>Speichern & Neuladen</button>
            </div>
          </div>
        </div>
      )}

      {/* Data Manager Modal */}
      {showManager && (
        <div className="modal-overlay" onClick={() => setShowManager(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h2>Station Editor</h2>

            <input
              type="text"
              className="manager-search"
              placeholder="Suche (Code oder Name)..."
              value={managerSearch}
              onChange={e => setManagerSearch(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
              <label style={{ color: '#aaa', fontSize: '0.9rem' }}>Filter:</label>
              <select
                value={filterMode}
                onChange={e => setFilterMode(e.target.value)}
                style={{ padding: '0.5rem', background: '#111', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
              >
                <option value="missing">❗️ Nur fehlende GPS</option>
                <option value="present">✅ Nur vorhandene GPS</option>
                <option value="all">🌍 Alle Stationen</option>
              </select>
            </div>

            <div className="station-list">
              {filteredStations.map(s => {
                const edits = editData[s.c] || {};

                // Helper: Show formatted (rounded) value by default to allow cleaning dirty data
                const formatDefault = (val) => {
                  if (!val && val !== 0) return '';
                  const n = Number(val);
                  return isNaN(n) ? val : parseFloat(n.toFixed(5));
                };

                const latVal = edits.lat !== undefined ? edits.lat : formatDefault(s.lat);
                const lngVal = edits.lng !== undefined ? edits.lng : formatDefault(s.lng);

                // Check for changes (Comparing Input vs Raw Storage)
                const hasChanges = (editData[s.c]) || (String(latVal) !== String(s.lat) || String(lngVal) !== String(s.lng));

                return (
                  <div key={s.c} className="station-item">
                    <div className="station-header">
                      <span className="station-code">{s.c}</span>
                      <span>{s.n}</span>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginLeft: 'auto', marginRight: '0.5rem' }}>
                        {s.lat && s.lng ? `${s.lat} / ${s.lng}` : ''}
                      </div>
                      {!s.lat && <span className="missing-badge">GPS fehlt</span>}
                    </div>
                    <div className="station-coords">
                      <input
                        placeholder="Lat (z.B. 50.123)"
                        className="coord-input"
                        value={latVal}
                        onChange={e => handleEditChange(s.c, 'lat', e.target.value)}
                      />
                      <input
                        placeholder="Lng (z.B. 9.123)"
                        className="coord-input"
                        value={lngVal}
                        onChange={e => handleEditChange(s.c, 'lng', e.target.value)}
                      />
                      {hasChanges && (
                        <button className="save-btn" onClick={() => saveStation(s)} disabled={isSaving}>
                          {isSaving ? '...' : '💾'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredStations.length === 0 && <p style={{ textAlign: 'center', color: '#666' }}>Keine Stationen gefunden.</p>}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowManager(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      <div id="root">
        {/* ... existing header and dashboard content ... */}
        <header className="suite-header">
          <h1>Shift Suite</h1>
          <div className="live-clock">
            {/* Clock JSX */}
            <span className="time">
              {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              <span className="seconds">:{currentTime.getSeconds().toString().padStart(2, '0')}</span>
            </span>
            <span className="date">
              {currentTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
          </div>
        </header>

        <main className="dashboard-grid">

          {/* Decoder Widget */}
          <div className="decoder-widget">
            <input
              type="text"
              className="decoder-input"
              placeholder="CODE EINGEBEN (Z.B. EWANT-FFU)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="decoder-results">
              {decodedResults.length > 0 ? (
                decodedResults.map((fuel, idx) => {
                  const stn = stations.find(s => s.c === fuel.code);
                  const hasGPS = stn && stn.lat && stn.lng;

                  return (
                    <div key={idx} className={`result-item ${fuel.found ? '' : 'missing'}`}>
                      <span className="res-code">{fuel.code}</span>
                      <span className="arrow">➜</span>
                      <span className="res-name">{fuel.name}</span>

                      {/* Distance Badge */}
                      {fuel.dist !== null && fuel.dist > 0 && <span className="dist-badge">+{fuel.dist} km</span>}

                      {!hasGPS && fuel.found && (
                        <button
                          style={{ marginLeft: 'auto', fontSize: '0.8rem', background: 'none', border: '1px solid #444', color: '#aaa', borderRadius: '4px', cursor: 'pointer' }}
                          onClick={() => { setManagerSearch(fuel.code); setShowManager(true); }}
                        >
                          + GPS
                        </button>
                      )}
                    </div>
                  )
                })
              ) : (
                <div style={{ color: '#666', fontSize: '0.9rem', textAlign: 'center', padding: '0.5rem' }}>
                  {statusMsg || (stations.length > 0 ? `${stations.length} Stationen geladen` : 'Warte auf Daten...')}
                </div>
              )}
            </div>
          </div>

          {/* ... existing tools ... */}
          {/* Mileage Widget (Mock Data) */}
          <div className="status-widget km-widget">
            <div className="km-content">
              <span className="km-label">Gesamtstrecke</span>
              <div className="km-value-group">
                <span className="km-value">12.854</span>
                <span className="km-unit">km</span>
              </div>
              <div className="km-subtext">
                <span className="trend-up">▲ 420 km</span> diese Woche
              </div>
            </div>
            <div className="km-icon">🚂</div>
          </div>

          <div className="tools-grid">
            {tools.map(tool => (
              <a key={tool.id} href={tool.url} className={`card ${tool.class}`} target="_blank" rel="noreferrer">
                <h2>{tool.title}</h2>
                <p>{tool.desc}</p>
                <div className="open-icon">↗</div>
              </a>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
