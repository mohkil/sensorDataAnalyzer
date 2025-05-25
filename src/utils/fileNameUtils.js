// src/utils/fileNameUtils.js

/**
 * Extracts a sensor number from a filename.
 * Original patterns checked: /__([0-9]+)__vs_time\.csv$/i and /vs_time\.csv([0-9]+)$/i
 * @param {string} filename - The filename to parse.
 * @param {boolean} [forDisplay=true] - If true, adds 1 to the parsed number (original logic).
 * @returns {number|null} The extracted sensor number (or number + 1) or null if not found/parsed.
 */
export function extractSensorNumberFromName(filename, forDisplay = true) {
    let match = filename.match(/__([0-9]+)__vs_time\.csv$/i); // [cite: 426]
    if (!match) {
        match = filename.match(/vs_time\.csv([0-9]+)$/i); // [cite: 427]
    }

    if (match && match[1]) {
        const parsedNumber = parseInt(match[1], 10); // [cite: 428]
        if (!isNaN(parsedNumber)) { // [cite: 429]
            return forDisplay ? parsedNumber + 1 : parsedNumber; // [cite: 429, 430]
        }
    }
    return null; // [cite: 430]
}

/**
 * Sorts an array of file items based on their sensorNumberRaw.
 * Files without a valid sensorNumberRaw are placed according to originalName.
 * @param {Array<Object>} fileItems - Array of objects, each expected to have
 * `sensorNumberRaw` (number|null) and `originalName` (string).
 * @returns {Array<Object>} The sorted array of file items.
 */
export function sortFileItemsBySensorNumber(fileItems) {
    // Assuming fileItems is an array of objects like:
    // { originalFile: File, effectiveName: string, originalName: string, sensorNumberRaw: number|null, ... }
    return fileItems.sort((a, b) => {
        const numA = a.sensorNumberRaw;
        const numB = b.sensorNumberRaw;

        if (numA !== null && numB !== null) return numA - numB; // [cite: 431]
        if (numA !== null) return -1; // Place items with numbers first [cite: 431]
        if (numB !== null) return 1;  // Place items with numbers first [cite: 431]
        return a.originalName.localeCompare(b.originalName); // Fallback to string compare [cite: 431]
    });
}