// src/utils/dateTimeUtils.js

/**
 * Converts a time string (HH:MM:SS.s or MM:SS.s) to total minutes.
 * @param {string} timeStr - The time string to parse.
 * @returns {number} Total minutes, or NaN if parsing fails.
 */
export function timeStringToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return NaN;
    const parts = timeStr.split(':');
    let totalMinutes = 0;
    try {
        if (parts.length === 3) { // HH:MM:SS.s
            totalMinutes += parseInt(parts[0], 10) * 60; // hours to minutes
            totalMinutes += parseInt(parts[1], 10);      // minutes
            totalMinutes += parseFloat(parts[2]) / 60; // seconds to minutes
        } else if (parts.length === 2) { // MM:SS.s
            totalMinutes += parseInt(parts[0], 10);      // minutes
            totalMinutes += parseFloat(parts[1]) / 60; // seconds to minutes
        } else {
            return NaN; // Invalid format
        }
        return totalMinutes;
    } catch (e) {
        console.error("Error parsing time string:", timeStr, e);
        return NaN;
    }
}

/**
 * Parses a custom date-time string "DD/MM/YYYY HH:MM:SS.s" into a Date object.
 * @param {string} dateTimeString - The date-time string to parse.
 * @returns {Date|null} A Date object or null if parsing fails.
 */
export function parseCustomDateTime(dateTimeString) {
    if (!dateTimeString || typeof dateTimeString !== 'string') {
        // console.warn("Invalid dateTimeString input to parseCustomDateTime:", dateTimeString); // Optional: for stricter debugging
        return null;
    }
    const parts = dateTimeString.trim().split(' ');
    if (parts.length !== 2) {
        // console.warn("Invalid dateTimeString format (should have date and time separated by space):", dateTimeString);
        return null;
    }

    const dateParts = parts[0].split('/'); // DD/MM/YYYY
    if (dateParts.length !== 3) {
        // console.warn("Invalid date part format (DD/MM/YYYY expected):", parts[0]);
        return null;
    }

    const timeParts = parts[1].split(':'); // HH:MM:SS.s or HH:MM:SS or HH:MM
    if (timeParts.length < 2 || timeParts.length > 3) {
        // console.warn("Invalid time part format (HH:MM or HH:MM:SS or HH:MM:SS.s expected):", parts[1]);
        return null;
    }

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
    const year = parseInt(dateParts[2], 10);

    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);

    let seconds = 0;
    let milliseconds = 0;

    if (timeParts[2]) { // If seconds part exists
        const secAndMs = timeParts[2].split('.');
        seconds = parseInt(secAndMs[0], 10);
        if (secAndMs[1]) { // If milliseconds part exists
            const msString = secAndMs[1].padEnd(3, '0').substring(0,3); // Ensure 3 digits for ms
            milliseconds = parseInt(msString, 10);
        }
    }

    if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(milliseconds)) {
        // console.warn("NaN encountered during parsing components of dateTimeString:", dateTimeString);
        return null;
    }
    // Validate date components further if necessary (e.g., day <= 31, month <= 11)
    // For simplicity, relying on Date constructor's behavior with out-of-range values for now.
    return new Date(year, month, day, hours, minutes, seconds, milliseconds);
}