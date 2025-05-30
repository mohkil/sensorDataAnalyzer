// src/services/timeSeriesAnalysisService.js
import { parseGasFlowFile } from './fileParserService.js';
import { parseCsvFile } from './fileParserService.js'; // Will be used by processAllTimeSeriesFiles
import { calculateGasConcVsTime, identifyGasExposureEvents, interpolateGasConcentration } from '../utils/gasCalculations.js';
import { timeStringToMinutes, parseCustomDateTime } from '../utils/dateTimeUtils.js';

// Helper function to simulate progress updates (can be more sophisticated later)
const updateOverallProgress = (current, total, setProgressBarValue) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    setProgressBarValue(Math.min(100, Math.max(0, percentage)));
};


/**
 * Orchestrates the entire time-series data analysis process.
 * @param {Array<Object>} categorizedTimeSeriesFiles - Files identified for time-series analysis.
 * @param {File|null} gasFlowFileObject - The gas_flow_table.csv file, if present.
 * @param {Object} currentConfig - The application configuration.
 * @param {Function} addLogMsg - Function to add messages to the processing log.
 * @param {Function} setProgressVal - Function to update the progress bar value.
 * @param {Function} setTimeSeriesDataResult - Function to set the final processed time-series data.
 * @param {Function} setGasConcProfileResult - Function to set the calculated gas concentration profile.
 * @param {Function} updateAppConfig - Function to update parts of the global config (e.g., gasExposureEvents).
 * @returns {Promise<boolean>} True if processing was successful, false otherwise.
 */
export async function runTimeSeriesAnalysis(
    categorizedTimeSeriesFiles,
    gasFlowFileObject,
    currentConfig,
    addLogMsg,
    setProgressVal,
    setTimeSeriesDataResult,
    setGasConcProfileResult,
    updateAppConfig // For updating config.gasExposureEvents
) {
    addLogMsg('Starting Time-Series Analysis Orchestration...');
    let overallStep = 0;
    // Estimate total steps: 1 for config, (2 for gas flow if present), N for sensor files
    let totalOverallSteps = 1 + categorizedTimeSeriesFiles.length + (gasFlowFileObject ? 2 : 0);
    updateOverallProgress(overallStep, totalOverallSteps, setProgressVal);

    try {
        // --- Step 1 (from original app.js): Process Gas Flow Table (if present) ---
        let calculatedGasConcProfile = [];
        let gasExposureEvents = [];
        let gasFlowSuccessfullyProcessed = !gasFlowFileObject; // True if no file to process

        if (gasFlowFileObject) {
            addLogMsg(`Parsing gas flow table: ${gasFlowFileObject.name}...`);
            try {
                const parsedGasFlow = await parseGasFlowFile(gasFlowFileObject); // From fileParserService
                addLogMsg('Gas flow table parsed. Calculating concentration profile...');
                overallStep++; updateOverallProgress(overallStep, totalOverallSteps, setProgressVal);

                // Ensure config values are numbers for calculation
                const configForCalc = {
                    ...currentConfig,
                    gasConcCyl2: parseFloat(currentConfig.gasConcCyl2),
                    totalFlowrate: parseFloat(currentConfig.totalFlowrate)
                };
                if (isNaN(configForCalc.gasConcCyl2)) {
                     throw new Error("Invalid 'Initial Target Gas Concentration' for gas profile calculation.");
                }


                calculatedGasConcProfile = calculateGasConcVsTime(parsedGasFlow, configForCalc); // From gasCalculations.js
                setGasConcProfileResult(calculatedGasConcProfile); // Update context
                addLogMsg('Gas concentration profile calculated.');

                gasExposureEvents = identifyGasExposureEvents(calculatedGasConcProfile); // From gasCalculations.js
                updateAppConfig({ gasExposureEvents: gasExposureEvents }); // Update config in context
                addLogMsg(`Identified ${gasExposureEvents.length} gas exposure events.`);
                overallStep++; updateOverallProgress(overallStep, totalOverallSteps, setProgressVal);
                gasFlowSuccessfullyProcessed = true;
            } catch (gasError) {
                addLogMsg(`Error processing gas flow table: ${gasError.message}`, 'error');
                // Decide if this is a fatal error or if sensor processing can continue without gas profile
                // For now, let's allow sensor processing to continue but log the error.
                // Set empty profiles/events if gas flow processing fails
                setGasConcProfileResult([]);
                updateAppConfig({ gasExposureEvents: [] });
                gasFlowSuccessfullyProcessed = false; // Mark as failed
            }
        } else {
            addLogMsg('No gas flow table provided. Gas concentration analysis will be skipped.');
            setGasConcProfileResult([]); // Ensure it's empty
            updateAppConfig({ gasExposureEvents: [] }); // Ensure it's empty
        }
        overallStep++; updateOverallProgress(overallStep, totalOverallSteps, setProgressVal);


        // --- Step 2 (from original multisensor.js): Process individual sensor files ---
        addLogMsg(`Processing ${categorizedTimeSeriesFiles.length} time-series sensor files...`);
        const refTimeMinutes = timeStringToMinutes(currentConfig.refTimeStr);
        if (isNaN(refTimeMinutes)) {
            throw new Error(`Invalid Baseline Time format: "${currentConfig.refTimeStr}". Please use HH:MM:SS.s or MM:SS.s.`);
        }

        const processedSensorDataTables = await processAllTimeSeriesFiles(
            categorizedTimeSeriesFiles,
            currentConfig,
            refTimeMinutes,
            calculatedGasConcProfile, // Pass the profile (even if empty)
            gasFlowSuccessfullyProcessed, // Indicates if gas concentration data is reliable/available
            addLogMsg,
            (completedSensorFiles) => { // Progress callback for sensor files
                updateOverallProgress(overallStep + completedSensorFiles, totalOverallSteps, setProgressVal);
            }
        );

        setTimeSeriesDataResult(processedSensorDataTables);
        addLogMsg('All time-series sensor files processed successfully.');
        overallStep = totalOverallSteps; // Mark as complete
        updateOverallProgress(overallStep, totalOverallSteps, setProgressVal);

        return true; // Indicate success

    } catch (error) {
        addLogMsg(`Error during time-series analysis: ${error.message}`, 'error');
        console.error("Time-Series Analysis Error:", error);
        return false; // Indicate failure
    }
}

/**
 * Processes all individual time-series sensor files.
 * Migrated from multisensor.js's processTimeSeriesSensorFilesInternal logic.
 */
async function processAllTimeSeriesFiles(
    timeSeriesFileItems, // categorizedFileItems
    config,
    refTimeMinutes,
    gasConcProfile, // The calculated profile from runTimeSeriesAnalysis
    gasConcAvailable, // Boolean indicating if gasConcProfile is valid/available
    addLogMsg,
    reportSensorFileProgress // Callback: (completedCount) => void
) {
    const sensorDataTablesResult = [];
    let t0Milliseconds = null; // To be determined by the first timestamp in the first file processed OR per file?
                               // Original multisensor.js determined t0 per file. Let's stick to that.

    for (let i = 0; i < timeSeriesFileItems.length; i++) {
        const fileItem = timeSeriesFileItems[i];
        const file = fileItem.originalFile;
        const effectiveFileName = fileItem.effectiveName || file.name; // Use effectiveName if available
        const sensorNumberDisplay = fileItem.sensorNumberDisplay;

        addLogMsg(`Processing Time-Series File: ${effectiveFileName}...`);

        let rawDataArray;
        try {
            rawDataArray = await parseCsvFile(file, false); // Time-series files typically have no header
        } catch (parseError) {
            addLogMsg(`Skipping ${effectiveFileName}: Failed to parse CSV - ${parseError.message}`, 'warn');
            reportSensorFileProgress(i + 1);
            continue;
        }

        if (!rawDataArray || rawDataArray.length === 0) {
            addLogMsg(`Skipping ${effectiveFileName}: File is empty or parsing yielded no data.`, 'warn');
            reportSensorFileProgress(i + 1);
            continue;
        }

        const timeColIdx = 0;
        const impedanceColIdx = 7; // Original: Z is column 7
        const phaseColIdx = 8;     // Original: ANGLE is column 8
        const minRequiredCols = Math.max(timeColIdx, impedanceColIdx, phaseColIdx) + 1;

        if (!rawDataArray[0] || rawDataArray[0].length < minRequiredCols) {
            addLogMsg(`Skipping ${effectiveFileName}: Insufficient columns in first data row (expected ${minRequiredCols}, got ${rawDataArray[0] ? rawDataArray[0].length : 0}).`, 'error');
            reportSensorFileProgress(i + 1);
            continue; // Skip this file
        }

        const t0String = rawDataArray[0][timeColIdx];
        const t0Date = parseCustomDateTime(t0String); // from dateTimeUtils
        const currentFileT0Milliseconds = t0Date ? t0Date.getTime() : NaN;

        if (isNaN(currentFileT0Milliseconds)) {
            addLogMsg(`Warning: Initial timestamp "${t0String}" in ${effectiveFileName} could not be parsed. Relative time calculations for this file will be NaN.`, 'warn');
        }

        const processedTable = rawDataArray.map((row, rowIndex) => {
            if (row.length < minRequiredCols) {
                // This case should ideally be caught by the check above, but as a safeguard per row:
                addLogMsg(`Warning: Row ${rowIndex + 1} in ${effectiveFileName} has insufficient columns. Data for this row will be NaN.`, 'warn');
                return {
                    original_time_s: (row && row.length > timeColIdx) ? row[timeColIdx] : "Invalid Row",
                    time_s: NaN, time_min: NaN, impedance: NaN, phase: NaN, signal: NaN, gas_concentration: NaN
                };
            }
            const currentDateString = row[timeColIdx];
            const currentDate = parseCustomDateTime(currentDateString);
            const currentMilliseconds = currentDate ? currentDate.getTime() : NaN;

            let relative_time_s = NaN;
            if (!isNaN(currentMilliseconds) && !isNaN(currentFileT0Milliseconds)) {
                relative_time_s = (currentMilliseconds - currentFileT0Milliseconds) / 1000;
            }
            const time_min = relative_time_s / 60;

            return {
                original_time_s: currentDateString,
                time_s: relative_time_s,
                time_min: time_min,
                impedance: parseFloat(row[impedanceColIdx]),
                phase: parseFloat(row[phaseColIdx]),
                signal: NaN, // To be calculated
                gas_concentration: NaN // To be calculated
            };
        });

        // Calculate reference impedance (imp_ref)
        let refIdx = -1;
        // Find the last point at or before refTimeMinutes
        const suitablePointsForRef = processedTable.filter(row => !isNaN(row.time_min) && row.time_min <= refTimeMinutes);
        if (suitablePointsForRef.length > 0) {
            // Get the index of the last suitable point in the original processedTable
            // This is a bit inefficient but ensures we get the correct object reference for indexOf
            const lastSuitablePoint = suitablePointsForRef[suitablePointsForRef.length - 1];
            refIdx = processedTable.findIndex(p => p === lastSuitablePoint);
        } else if (processedTable.length > 0 && !isNaN(processedTable[0].time_min)) {
            // Fallback: use the first valid data point if no points before refTimeMinutes
            refIdx = 0;
            addLogMsg(`For ${effectiveFileName}, no data points found at or before reference time. Using first valid data point for baseline.`, 'warn');
        }

        const imp_ref = (refIdx !== -1 && processedTable[refIdx] && !isNaN(processedTable[refIdx].impedance))
                        ? processedTable[refIdx].impedance
                        : NaN;

        if (isNaN(imp_ref)) {
            addLogMsg(`Reference impedance (imp_ref) for ${effectiveFileName} is NaN. Signal calculation will result in NaN.`, 'warn');
        }

        // Calculate signal and interpolate gas concentration for each row
        processedTable.forEach(row => {
            if (!isNaN(imp_ref) && imp_ref !== 0 && !isNaN(row.impedance)) {
                row.signal = ((row.impedance - imp_ref) / imp_ref) * 100;
            } else {
                row.signal = NaN;
            }

            // Filter out extreme values as per original logic
            if (row.impedance > 1e12) row.impedance = NaN; // [cite: 369] (approx)
            if (Math.abs(row.signal) > 1e4) row.signal = NaN; // (approx)


            if (gasConcAvailable && gasConcProfile.length > 0 && !isNaN(row.time_min)) {
                row.gas_concentration = interpolateGasConcentration(gasConcProfile, row.time_min); //
            } else {
                row.gas_concentration = NaN;
            }
        });

        sensorDataTablesResult.push({
            fileName: effectiveFileName, // This was effectiveName in original app.js, then sensorTable.fileName in multisensor.js
            originalFileName: file.name,
            sensorNumber: sensorNumberDisplay,
            data: processedTable
        });
        addLogMsg(`Processing ${effectiveFileName}: Completed.`);
        reportSensorFileProgress(i + 1); // Report progress after each file
    }
    return sensorDataTablesResult;
}