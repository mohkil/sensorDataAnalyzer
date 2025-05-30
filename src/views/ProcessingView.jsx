// src/views/ProcessingView.jsx
import React, { useEffect, useState } from 'react';
import { useAppContext } from '../contexts/AppContext.jsx';
import { runTimeSeriesAnalysis } from '../services/timeSeriesAnalysisService.js';
import { runSpectroscopyAnalysis } from '../services/spectroscopyAnalysisService.js'; // Import new service
import './ProcessingView.css';

const ProcessingView = () => {
    const {
        // ... (all existing context values needed by time-series and common UI)
        processingLog, addLogMessage,
        progressBarValue, setProgressBarValue,
        processingStatusMessage, setProcessingStatusMessage,
        processingSuccess, setProcessingSuccess,
        analysisType,
        config, updateConfig,
        categorizedFileItems,
        gasFlowFile, // Less relevant for spectroscopy but part of context
        setCurrentStep,
        setIsProcessing,
        setTimeSeriesData,
        setSpectroscopyData, // Now this will be used
        setGasConcProfile
    } = useAppContext();

    const [analysisStarted, setAnalysisStarted] = useState(false);

    useEffect(() => {
        const performAnalysis = async () => {
            if (analysisType === 'time_series') {
                // ... (existing time-series logic - keep as is)
                addLogMessage("ProcessingView: Kicking off time-series analysis...");
                const success = await runTimeSeriesAnalysis(
                    categorizedFileItems.filter(item => item.type === 'time_series'),
                    gasFlowFile,
                    config,
                    addLogMessage,
                    setProgressBarValue,
                    setTimeSeriesData,
                    setGasConcProfile,
                    updateConfig
                );
                if (success) {
                    addLogMessage("Time-series analysis completed successfully.", "success");
                    setProcessingStatusMessage("Time-series analysis complete!");
                    setProcessingSuccess(true);
                    setTimeout(() => { setCurrentStep('results'); }, 1500);
                } else {
                    addLogMessage("Time-series analysis encountered an error.", "error");
                    setProcessingStatusMessage("Error during time-series analysis. Check log.");
                    setProcessingSuccess(false);
                }
            } else if (analysisType === 'spectroscopy') {
                addLogMessage("ProcessingView: Kicking off spectroscopy analysis..."); // Updated log
                const success = await runSpectroscopyAnalysis( // Call the new service
                    categorizedFileItems.filter(item => item.type === 'spectroscopy'),
                    config, // Pass config
                    addLogMessage,
                    setProgressBarValue,
                    setSpectroscopyData
                );
                if (success) {
                    addLogMessage("Spectroscopy analysis completed successfully.", "success");
                    setProcessingStatusMessage("Spectroscopy analysis complete!");
                    setProcessingSuccess(true);
                    setTimeout(() => {
                        setCurrentStep('results');
                    }, 1500);
                } else {
                    addLogMessage("Spectroscopy analysis encountered an error.", "error");
                    setProcessingStatusMessage("Error during spectroscopy analysis. Check log.");
                    setProcessingSuccess(false);
                }
            } else {
                addLogMessage("ProcessingView: No valid analysis type found for processing.", "error"); //
                setProcessingStatusMessage("Error: No analysis type selected for processing."); //
                setProcessingSuccess(false);
            }
            setIsProcessing(false);
        };

        if (!analysisStarted && categorizedFileItems.length > 0 && analysisType) { // Added analysisType check
            setAnalysisStarted(true);
            setIsProcessing(true);
            setProcessingSuccess(null);
            performAnalysis();
        }
    }, [
        analysisStarted, analysisType, categorizedFileItems, gasFlowFile, config,
        addLogMessage, setProgressBarValue, setTimeSeriesData, setGasConcProfile,
        setCurrentStep, setIsProcessing, setProcessingStatusMessage, setProcessingSuccess,
        updateConfig, setSpectroscopyData // Ensure setSpectroscopyData is in deps
    ]);

    // ... (return JSX for ProcessingView - no changes needed here)
    return (
        <div className="step-view processing-view">
            <h2>Step 2: Processing Progress</h2>
            <div id="progress-bar-container">
                <div id="progress-bar" style={{ width: `${progressBarValue}%` }} role="progressbar" aria-valuenow={progressBarValue} aria-valuemin="0" aria-valuemax="100">
                    {Math.round(progressBarValue)}%
                </div>
            </div>
            <div id="progress-log-container">
                <h3>Processing Log:</h3>
                <div id="progress-log">
                    {processingLog.map((logEntry, index) => (
                        <div key={index} className={`log-entry log-${logEntry.type}`}>
                            {logEntry.text}
                        </div>
                    ))}
                </div>
            </div>
            <div id="overall-progress-status" className={processingSuccess === true ? 'status-success' : processingSuccess === false ? 'status-error' : 'status-processing'}>
                {processingStatusMessage || (progressBarValue === 100 && processingSuccess !== false ? "Processing complete." : "Processing...")}
            </div>
        </div>
    );
};

export default ProcessingView;