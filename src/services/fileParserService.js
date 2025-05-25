// src/services/fileParserService.js
import * as d3 from 'd3'; // Import D3

/**
 * Parses a CSV file string into an array of objects or rows.
 * @param {File} file - The File object to parse.
 * @param {boolean} [hasHeader=false] - Indicates if the CSV has a header row for d3.autoType.
 * @returns {Promise<Array<Object>|Array<Array<string>>>} A promise that resolves with the parsed data.
 * Rejects with an error if parsing fails or d3 is not available (though d3 import should handle this).
 */
export function parseCsvFile(file, hasHeader = false) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error("No file provided for parsing."));
            return;
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const fileString = event.target.result;
                let parsedData;

                if (hasHeader) {
                    // d3.csvParse uses the first row as headers and applies autoType to subsequent rows.
                    parsedData = d3.csvParse(fileString, d3.autoType);
                } else {
                    // d3.dsvFormat(",").parseRows parses all rows as arrays of strings.
                    parsedData = d3.dsvFormat(",").parseRows(fileString);
                }
                resolve(parsedData);
            } catch (e) {
                reject(new Error(`Error parsing ${file.name} with D3.js: ${e.message}`));
            }
        };

        reader.onerror = (error) => {
            reject(new Error(`Error reading file ${file.name}: ${error.message || error}`));
        };

        reader.readAsText(file);
    });
}


/**
 * Parses the gas_flow_table.csv file.
 * Expects no header and at least 3 columns per row after parsing.
 * Column 2 (index 1) is targetGasFlow, Column 3 (index 2) is durationSeconds.
 * @param {File} file - The gas_flow_table.csv File object.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of
 * { targetGasFlow: number, durationSeconds: number } objects.
 * Rejects with an error if parsing fails or data is invalid.
 */
export async function parseGasFlowFile(file) {
    if (!file) {
        return Promise.reject(new Error("No gas flow file provided."));
    }

    try {
        // Gas flow table typically does not have a header, as per original app.js and user's sample.
        const parsedRows = await parseCsvFile(file, false);

        if (!parsedRows || parsedRows.length === 0) {
            throw new Error("Gas flow file is empty or could not be parsed into rows.");
        }

        const gasFlowData = parsedRows.map((row, index) => {
            if (!Array.isArray(row) || row.length < 3) { // [cite: 1]
                console.warn(`Gas flow file: Row ${index + 1} is invalid (expected at least 3 columns). Skipping.`);
                return null;
            }
            // Column 2 (index 1) is targetGasFlow, Column 3 (index 2) is durationSeconds. [cite: 1]
            const targetGasFlow = parseFloat(row[1]); // [cite: 1]
            const durationSeconds = parseFloat(row[2]); // [cite: 1]

            if (isNaN(targetGasFlow) || isNaN(durationSeconds)) { // [cite: 1]
                console.warn(`Gas flow file: Row ${index + 1} contains non-numeric data in required columns (cols 2 or 3). Skipping.`);
                return null;
            }
            return { targetGasFlow, durationSeconds }; // [cite: 1]
        }).filter(r => r !== null); // [cite: 1]

        if (gasFlowData.length === 0) { // [cite: 1]
            throw new Error("No valid data parsed from gas flow file. Check file format and content.");
        }
        // console.log("Parsed Gas Flow Data (in service):", gasFlowData); // Optional: for debugging
        return gasFlowData;
    } catch (e) {
        // Catch errors from parseCsvFile or thrown within this function
        throw new Error(`Failed to parse gas flow file (${file.name}): ${e.message}`); // [cite: 1]
    }
}



/**
 * Parses a single impedance spectroscopy CSV file.
 * - Extracts timestamp from filename (format: __IS_DD_MM_YYYY hh_mm_ss(.ms?).csv).
 * - Skips initial metadata lines until a header "frequency (hz)" is found,
 * OR attempts to find the first fully numeric data row if header is missing.
 * - Expects data columns: frequency, angle, impedance (based on user sample).
 *
 * @param {File} fileObject - The File object to parse.
 * @param {string} effectiveName - The effective name of the file (often original name for spectroscopy).
 * @returns {Promise<Object|null>} A promise that resolves with an object containing
 * { fileName (original), effectiveName, timestamp, frequencies, impedances, phases},
 * or null if critical parsing steps fail (will reject promise for file read errors).
 */
export function parseSpectroscopyFile(fileObject, effectiveName) {
    return new Promise((resolve, reject) => {
        if (!fileObject) {
            reject(new Error("No spectroscopy file object provided."));
            return;
        }

        const originalFileName = fileObject.name;
        const currentEffectiveFileName = effectiveName || originalFileName;

        // Timestamp extraction from filename (similar to original)
        const timestampMatch = originalFileName.match(/__IS_(\d{2})_(\d{2})_(\d{4}) (\d{2})_(\d{2})_(\d{2}(?:\.\d*)?)\.csv$/i);
        let fileTimestamp = null;
        if (timestampMatch) {
            const day = parseInt(timestampMatch[1], 10);
            const month = parseInt(timestampMatch[2], 10) - 1; // JS months 0-indexed
            const year = parseInt(timestampMatch[3], 10);
            const hour = parseInt(timestampMatch[4], 10);
            const minute = parseInt(timestampMatch[5], 10);
            const secParts = timestampMatch[6].split('.');
            const second = parseInt(secParts[0], 10);
            const millisecond = secParts[1] ? parseInt(secParts[1].padEnd(3, '0').substring(0, 3), 10) : 0;

            fileTimestamp = new Date(year, month, day, hour, minute, second, millisecond);
            if (isNaN(fileTimestamp.getTime())) {
                console.warn(`Could not parse valid date from filename: ${originalFileName}. Using null timestamp.`);
                fileTimestamp = null;
            }
        } else {
            console.warn(`Timestamp pattern not found in filename: ${originalFileName}. Using file modification date as fallback.`);
            fileTimestamp = new Date(fileObject.lastModified);
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const fileString = event.target.result;
                const lines = fileString.split(/\r\n|\n/);

                let dataStartIndex = -1;
                let headerFound = false;
                const headerPattern = 'frequency (hz)';

                // Find header or first valid data line
                for (let i = 0; i < lines.length; i++) {
                    const trimmedLine = lines[i].trim().toLowerCase();
                    if (trimmedLine.startsWith(headerPattern)) {
                        dataStartIndex = i + 1; // Data starts on the next line
                        headerFound = true;
                        break;
                    }
                }

                if (!headerFound) {
                    // Fallback: if header "frequency (hz)" is not found,
                    // try to find the first row that looks like data (3 numeric CSV values)
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].trim() === '') continue;
                        const values = lines[i].split(',');
                        if (values.length >= 3 &&
                            !isNaN(parseFloat(values[0])) &&
                            !isNaN(parseFloat(values[1])) &&
                            !isNaN(parseFloat(values[2]))) {
                            dataStartIndex = i;
                            console.warn(`Header "${headerPattern}" not found in ${currentEffectiveFileName}. Attempting to parse data from line ${i + 1} based on numeric content.`);
                            break;
                        }
                    }
                }

                if (dataStartIndex === -1) {
                    // If still no data start found, resolve with null as per original implicit behavior for unparsable.
                    // Consider rejecting for a more explicit error handling in React.
                    // For now, matching original behavior of potentially returning null.
                    console.error(`Data table start (marked by '${headerPattern}' or numeric rows) not found in ${currentEffectiveFileName}`);
                    resolve(null); // Or reject(new Error(...))
                    return;
                }

                const frequencies = [];
                const impedances = [];
                const phases = [];

                for (let i = dataStartIndex; i < lines.length; i++) {
                    if (lines[i].trim() === '') continue;
                    const values = lines[i].split(',');

                    if (values.length >= 3) {
                        const freq = parseFloat(values[0]);
                        // Adjusted column order based on user's sample: Freq, Angle, Z
                        const angle = parseFloat(values[1]);
                        const z = parseFloat(values[2]);

                        if (!isNaN(freq) && !isNaN(angle) && !isNaN(z)) {
                            frequencies.push(freq);
                            phases.push(angle); // Storing angle in phases array
                            impedances.push(z); // Storing Z in impedances array
                        } else {
                            // console.warn(`Skipping non-numeric data row in ${currentEffectiveFileName} at line ${i+1}: ${lines[i]}`);
                        }
                    }
                }

                if (frequencies.length === 0) {
                    console.warn(`No valid data rows found in ${currentEffectiveFileName} after data start index.`);
                    resolve(null); // Or reject
                    return;
                }

                resolve({
                    fileName: originalFileName,
                    effectiveName: currentEffectiveFileName,
                    timestamp: fileTimestamp,
                    frequencies,
                    impedances,
                    phases
                });

            } catch (e) {
                console.error(`Error processing content of spectroscopy file ${currentEffectiveFileName}:`, e);
                reject(new Error(`Error processing content of ${currentEffectiveFileName}: ${e.message}`));
            }
        };

        reader.onerror = (errorEvent) => {
            console.error(`FileReader error for ${currentEffectiveFileName}:`, errorEvent);
            reject(new Error(`FileReader error for ${currentEffectiveFileName}.`));
        };

        reader.readAsText(fileObject);
    });
}