## ☁️ ** GITHUB SYNC - VOLLSTÄNDIG IMPLEMENTIERT**

### Wie es funktioniert:

**Speichert über GitHub Gists:**
- Favoriten
- Verlauf (letzte 50 Einträge)
- Hörstatistiken

**Features:**
- ✅ Private Gists (nicht öffentlich sichtbar)
- ✅ Automatisches Merging (local + cloud)
- ✅ Konfliktauflösung (neuere Einträge gewinnen)
- ✅ Sichere Token-Speicherung in localStorage
- ✅ Auto-Sync nach Änderungen (5s debounced)
- ✅ Manueller Sync-Button

---

## 🚀 **Setup-Anleitung für GitHub Sync:**

### Schritt 1: GitHub Token erstellen

1. Öffne: https://github.com/settings/tokens/new
2. Beschreibung: "Brummies Radio Sync"
3. Wähle **nur** `gist` Berechtigung ✓
4. Klicke "Generate token"
5. **Token kopieren** (wird nur einmal angezeigt!)

### Schritt 2: In der App verbinden

1. Öffne App → Settings (☰)
2. Scrolle zu "☁️ Cloud Sync"
3. Token in das Feld einfügen
4. Klicke "Mit GitHub verbinden"
5. ✅ Verbunden!

### Schritt 3: Automatische Synchronisation

Ab jetzt:
- **Auto-Sync:** Jede Änderung an Favoriten/Verlauf wird nach 5s automatisch hochgeladen
- **Multi-Device:** Öffne die App auf einem anderen Gerät, verbinde mit demselben Token → Daten werden gemerged!
- **Manuell:** Klicke jederzeit "Jetzt synchronisieren"

---

## 🔒 **Sicherheit:**

**Token-Berechtigungen:**
- Nur `gist` - kann NICHTS ANDERES in deinem GitHub-Account
- Kein Zugriff auf Code, Repos, oder persönliche Daten
- Kann nur Gists erstellen/lesen

**Daten-Speicherung:**
- Token wird nur in deinem Browser (localStorage) gespeichert
- Nie an externe Server außer GitHub API gesendet
- Gist ist **private** - nur du kannst ihn sehen

**Token widerrufen:**
- Gehe zu: https://github.com/settings/tokens
- Lösche das Token → Sync funktioniert nicht mehr

---

## 📊 **Was wird synchronisiert:**

```json
{
  "favorites": [
    "https://stream1.example.com",
    "https://stream2.example.com"
  ],
  "history": [
    {
      "timestamp": "2026-02-19T...",
      "action": "🎵 Wechsel zu",
      "station": { ... }
    }
  ],
  "listeningStats": {
    "Rock Antenne": {
      "totalTime": 3600,
      "sessions": 5
    }
  },
  "timestamp": "2026-02-19T..."
}
```

---

## 🎯 **Verwendung auf mehreren Geräten:**

### Szenario: PC + iPhone

**PC (Gerät 1):**
1. App öffnen
2. GitHub verbinden (Token eingeben)
3. Favorit hinzufügen → Auto-Sync nach 5s
4. Gist wird erstellt

**iPhone (Gerät 2):**
1. App öffnen
2. GitHub verbinden (DASSELBE Token)
3. Beim Verbinden werden Daten automatisch geladen
4. PC-Favorit ist jetzt auch auf iPhone ✓
5. iPhone-Favorit hinzufügen → Auto-Sync
6. Zurück zum PC → Klicke "Jetzt synchronisieren"
7. iPhone-Favorit ist jetzt auch auf PC ✓

**Merging:**
- Beide Geräte haben jetzt alle Favoriten
- Duplikate werden automatisch entfernt
- Neueste Version gewinnt bei Konflikten

---