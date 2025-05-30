// src/services/spectroscopyAnalysisService.js
import { parseSpectroscopyFile } from './fileParserService.js'; // We created this earlier

// Helper function to simulate progress updates
const updateOverallProgress = (current, total, setProgressBarValue) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    setProgressBarValue(Math.min(100, Math.max(0, percentage)));
};

/**
 * Orchestrates the entire impedance spectroscopy data analysis process.
 * @param {Array<Object>} categorizedSpectroscopyFiles - Files identified for spectroscopy analysis.
 * @param {Object} currentConfig - The application configuration (not heavily used by spectroscopy in original).
 * @param {Function} addLogMsg - Function to add messages to the processing log.
 * @param {Function} setProgressVal - Function to update the progress bar value.
 * @param {Function} setSpectroscopyDataResult - Function to set the final processed spectroscopy data.
 * @returns {Promise<boolean>} True if processing was successful, false otherwise.
 */
export async function runSpectroscopyAnalysis(
    categorizedSpectroscopyFiles,
    currentConfig, // Kept for consistency, though original spectroscopy didn't use much from main config
    addLogMsg,
    setProgressVal,
    setSpectroscopyDataResult
) {
    addLogMsg('Starting Spectroscopy Analysis Orchestration...');
    let overallStep = 0;
    let totalOverallSteps = categorizedSpectroscopyFiles.length; // Main steps are per file
    updateOverallProgress(overallStep, totalOverallSteps, setProgressVal);

    try {
        if (!categorizedSpectroscopyFiles || categorizedSpectroscopyFiles.length === 0) {
            addLogMsg('No spectroscopy files to process.', 'warn');
            setSpectroscopyDataResult([]); // Ensure it's empty
            return true; // No files is not an error in itself for this path
        }

        addLogMsg(`Processing ${categorizedSpectroscopyFiles.length} spectroscopy sensor files...`);

        const processedSpectroscopyCollections = await processAllSpectroscopyFiles(
            categorizedSpectroscopyFiles,
            addLogMsg,
            (completedFiles) => { // Progress callback
                updateOverallProgress(completedFiles, totalOverallSteps, setProgressVal);
            }
        );

        setSpectroscopyDataResult(processedSpectroscopyCollections);
        addLogMsg('All spectroscopy sensor files processed successfully.');
        // overallStep = totalOverallSteps; // Mark as complete by progress callback
        // updateOverallProgress(overallStep, totalOverallSteps, setProgressVal); // Ensure 100%

        return true; // Indicate success

    } catch (error) {
        addLogMsg(`Error during spectroscopy analysis: ${error.message}`, 'error');
        console.error("Spectroscopy Analysis Error:", error);
        setSpectroscopyDataResult([]); // Clear data on error
        return false; // Indicate failure
    }
}

/**
 * Processes all individual impedance spectroscopy files.
 * Migrated from impedanceSpectroscopy.js's processAllSpectroscopyFilesInternal logic.
 * Original source: [266-273]
 */
async function processAllSpectroscopyFiles(
    spectroscopyFileItems, // categorizedFileItems of type 'spectroscopy'
    addLogMsg,
    reportFileProgress // Callback: (completedCount) => void
) {
    const allProcessedData = [];
    let t0Milliseconds = null; // For calculating relativeTimeMin

    for (let i = 0; i < spectroscopyFileItems.length; i++) {
        const fileItem = spectroscopyFileItems[i];
        // effectiveName is important for spectroscopy as it might not have sensor numbers
        const effectiveFileName = fileItem.effectiveName || fileItem.originalName;

        addLogMsg(`Processing spectroscopy file: ${effectiveFileName}...`);

        // parseSpectroscopyFile is already in fileParserService.js
        // It expects (fileObject, effectiveName)
        const parsedData = await parseSpectroscopyFile(fileItem.originalFile, effectiveFileName);

        if (parsedData && parsedData.timestamp) {
            if (t0Milliseconds === null) {
                t0Milliseconds = parsedData.timestamp.getTime();
            }
            const relativeTimeMs = parsedData.timestamp.getTime() - t0Milliseconds;
            const relativeTimeMin = relativeTimeMs / (1000 * 60);

            allProcessedData.push({
                ...parsedData, // includes fileName, effectiveName, timestamp, frequencies, impedances, phases
                relativeTimeMin: relativeTimeMin
            });
            addLogMsg(`Completed processing: ${effectiveFileName}`);
        } else {
            addLogMsg(`Skipped or failed to parse: ${effectiveFileName}`, 'warn');
        }
        reportFileProgress(i + 1); // Report progress after each file
    }

    // Sort by relativeTimeMin, as per original logic [cite: 273]
    allProcessedData.sort((a, b) => a.relativeTimeMin - b.relativeTimeMin);
    return allProcessedData;
}