import { useState, useEffect } from 'react'
import './App.css'
import NivellementForm from './components/NivellementForm'
import NivellementList from './components/NivellementList'
import { Nivellement } from './models/types'
import { loadNivellements, loadNivellement } from './utils/storage'

const App = () => {
  const [nivellements, setNivellements] = useState<Nivellement[]>([])
  const [selectedNivellementId, setSelectedNivellementId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState<boolean>(false)
  const [selectedNivellement, setSelectedNivellement] = useState<Nivellement | undefined>(undefined)
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true)

  // Nivellements beim Start laden
  useEffect(() => {
    loadNivellementData()
  }, [])

  const loadNivellementData = () => {
    const data = loadNivellements()
    setNivellements(data)
  }

  const handleSelectNivellement = (id: string) => {
    const nivellement = loadNivellement(id)
    setSelectedNivellementId(id)
    setSelectedNivellement(nivellement || undefined)
    setShowForm(true)
  }

  const handleNewNivellement = () => {
    setSelectedNivellementId(null)
    setSelectedNivellement(undefined)
    setShowForm(true)
  }

  const handleSaveNivellement = (id: string) => {
    loadNivellementData()
    setSelectedNivellementId(id)
    setShowForm(false)
  }

  const handleDeleteNivellement = () => {
    loadNivellementData()
    if (selectedNivellementId) {
      setSelectedNivellementId(null)
      setSelectedNivellement(undefined)
      setShowForm(false)
    }
  }

  return (
    <div className="app-container">
      {showDisclaimer && (
        <div className="disclaimer-alert">
          <div className="disclaimer-content">
            <h3>Wichtiger Hinweis</h3>
            <p>Diese Anwendung befindet sich in der Entwicklung. Es wird keine Haftung oder Gewähr für die Nutzung übernommen.</p>
            <p>Alle eingegebenen Daten werden ausschließlich im lokalen Speicher (localStorage) Ihres Browsers gespeichert und nicht an Server übertragen.</p>
            <button onClick={() => setShowDisclaimer(false)}>Verstanden</button>
          </div>
        </div>
      )}
      
      <header className="app-header">
        <h1>Nivellement-Berechnung</h1>
      </header>

      <main className="app-content">
        {showForm ? (
          <div className="form-view">
            <button className="back-button" onClick={() => setShowForm(false)}>
              Zurück zur Übersicht
            </button>
            <NivellementForm
              initialNivellement={selectedNivellement}
              onSave={handleSaveNivellement}
            />
          </div>
        ) : (
          <div className="list-view">
            <NivellementList
              nivellements={nivellements}
              onSelect={handleSelectNivellement}
              onDelete={handleDeleteNivellement}
              onNewNivellement={handleNewNivellement}
              onRefresh={loadNivellementData}
            />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>&copy; 2024 Leon Hollmann - Entwickelt zu privaten Lernzwecken - Keine Haftung übernommen</p>
      </footer>
    </div>
  )
}

export default App
