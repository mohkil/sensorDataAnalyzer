// src/App.jsx
import './App.css';
import { useAppContext } from './contexts/AppContext.jsx';
import UploadConfigureView from './views/UploadConfigureView.jsx';
import ProcessingView from './views/ProcessingView.jsx';
import ResultsView from './views/ResultsView.jsx'; // Import the new view

function App() {
  const { currentStep } = useAppContext();

  const renderStep = () => {
    switch (currentStep) {
      case 'upload_config':
        return <UploadConfigureView />;
      case 'processing':
        return <ProcessingView />;
      case 'results':
        return <ResultsView />; // Render the actual view
      default:
        return <div>Unknown step: {currentStep}</div>; // Show currentStep if unknown
    }
  };

  // ... (rest of App.jsx as before) ...
    return (
        <div className="AppContainer">
          <header className="AppHeader">
            <h1>Sensor Data Analysis v3.0</h1>
          </header>
          <main className="AppMainContent">
            {renderStep()}
          </main>
          <footer className="AppFooter">
            <p>For inquiries, contact M Kilani (m.kilani@unsw.edu.au)</p>
          </footer>
        </div>
    );
}

export default App;