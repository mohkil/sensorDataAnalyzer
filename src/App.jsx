// src/App.jsx
import './App.css';
import { useAppContext } from './contexts/AppContext';
// We'll create these view components soon
// import UploadConfigureView from './views/UploadConfigureView';
// import ProcessingView from './views/ProcessingView';
// import ResultsView from './views/ResultsView';

function App() {
  const { currentStep } = useAppContext();

  const renderStep = () => {
    switch (currentStep) {
      case 'upload_config':
        // return <UploadConfigureView />;
        return <div>Step 1: Upload & Configure (To be built)</div>;
      case 'processing':
        // return <ProcessingView />;
        return <div>Step 2: Processing (To be built)</div>;
      case 'results':
        // return <ResultsView />;
        return <div>Step 3: Results (To be built)</div>;
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="AppContainer"> {/* Changed class name for clarity */}
      <header className="AppHeader">
        <h1>Sensor Data Analysis v3.0</h1>
        {/* 'About' button can be added here later */}
      </header>
      <main className="AppMainContent">
        {renderStep()}
      </main>
      <footer className="AppFooter">
        <p>For inquiries, contact M Kilani (m.kilani@unsw.edu.au)</p> {/* From original about-info */}
      </footer>
    </div>
  );
}

export default App;