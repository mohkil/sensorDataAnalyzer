// src/views/UploadConfigureView.jsx
import React, { useCallback, useEffect } from 'react'; // Added useEffect
import { useAppContext } from '../contexts/AppContext.jsx';
import Modal from '../components/Modal/Modal.jsx';
import { detectAnalysisTypeFromFile } from '../services/fileParserService.js';
import { extractSensorNumberFromName, sortFileItemsBySensorNumber } from '../utils/fileNameUtils.js'; // Or .js if that's your extension

const UploadConfigureView = () => {
    const {
        config, // updateConfig, // Not directly used in this view for processing button
        addLogMessage,
        allUploadedFiles, // Not directly used here, but by categorize function
        gasFlowFile, // Not directly used here, but by categorize function
        categorizedFileItems, // IMPORTANT for enabling the button
        analysisType,         // IMPORTANT for enabling the button
        setCurrentStep,       // To change view
        setIsProcessing,      // To set processing state
        isProcessing,         // To disable button
        setProcessingLog,     // To clear previous logs
        setProgressBarValue,  // To reset progress bar
        setProcessingStatusMessage, // For overall status
        setProcessingSuccess,  // To indicate outcome
        // ... (other context values needed by other handlers)
        setAllUploadedFiles,
        setGasFlowFile,
        setCategorizedFileItems,
        setAnalysisType,
        showAnalysisTypeModal, setShowAnalysisTypeModal,
        analysisTypeModalMessage, setAnalysisTypeModalMessage,
        step1Status, setStep1Status,
        updateConfig // needed for config inputs
    } = useAppContext();

    // MAKE SURE THIS FUNCTION IS PRESENT AND CORRECT:
    const handleConfigChange = (event) => {
        const { name, value, type } = event.target;
        const newValue = type === 'number' ? parseFloat(value) : value;
        updateConfig({ [name]: newValue });
    };

    const finalizeAndCategorizeFilesAndUpdateState = (
        // ... (function as defined in Step 12.7.2)
        chosenType,
        dataFilesForCategorization,
        currentGasFlowFile
    ) => {
        addLogMessage(`Finalizing and categorizing files for ${chosenType} analysis...`);
        let tempCategorizedItems = [];
        dataFilesForCategorization.forEach(file => {
            const originalName = file.name;
            let itemType = null;
            let sensorNumberRaw = null;
            let sensorNumberDisplay = null;
            let effectiveNameForDisplay = originalName;
            if (chosenType === 'time_series') {
                const extractedNumRaw = extractSensorNumberFromName(originalName, false);
                if (extractedNumRaw !== null) {
                    sensorNumberRaw = extractedNumRaw;
                    sensorNumberDisplay = sensorNumberRaw + 1;
                    itemType = 'time_series';
                } else {
                    addLogMessage(`Skipping file (time_series analysis): '${originalName}' - could not extract sensor number.`, 'warn');
                }
            } else if (chosenType === 'spectroscopy') {
                const spectroscopyFormatMatch = originalName.match(/__IS_(\d{2}_\d{2}_\d{4} \d{2}_\d{2}_\d{2}(?:\.\d*)?)\.csv$/i);
                if (spectroscopyFormatMatch) {
                    itemType = 'spectroscopy';
                } else {
                    addLogMessage(`Skipping file (spectroscopy analysis): '${originalName}' - does not match spectroscopy naming pattern.`, 'warn');
                }
            }
            if (itemType === chosenType) {
                tempCategorizedItems.push({
                    originalFile: file,
                    effectiveName: effectiveNameForDisplay,
                    originalName,
                    sensorNumberRaw,
                    sensorNumberDisplay,
                    type: itemType
                });
            }
        });
        tempCategorizedItems = sortFileItemsBySensorNumber(tempCategorizedItems);
        setCategorizedFileItems(tempCategorizedItems);
        setAnalysisType(chosenType);
        let statusMessage = `Analysis type: ${chosenType.replace('_', ' ')}. Found ${tempCategorizedItems.length} relevant sensor files.`;
        if (chosenType === 'time_series') {
            if (currentGasFlowFile) {
                statusMessage += ` Gas flow table (${currentGasFlowFile.name}) present.`;
            } else {
                statusMessage += ` Gas flow table NOT found. Gas concentration analysis will be skipped.`;
            }
        }
        setStep1Status({ message: statusMessage, type: tempCategorizedItems.length > 0 ? 'info' : 'error' });
        addLogMessage(statusMessage, tempCategorizedItems.length > 0 ? 'info' : 'error');
    };


    const handleFileSelection = useCallback(async (event) => {
        // ... (full refined logic from Step 12.5.5 / your last working version for this)
        const selectedFiles = Array.from(event.target.files);
        if (selectedFiles.length === 0) {
            setStep1Status({ message: 'No files selected.', type: 'info' });
            event.target.value = null;
            return;
        }
        setAllUploadedFiles(selectedFiles);
        addLogMessage(`${selectedFiles.length} file(s) selected.`);
        setStep1Status({ message: `${selectedFiles.length} file(s) selected. Analyzing...`, type: 'info' });
        let identifiedGasFlowFile = null;
        const dataFiles = [];
        for (const file of selectedFiles) {
            if (file.name.toLowerCase() === 'gas_flow_table.csv') {
                identifiedGasFlowFile = file;
            } else {
                dataFiles.push(file);
            }
        }
        setGasFlowFile(identifiedGasFlowFile);
        if (identifiedGasFlowFile) {
            addLogMessage(`Gas flow table found: ${identifiedGasFlowFile.name}`);
        }
        if (dataFiles.length === 0) {
            if (identifiedGasFlowFile) {
                setStep1Status({ message: "Gas flow table found, but no sensor data files. Analysis type cannot be determined.", type: 'warning' });
            } else {
                setStep1Status({ message: "No data files selected. Please include sensor data or a gas flow table.", type: 'error' });
            }
            setAnalysisType(null);
            setCategorizedFileItems([]);
            event.target.value = null;
            return;
        }
        let potentialTimeSeriesFiles = [];
        let potentialSpectroscopyFiles = [];
        let otherFiles = [];
        dataFiles.forEach(file => {
            const lowerCaseName = file.name.toLowerCase();
            if (lowerCaseName.match(/__is_.*\.csv$/)) {
                potentialSpectroscopyFiles.push(file);
            } else if (
                (lowerCaseName.includes('vs_time') && lowerCaseName.endsWith('.csv')) ||
                (lowerCaseName.includes('vs_time') && lowerCaseName.match(/\.csv\d+$/))
            ) {
                potentialTimeSeriesFiles.push(file);
            } else {
                otherFiles.push(file);
            }
        });

        if (potentialTimeSeriesFiles.length > 0 && potentialSpectroscopyFiles.length > 0) {
            setAnalysisTypeModalMessage(`Mixed file types detected by name (${potentialTimeSeriesFiles.length} time-series, ${potentialSpectroscopyFiles.length} spectroscopy). Please choose an analysis type.`);
            setShowAnalysisTypeModal(true);
            setStep1Status({ message: "Mixed file types detected. Choose analysis type via modal.", type: 'info' });
            setAnalysisType(null);
            event.target.value = null;
            return;
        }

        let finalChosenType = null;
        if (potentialTimeSeriesFiles.length > 0) {
            const firstTimeSeriesFile = potentialTimeSeriesFiles[0];
            const detectedTypeByContent = await detectAnalysisTypeFromFile(firstTimeSeriesFile);
            if (detectedTypeByContent === 'time_series') {
                finalChosenType = 'time_series';
            } else {
                setAnalysisTypeModalMessage(`Files named like time-series, but content of '${firstTimeSeriesFile.name}' suggests ${detectedTypeByContent || 'an unknown type'}. Please choose an analysis type.`);
                setShowAnalysisTypeModal(true);
                setStep1Status({ message: "Ambiguous file content. Choose analysis type via modal.", type: 'warning' });
                setAnalysisType(null);
            }
        } else if (potentialSpectroscopyFiles.length > 0) {
            const firstSpectroscopyFile = potentialSpectroscopyFiles[0];
            const detectedTypeByContent = await detectAnalysisTypeFromFile(firstSpectroscopyFile);
            if (detectedTypeByContent === 'spectroscopy') {
                finalChosenType = 'spectroscopy';
            } else {
                setAnalysisTypeModalMessage(`Files named like spectroscopy, but content of '${firstSpectroscopyFile.name}' suggests ${detectedTypeByContent || 'an unknown type'}. Please choose an analysis type.`);
                setShowAnalysisTypeModal(true);
                setStep1Status({ message: "Ambiguous file content. Choose analysis type via modal.", type: 'warning' });
                setAnalysisType(null);
            }
        } else if (otherFiles.length > 0) {
            const firstDataFile = otherFiles[0];
            const detectedType = await detectAnalysisTypeFromFile(firstDataFile);
            if (detectedType) {
                finalChosenType = detectedType;
            } else {
                setStep1Status({ message: "Could not determine analysis type from the files provided. Please check names/contents.", type: 'error' });
                setAnalysisType(null);
            }
        } else {
            setStep1Status({ message: "No sensor data files found to determine analysis type.", type: 'warning' });
            setAnalysisType(null);
        }

        if (finalChosenType && !showAnalysisTypeModal) {
            finalizeAndCategorizeFilesAndUpdateState(finalChosenType, dataFiles, identifiedGasFlowFile);
        }
        event.target.value = null;
    }, [
        addLogMessage, setAllUploadedFiles, setGasFlowFile,
        setAnalysisType, setShowAnalysisTypeModal, setAnalysisTypeModalMessage,
        setStep1Status, setCategorizedFileItems, showAnalysisTypeModal
    ]);

    const handleModalChoice = (chosenType) => {
        setShowAnalysisTypeModal(false);

        // Use the 'allUploadedFiles' and 'gasFlowFile' variables
        // that are already in the component's scope from useAppContext()
        const dataFilesForCategorizationFromModal = allUploadedFiles.filter(
            f => !gasFlowFile || f.name !== gasFlowFile.name
        );

        finalizeAndCategorizeFilesAndUpdateState(chosenType, dataFilesForCategorizationFromModal, gasFlowFile);
        // The addLogMessage and setStep1Status calls were removed from here in my previous instruction
        // as finalizeAndCategorizeFilesAndUpdateState now handles status updates.
        // If you want a specific log for modal choice itself, add it:
        addLogMessage(`${chosenType.replace('_', ' ')} analysis selected via modal.`);
    };

    // NEW FUNCTION:
    const handleProcessData = () => {
        if (!analysisType || categorizedFileItems.length === 0) {
            addLogMessage("Cannot process data: No analysis type selected or no relevant files categorized.", "error");
            setStep1Status({ message: "Please select files and ensure an analysis type is determined before processing.", type: 'error'});
            return;
        }

        addLogMessage(`Starting ${analysisType.replace('_', ' ')} analysis...`, "info");
        setIsProcessing(true);
        setProcessingSuccess(null); // Reset success state
        setProcessingStatusMessage('Initializing processing...');
        setProcessingLog([]); // Clear any previous logs from other contexts if needed, or append
        addLogMessage('Gathering configuration...'); // First log for new processing
        setProgressBarValue(0); // Reset progress bar

        // Simulate gathering config (already in context.config)
        addLogMessage(`Experiment Name: ${config.experimentName}`);
        if (analysisType === 'time_series') {
            addLogMessage(`Target Gas: ${config.targetGasName}`);
            addLogMessage(`Initial Target Gas Concentration: ${config.gasConcCyl2} ppm`);
            addLogMessage(`Reference Time: ${config.refTimeStr}`);
        }
        // Add more config logging as needed

        // TODO: Here, we would normally trigger the actual data processing service/function
        // For now, we'll just simulate a delay and then move to the results step
        // to test the view transition. The actual processing logic will be Step 14.

        setCurrentStep('processing'); // Change to the processing view/step
    };

    // Determine if the process data button should be disabled
    const isProcessDataDisabled = isProcessing || !analysisType || categorizedFileItems.length === 0;


    return (
        <div className="step-view">
            {/* ... (H2, file input, config parameter groups as before) ... */}
            <div className="parameter-group">
                <label htmlFor="data-folder-input-react">Sensor Data Files (select one or more):</label>
                <input type="file" id="data-folder-input-react" multiple onChange={handleFileSelection} disabled={isProcessing} />
                <small> Select your sensor data files and `gas_flow_table.csv` if available.</small>
            </div>
            <h3>Configuration Parameters:</h3>
            <div className="parameter-group">
                <label htmlFor="experimentName">Experiment Name:</label>
                <input type="text" id="experimentName" name="experimentName" value={config.experimentName} onChange={handleConfigChange} disabled={isProcessing}/>
                <small>Add a short name for your experiment...</small>
            </div>
            <div className="parameter-group">
                <label htmlFor="targetGasName">Target Gas:</label>
                <input type="text" id="targetGasName" name="targetGasName" value={config.targetGasName} onChange={handleConfigChange} disabled={isProcessing}/>
                <small>Name of the target gas...</small>
            </div>
            <div className="parameter-group">
                <label htmlFor="gasConcCyl2">Initial Target Gas Concentration (ppm):</label>
                <input type="number" id="gasConcCyl2" name="gasConcCyl2" value={config.gasConcCyl2} onChange={handleConfigChange} step="any" disabled={isProcessing}/>
                <small>This is used if `gas_flow_table.csv` is found...</small>
            </div>
            <div className="parameter-group">
                <label htmlFor="refTimeStr">Reference Time for Signal Calculation (HH:MM:SS.s from data start):</label>
                <input type="text" id="refTimeStr" name="refTimeStr" value={config.refTimeStr} onChange={handleConfigChange} placeholder="HH:MM:SS.s" disabled={isProcessing}/>
                <small>Time point used to calculate the reference impedance...</small>
            </div>

            <button
                id="process-data-btn-react"
                onClick={handleProcessData}
                disabled={isProcessDataDisabled} // Use the state variable here
            >
                {isProcessing ? 'Processing...' : 'Process Data'}
            </button>
            <div id="processing-status-step1" className={`status-${step1Status.type}`}>
                {step1Status.message}
            </div>

            {/* ... (Modal component as before) ... */}
             <Modal
                isOpen={showAnalysisTypeModal}
                onClose={() => {
                    setShowAnalysisTypeModal(false);
                    setStep1Status({ message: "Modal closed without selection. Please re-select files or ensure clarity.", type: 'warning' });
                    setAnalysisType(null);
                }}
                title="Analysis Type Selection"
            >
                <p>{analysisTypeModalMessage}</p>
                <div className="modal-buttons">
                    <button onClick={() => handleModalChoice('time_series')} disabled={isProcessing}>
                        Analyze Time-Series
                    </button>
                    <button onClick={() => handleModalChoice('spectroscopy')} disabled={isProcessing}>
                        Analyze Spectroscopy
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default UploadConfigureView;