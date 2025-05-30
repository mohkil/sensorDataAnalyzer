// src/services/exportService.js
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import Plotly from 'plotly.js';

/**
 * Replaces NaN, Infinity, and -Infinity with a placeholder string for export.
 * @param {Array<Object>} data - The array of data objects to sanitize.
 * @returns {Array<Object>} The sanitized data.
 */
const sanitizeDataForExport = (data) => {
    const placeholder = "N/A"; // Use this string for invalid numbers
    return data.map(row => {
        const newRow = {};
        for (const key in row) {
            if (typeof row[key] === 'number' && !isFinite(row[key])) {
                newRow[key] = placeholder;
            } else {
                newRow[key] = row[key];
            }
        }
        return newRow;
    });
};

/**
 * Creates a pivoted data table as an array of arrays for spectroscopy export, ensuring column order.
 * @param {Array} spectroscopyData - The processed spectroscopy data.
 * @param {string} dataType - 'impedances' or 'phases'.
 * @param {Array<number>} uniqueFrequencies - A sorted array of unique frequencies.
 * @returns {Array<Array<any>>} The pivoted data ready for aoa_to_sheet.
 */
const createPivotedSheetAOA = (spectroscopyData, dataType, uniqueFrequencies) => {
    const valueKey = dataType === 'impedances' ? 'impedances' : 'phases';

    const headers = ['Time (min)', ...uniqueFrequencies];
    const dataRows = [headers];

    spectroscopyData.forEach(sweep => {
        const row = [];
        row.push(sweep.relativeTimeMin !== undefined && sweep.relativeTimeMin !== null ? sweep.relativeTimeMin.toFixed(4) : "N/A");

        uniqueFrequencies.forEach(freq => {
            const valueIndex = sweep.frequencies ? sweep.frequencies.indexOf(freq) : -1;
            if (valueIndex !== -1 && sweep[valueKey]) {
                const value = sweep[valueKey][valueIndex];
                row.push(isFinite(value) ? value : "N/A");
            } else {
                row.push("N/A");
            }
        });
        dataRows.push(row);
    });
    return dataRows;
};

/**
 * Prepares and exports data to an XLSX file.
 * @param {string} analysisType - 'time_series' or 'spectroscopy'.
 * @param {Array} timeSeriesData - The processed time-series data from AppContext.
 * @param {Array} spectroscopyData - The processed spectroscopy data from AppContext.
 * @param {Object} config - The application config for filenames.
 */
export const exportDataToXlsx = (analysisType, timeSeriesData, spectroscopyData, config) => {
    console.log("Attempting XLSX export for type:", analysisType);
    try {
        const wb = XLSX.utils.book_new();
        const experimentName = config.experimentName || 'Experiment';
        let sheetsAdded = 0;

        if (analysisType === 'time_series' && timeSeriesData && timeSeriesData.length > 0) {
            console.log("Exporting time-series data...");
            timeSeriesData.forEach(sensorTable => {
                if (sensorTable && sensorTable.data) {
                    const sheetName = `Sensor ${sensorTable.sensorNumber || 'Unknown'}`.substring(0, 31);
                    const sanitizedData = sanitizeDataForExport(sensorTable.data);
                    if (sanitizedData.length > 0) {
                        const ws = XLSX.utils.json_to_sheet(sanitizedData);
                        XLSX.utils.book_append_sheet(wb, ws, sheetName);
                        sheetsAdded++;
                        console.log(`Time-series sheet "${sheetName}" added.`);
                    } else {
                        console.warn(`No data to add for time-series sheet: ${sheetName}`);
                    }
                }
            });
        } else if (analysisType === 'spectroscopy' && spectroscopyData && spectroscopyData.length > 0) {
            console.log("Exporting spectroscopy data...");
            const freqSet = new Set();
            spectroscopyData.forEach(sweep => {
                if (sweep && sweep.frequencies && Array.isArray(sweep.frequencies)) {
                    sweep.frequencies.forEach(f => freqSet.add(f));
                }
            });
            const uniqueFrequencies = Array.from(freqSet).sort((a, b) => a - b);
            console.log("Unique frequencies for spectroscopy export:", uniqueFrequencies);

            if (spectroscopyData.some(s => s && s.relativeTimeMin !== undefined)) { // Ensure there's some data to pivot
                console.log("Creating impedance sheet...");
                const impedanceAOA = createPivotedSheetAOA(spectroscopyData, 'impedances', uniqueFrequencies);
                if (impedanceAOA.length > 1) { // More than just headers
                    const wsImpedance = XLSX.utils.aoa_to_sheet(impedanceAOA);
                    XLSX.utils.book_append_sheet(wb, wsImpedance, "Impedance");
                    sheetsAdded++;
                    console.log("Impedance sheet created.");
                } else {
                    console.warn("No data rows for impedance sheet.");
                }

                console.log("Creating phase sheet..."); // Log before wsPhase declaration
                const phaseAOA = createPivotedSheetAOA(spectroscopyData, 'phases', uniqueFrequencies);
                if (phaseAOA.length > 1) { // More than just headers
                    const wsPhase = XLSX.utils.aoa_to_sheet(phaseAOA); // wsPhase is declared here
                    XLSX.utils.book_append_sheet(wb, wsPhase, "Phase"); // wsPhase is used here
                    sheetsAdded++;
                    console.log("Phase sheet created.");
                } else {
                    console.warn("No data rows for phase sheet.");
                }
            } else {
                console.warn("No data to create spectroscopy sheets (no time points or frequencies).");
            }
        } else {
            console.log("No data available for export or unknown analysis type.");
            alert("No data available to export for the selected analysis type.");
            return;
        }

        if (sheetsAdded === 0) {
            alert("No data was actually added to the export file. Please check the data and file contents.");
            console.warn("Export aborted: No sheets were added to the workbook.");
            return;
        }

        console.log("Writing XLSX file...");
        XLSX.writeFile(wb, `${experimentName}_Data.xlsx`);
        console.log("XLSX file write initiated.");

    } catch (error) {
        console.error("Failed to export data to XLSX:", error);
        alert(`An error occurred while exporting the data to XLSX: ${error.message}`);
    }
};


/**
 * Prepares and exports data to a ZIP file containing one or more CSVs.
 * @param {string} analysisType - 'time_series' or 'spectroscopy'.
 * @param {Array} timeSeriesData - The processed time-series data from AppContext.
 * @param {Array} spectroscopyData - The processed spectroscopy data from AppContext.
 * @param {Object} config - The application config for filenames.
 */
export const exportDataToCsv = async (analysisType, timeSeriesData, spectroscopyData, config) => {
    try {
        const zip = new JSZip();
        const experimentName = config.experimentName || 'Experiment';
        let filesAdded = 0;

        if (analysisType === 'time_series' && timeSeriesData && timeSeriesData.length > 0) {
            timeSeriesData.forEach(sensorTable => {
                if (sensorTable && sensorTable.data && sensorTable.data.length > 0) {
                    const sanitizedData = sanitizeDataForExport(sensorTable.data);
                    const ws = XLSX.utils.json_to_sheet(sanitizedData);
                    const csvString = XLSX.utils.sheet_to_csv(ws);
                    const fileName = `Sensor_${sensorTable.sensorNumber}.csv`;
                    zip.file(fileName, csvString);
                    filesAdded++;
                }
            });
        } else if (analysisType === 'spectroscopy' && spectroscopyData && spectroscopyData.length > 0) {
            const freqSet = new Set();
            spectroscopyData.forEach(sweep => sweep.frequencies.forEach(f => freqSet.add(f)));
            const uniqueFrequencies = Array.from(freqSet).sort((a, b) => a - b);

            // Create and add Impedance CSV
            const impedanceAOA = createPivotedSheetAOA(spectroscopyData, 'impedances', uniqueFrequencies);
            if (impedanceAOA.length > 1) {
                const wsImpedance = XLSX.utils.aoa_to_sheet(impedanceAOA);
                const csvStringImpedance = XLSX.utils.sheet_to_csv(wsImpedance);
                zip.file("Impedance.csv", csvStringImpedance);
                filesAdded++;
            }

            // Create and add Phase CSV
            const phaseAOA = createPivotedSheetAOA(spectroscopyData, 'phases', uniqueFrequencies);
            if (phaseAOA.length > 1) {
                const wsPhase = XLSX.utils.aoa_to_sheet(phaseAOA);
                const csvStringPhase = XLSX.utils.sheet_to_csv(wsPhase);
                zip.file("Phase.csv", csvStringPhase);
                filesAdded++;
            }
        } else {
            alert("No data available to export.");
            return;
        }

        if (filesAdded === 0) {
            alert("No data was actually added to the export file.");
            return;
        }

        // Generate the ZIP file and trigger download
        const zipContent = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipContent);
        link.download = `${experimentName}_CSV_Data.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error("Failed to export data to CSV zip:", error);
        alert("An error occurred while exporting the data to CSV.");
    }
};



/**
 * Finds rendered plots, converts them to PNG images, and downloads them in a ZIP file.
 * @param {string} analysisType - 'time_series' or 'spectroscopy'.
 * @param {string} activeTab - The key for the currently active tab (e.g., 'impedance', 'impedance3d').
 * @param {Object} config - The application config for filenames.
 * @param {Function} setIsExporting - Setter to control UI feedback.
 * @param {Function} addLogMsg - For providing feedback in a log if needed.
 */

export const exportPlotsToZip = async (
    analysisType,
    activeTab,
    config,
    setIsExporting,
    addLogMessage
) => {
    setIsExporting(true);
    addLogMessage("Starting plot export (DEBUGGING VERSION)...", "info");

    await new Promise(resolve => setTimeout(resolve, 500)); // Ensure plots render

    try {
        const plotContainers = document.querySelectorAll('.plotly-chart-export-target .js-plotly-plot');
        console.log("Found plot containers for export:", plotContainers); // You are seeing this

        if (!plotContainers || plotContainers.length === 0) {
            alert(`No plots found in the "${activeTab}" tab to export.`);
            addLogMessage(`No plots found in "${activeTab}" tab for export.`, "warn");
            setIsExporting(false);
            return;
        }

        addLogMessage(`Attempting to iterate through ${plotContainers.length} plots...`, "info");
        const zip = new JSZip();
        let successCount = 0;

        for (let i = 0; i < plotContainers.length; i++) {
            const plotWrapperDiv = plotContainers[i].closest('.plotly-chart-export-target'); // Get the parent wrapper
            const plotDiv = plotContainers[i]; // This is the .js-plotly-plot div

            console.log(`Loop iteration ${i}. Processing plotDiv:`, plotDiv);
            addLogMessage(`Loop iteration ${i}. Processing plotDiv with offsetHeight: ${plotDiv.offsetHeight}`, "info");

            let baseName = `Plot_${i + 1}`; // Default
            if (plotWrapperDiv) { // Check if the wrapper div was found
                const dataPlotName = plotWrapperDiv.dataset.exportPlotName;
                const dataSensorNum = plotWrapperDiv.dataset.exportSensorNumber;

                if (dataPlotName) {
                    if (dataSensorNum !== undefined && dataSensorNum !== null) {
                        baseName = `Sensor_${dataSensorNum}_${dataPlotName}`;
                    } else {
                        baseName = dataPlotName;
                    }
                }
            }
            // Sanitize basename
            baseName = baseName.replace(/<br>/g, '_').replace(/<[^>]*>/g, '').replace(/\s+/g, '_').replace(/[^\w.-]/g, '').substring(0, 100);

            // CORRECTED FILENAME DEFINITION:
            const filename = `${config.experimentName || "ExperimentData"}_${baseName}.png`;
            // The console log will now show the actual evaluated filename:
            console.log(`Plot ${i} - determined filename for JSZip: ${filename}`);


            try {
                console.log(`Plot ${i} - Calling Plotly.toImage for plot...`); // Simpler log
                const dataUrl = await Plotly.toImage(plotDiv, {
                    format: 'png',
                    height: plotDiv.offsetHeight || 500,
                    width: plotDiv.offsetWidth || 700,
                    scale: 1
                });
                console.log(`Plot ${i} - Got dataUrl for ${filename} (length: ${dataUrl.length})`);

                if (!dataUrl || dataUrl === 'data:,') {
                    throw new Error('Plotly.toImage returned empty or invalid dataURL');
                }
                console.log(`Plot ${i} - Got dataUrl (length: ${dataUrl.length})`);

                const response = await fetch(dataUrl);
                 if (!response.ok) {
                    throw new Error(`Fetch failed for dataUrl with status ${response.status}`);
                }
                console.log(`Plot ${i} - Fetched dataUrl. Status: ${response.status}`);

                const blob = await response.blob();
                 if (blob.size === 0) {
                    throw new Error('Generated blob is empty');
                }
                console.log(`Plot ${i} - Converted to blob (size: ${blob.size}). Adding to ZIP as: ${filename}`);


                zip.file(filename, blob); // This should now use the correct filename
                addLogMessage(`Added ${filename} to ZIP.`); // This will log the correct filename
                successCount++;
            } catch (err) {
                addLogMessage(`Error exporting plot ${filename}: ${err.message}`, 'error');
                console.error(`Error exporting plot ${filename}:`, err);
            }
            console.log(`Plot ${i} - Iteration end.`);
        } // End of for loop

        console.log(`Loop finished. Success count: ${successCount}`);
        addLogMessage(`Loop finished. Success count: ${successCount}`, "info");

        if (successCount > 0) {
            addLogMessage('Generating ZIP file...', "info");
            const zipContent = await zip.generateAsync({ type: "blob" });
            console.log("ZIP content generated, size:", zipContent.size);

            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipContent);
            // CORRECTED LINK.DOWNLOAD DEFINITION:
            link.download = `${config.experimentName || "ExperimentData"}_Plots_${successCount}_Images.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            addLogMessage('ZIP file download initiated.', "success");
        } else {
            alert("No plots were successfully exported. Check console for errors.");
            addLogMessage("No plots successfully exported to ZIP. Check console.", "warn");
        }

    } catch (error) { // Catch errors outside the loop
        console.error("Critical error during plot export process:", error);
        alert("A critical error occurred while exporting the plots. Check console.");
        addLogMessage(`Critical plot export error: ${error.message}`, "error");
    } finally {
        setIsExporting(false);
    }
};