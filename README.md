# Nivellement-Berechnung

Eine Webanwendung zur Berechnung und Verwaltung von Nivellements, entwickelt mit React und TypeScript.

## Entwicklungsumgebung einrichten

### Voraussetzungen
- Node.js (empfohlen: Version 18 oder höher)
- npm (wird mit Node.js installiert)

### Installation
```bash
# Repository klonen
git clone https://github.com/dein-username/Nivellement-Berechnung.git
cd Nivellement-Berechnung

# Abhängigkeiten installieren
npm install
```

## Entwicklungsbefehle

```bash
# Entwicklungsserver starten
npm run dev

# Codequalität prüfen
npm run lint

# Build für Produktion erstellen
npm run build

# Build lokal testen
npm run preview
```

## Deployment auf GitHub Pages

### Erstmaliges Einrichten
1. GitHub-Repository erstellen (falls noch nicht geschehen)
2. Lokales Git-Repository initialisieren und mit GitHub verbinden:
```bash
git init
git add .
git commit -m "Erster Commit"
git remote add origin https://github.com/dein-username/Nivellement-Berechnung.git
git branch -M main
git push -u origin main
```

3. GitHub Pages Abhängigkeit installieren:
```bash
npm install --save-dev gh-pages
```

4. In `package.json` die folgenden Einträge hinzufügen:
```json
"homepage": "https://dein-username.github.io/Nivellement-Berechnung",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

5. In `vite.config.ts` die Base-URL hinzufügen:
```typescript
export default defineConfig({
  plugins: [react()],
  base: '/Nivellement-Berechnung/',
})
```

### Deployment durchführen
```bash
# Änderungen zum GitHub-Repository hinzufügen
git add .
git commit -m "Beschreibung der Änderungen"
git push

# Auf GitHub Pages deployen
npm run deploy
```

### GitHub Pages Einstellungen
Nach dem ersten Deployment:
1. Gehe zu den Repository-Einstellungen
2. Wähle "Pages" im Menü
3. Setze als Source "Deploy from a branch"
4. Wähle den Branch "gh-pages" und den Ordner "/ (root)"
5. Klicke auf "Save"

## Git-Workflow

```bash
# Status prüfen
git status

# Änderungen hinzufügen
git add .

# Commit erstellen
git commit -m "Beschreibung der Änderungen"

# Änderungen hochladen
git push

# Aktuellen Stand vom Server holen
git pull
```

## Projektstruktur

- `src/` - Quellcode-Dateien
  - `components/` - React-Komponenten
  - `models/` - TypeScript-Typdefinitionen
  - `utils/` - Hilfsfunktionen
- `public/` - Statische Dateien
- `dist/` - Build-Ausgabe (wird beim Build generiert)

## Hinweis

Diese Anwendung wurde zu privaten Lernzwecken entwickelt und befindet sich noch in der Entwicklungsphase. Es wird keine Haftung oder Gewähr für die Nutzung übernommen.
