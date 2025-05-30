// src/contexts/AppContext.js
import React, { createContext, useState, useContext } from 'react';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
    const [currentStep, setCurrentStep] = useState('upload_config'); // 'upload_config', 'processing', 'results'
    const [analysisType, setAnalysisType] = useState(null); // 'time_series', 'spectroscopy', or null
    const [allUploadedFiles, setAllUploadedFiles] = useState([]); // Array of File objects
    const [categorizedFileItems, setCategorizedFileItems] = useState([]); // Processed file items for analysis
    const [gasFlowFile, setGasFlowFile] = useState(null); // Specific File object for gas_flow_table.csv
    const [config, setConfig] = useState({ // Default configuration values
        experimentName: "MyExperiment",
        targetGasName: "Target Gas",
        gasConcCyl2: 10, // Corresponds to 'gas-conc-cyl-2' in original HTML [cite: 156]
        refTimeStr: "0:55:00.0", // Corresponds to 'ref-time' in original HTML [cite: 156]
        // These were hardcoded or less prominent in the UI but part of logic
        gasConcPrecision: 1, // [cite: 96]
        totalFlowrate: 500, // [cite: 96]
        gasConcCyl1: 0, // [cite: 96]
        gasConcentrationLabel: "Target Gas concentration (ppm)" // Will be updated
    });
    const [processingLog, setProcessingLog] = useState([]); // Array of log messages/objects
    const [progressBarValue, setProgressBarValue] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatusMessage, setProcessingStatusMessage] = useState(''); // For overall status like "Processing complete!"
    const [processingSuccess, setProcessingSuccess] = useState(null); // true for success, false for error, null for idle
    

    // Placeholder for processed data - structure will depend on analysis type
    const [timeSeriesData, setTimeSeriesData] = useState([]); // Will hold data like original sensorDataTables
    const [spectroscopyData, setSpectroscopyData] = useState([]); // Will hold data like original spectroscopyDataCollections
    const [gasConcProfile, setGasConcProfile] = useState([]); // For the calculated gas concentration profile

    const [showAnalysisTypeModal, setShowAnalysisTypeModal] = useState(false); // New state
    const [analysisTypeModalMessage, setAnalysisTypeModalMessage] = useState(''); // New state
    const [step1Status, setStep1Status] = useState({ message: 'Please select data files and configure parameters to begin.', type: 'info' }); // New state for Step 1 status message
    const [plotTimeRange, setPlotTimeRange] = useState({ start: '', end: '' });
    const [isExporting, setIsExporting] = useState(false); 


    // Function to update config values
    const updateConfig = (newConfigValues) => {
        setConfig(prevConfig => ({ ...prevConfig, ...newConfigValues }));
    };

    // Function to add a log message
    const addLogMessage = (message, type = 'info') => {
        setProcessingLog(prevLog => [...prevLog, { text: `[${new Date().toLocaleTimeString()}] ${message}`, type }]);
    };

    const resetAppState = () => {
        setCurrentStep('upload_config');
        setAnalysisType(null);
        setAllUploadedFiles([]);
        setCategorizedFileItems([]);
        setGasFlowFile(null);
        setConfig({
            experimentName: "MyExperiment", // [cite: 155]
            targetGasName: "Target Gas", // [cite: 155]
            gasConcCyl2: 10, // [cite: 156]
            refTimeStr: "0:55:00.0", // [cite: 156]
            gasConcPrecision: 1,
            totalFlowrate: 500,
            gasConcCyl1: 0,
            gasConcentrationLabel: "Target Gas concentration (ppm)"
        });
        setProcessingLog([]);
        setProgressBarValue(0);
        setIsProcessing(false);
        setProcessingStatusMessage('');
        setProcessingSuccess(null);
        setTimeSeriesData([]);
        setSpectroscopyData([]);
        setGasConcProfile([]);
        setShowAnalysisTypeModal(false);
        setAnalysisTypeModalMessage('');
        setStep1Status({ message: 'Please select data files and configure parameters to begin.', type: 'info' });
        addLogMessage("Application reset. Please select files and configure parameters.");
        setPlotTimeRange({ start: '', end: '' }); 
        setIsExporting(false);
    };


    const value = {
        currentStep, setCurrentStep,
        analysisType, setAnalysisType,
        allUploadedFiles, setAllUploadedFiles,
        categorizedFileItems, setCategorizedFileItems,
        gasFlowFile, setGasFlowFile,
        config, updateConfig, // Use updateConfig to change specific config values
        processingLog, addLogMessage, setProcessingLog,
        progressBarValue, setProgressBarValue,
        isProcessing, setIsProcessing,
        processingStatusMessage, setProcessingStatusMessage,
        processingSuccess, setProcessingSuccess,
        timeSeriesData, setTimeSeriesData,
        spectroscopyData, setSpectroscopyData,
        gasConcProfile, setGasConcProfile,
        showAnalysisTypeModal, setShowAnalysisTypeModal,
        analysisTypeModalMessage, setAnalysisTypeModalMessage,
        step1Status, setStep1Status,
        plotTimeRange, setPlotTimeRange,
        isExporting, setIsExporting,
        resetAppState
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};