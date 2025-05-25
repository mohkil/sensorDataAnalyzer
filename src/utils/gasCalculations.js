// src/utils/gasCalculations.js

/**
 * Calculates the gas concentration vs. time profile.
 * Original dependencies: config.totalFlowrate, config.gasConcCyl2, gasFlowData array.
 * @param {Array<Object>} gasFlowData - Array of { targetGasFlow: number, durationSeconds: number }.
 * @param {Object} config - Configuration object. Expected properties:
 * { totalFlowrate: number, gasConcCyl2: number }.
 * @returns {Array<Object>} Array of { time_min: number, conc: number }.
 */
export function calculateGasConcVsTime(gasFlowData, config) {
    console.log("--- Running calculateGasConcVsTime (VERSION: USER_PROFILE_MATCH_MAY25) ---");
    const calculatedProfile = [];
    let currentTimeSeconds = 0;
    let currentConcentration = 0; // Initial concentration is 0

    const totalFlowrate = config && typeof config.totalFlowrate === 'number' ? config.totalFlowrate : 500;
    const gasConcCyl2 = config && typeof config.gasConcCyl2 === 'number' ? config.gasConcCyl2 : 0;
    const oneSecondInMinutes = 1 / 60; // For the sharp transition

    if (!gasFlowData || gasFlowData.length === 0) {
        calculatedProfile.push({ time_min: 0, conc: 0 });
        return calculatedProfile;
    }

    // Initial state at time 0
    calculatedProfile.push({ time_min: 0, conc: 0 });

    for (let i = 0; i < gasFlowData.length; i++) {
        const step = gasFlowData[i];
        const previousConcentration = currentConcentration;

        // Calculate new concentration for the current step
        if (totalFlowrate === 0) {
            currentConcentration = (gasConcCyl2 > 0 && step.targetGasFlow > 0) ? Infinity : 0;
        } else {
            currentConcentration = (gasConcCyl2 * step.targetGasFlow) / totalFlowrate;
        }

        // Point 1: End of the previous concentration period (at currentTimeSeconds)
        // Only add if time has advanced or if it's the very first step from initial 0 conc
        // or if concentration actually changed.
        if (calculatedProfile.length === 0 ||
            (calculatedProfile[calculatedProfile.length - 1].time_min < (currentTimeSeconds / 60)) ||
            (calculatedProfile[calculatedProfile.length - 1].time_min === (currentTimeSeconds / 60) && calculatedProfile[calculatedProfile.length - 1].conc !== previousConcentration)
           ) {
            // If the last point is at the same time but different concentration, this means we are starting a new step.
            // The point representing the end of the *previous* concentration level should be added.
             if (calculatedProfile.length > 0 && calculatedProfile[calculatedProfile.length-1].time_min === (currentTimeSeconds/60) && calculatedProfile[calculatedProfile.length-1].conc === previousConcentration){
                // This case should ideally not happen if logic is right, but as a guard.
             } else {
                calculatedProfile.push({ time_min: currentTimeSeconds / 60, conc: previousConcentration });
             }
        }


        // Point 2: Start of the new concentration period (1 second later, if concentration changed)
        if (currentConcentration !== previousConcentration) {
            calculatedProfile.push({
                time_min: (currentTimeSeconds / 60) + oneSecondInMinutes,
                conc: currentConcentration
            });
        } else if (calculatedProfile[calculatedProfile.length - 1].conc !== currentConcentration) {
            // If the last point added was the end of the previous concentration,
            // and the new concentration is the same as that previous one (e.g. 0 to 0),
            // ensure the current concentration is represented at the transition + 1s.
            // This handles cases like 0ppm -> 0ppm step, ensuring the profile is continuous.
             calculatedProfile.push({
                time_min: (currentTimeSeconds / 60) + oneSecondInMinutes,
                conc: currentConcentration
            });
        }


        // Advance time by the duration of the current gas flow step
        currentTimeSeconds += step.durationSeconds;

        // Point 3: End of the new concentration period (at new currentTimeSeconds)
        calculatedProfile.push({ time_min: currentTimeSeconds / 60, conc: currentConcentration });
    }

    // Deduplicate points if any were added with the exact same time and conc
    // This can happen due to the logic trying to ensure all transitions are captured.
    const finalProfile = [];
    if (calculatedProfile.length > 0) {
        finalProfile.push(calculatedProfile[0]);
        for (let k = 1; k < calculatedProfile.length; k++) {
            if (calculatedProfile[k].time_min !== calculatedProfile[k-1].time_min ||
                calculatedProfile[k].conc !== calculatedProfile[k-1].conc) {
                finalProfile.push(calculatedProfile[k]);
            }
        }
    }
    // Ensure the profile starts at time 0, conc 0 if it was somehow lost.
    if (finalProfile.length === 0 || finalProfile[0].time_min !== 0 || finalProfile[0].conc !== 0) {
        if (finalProfile.length > 0 && finalProfile[0].time_min === 0 && finalProfile[0].conc === 0) {
            // it's fine
        } else {
             finalProfile.unshift({ time_min: 0, conc: 0 });
             // Re-deduplicate if unshift caused issue
             if (finalProfile.length > 1 && finalProfile[0].time_min === finalProfile[1].time_min && finalProfile[0].conc === finalProfile[1].conc) {
                 finalProfile.shift();
             }
        }
    }


    return finalProfile;
}


/**
 * Identifies gas exposure events from a concentration profile.
 * @param {Array<Object>} gasConcProfile - Sorted array of { time_min: number, conc: number }.
 * @returns {Array<Object>} Array of events { startTime: number, concentration: number, endTime: number }.
 */

export function identifyGasExposureEvents(gasConcProfile) {
    console.log("--- Running identifyGasExposureEvents (VERSION: ORIGINAL_LOGIC_ADAPTED_MAY25) ---"); // <-- ADD THIS LINE
    const events = [];
    if (!gasConcProfile || gasConcProfile.length === 0) return events;

    let activeEvent = null;
    for (let i = 0; i < gasConcProfile.length; i++) {
        const point = gasConcProfile[i]; // [cite: 208]
        if (point.conc > 0 && !activeEvent) { // [cite: 209]
            activeEvent = {
                startTime: point.time_min, // [cite: 209]
                concentration: point.conc, // [cite: 209]
                endTime: point.time_min // [cite: 209]
            };
        } else if (activeEvent) {
            // This condition checks if the current point continues the event
            // OR if it's a new point in time that changes concentration or ends the event.
            if (point.conc === activeEvent.concentration && point.time_min > activeEvent.endTime) { // [cite: 210]
                activeEvent.endTime = point.time_min; // [cite: 210]
            } else if (point.conc !== activeEvent.concentration || point.time_min <= activeEvent.endTime) { // [cite: 211]
                // This 'else if' means:
                // 1. Concentration changed OR
                // 2. Time did not advance (or went backward, unlikely here but part of original logic)
                //    while concentration might be the same (e.g. multiple points at the same time_min).
                //    We only want to push if the event has a duration.
                if (activeEvent.endTime > activeEvent.startTime) { // [cite: 211]
                    events.push({ ...activeEvent }); // [cite: 211]
                }
                // Reset activeEvent and check if the current point starts a new one
                if (point.conc > 0) { // [cite: 212]
                    activeEvent = {
                        startTime: point.time_min, // [cite: 212]
                        concentration: point.conc, // [cite: 212]
                        endTime: point.time_min // [cite: 212]
                    };
                } else {
                    activeEvent = null; // [cite: 214]
                }
            }
        }
    }
    // Add the last active event if it exists, has duration, and hasn't been added.
    // The original code had this check as well.
    if (activeEvent && activeEvent.endTime > activeEvent.startTime) { // [cite: 215]
        // To prevent duplicates if the loop's last action already pushed it.
        let alreadyAdded = false;
        if (events.length > 0) {
            const lastPushedEvent = events[events.length - 1];
            if (lastPushedEvent.startTime === activeEvent.startTime &&
                lastPushedEvent.concentration === activeEvent.concentration &&
                lastPushedEvent.endTime === activeEvent.endTime) {
                alreadyAdded = true;
            }
        }
        if (!alreadyAdded) {
            events.push({ ...activeEvent }); // [cite: 215]
        }
    }
    // console.log("Identified Gas Exposure Events (original logic):", events); // For debugging
    return events; // [cite: 216]
}


/**
 * Interpolates gas concentration using a 'previous value' method with extrapolation.
 * @param {Array<Object>} concProfile - Sorted array of { time_min: number, conc: number } points.
 * @param {number} targetTimeMin - The time for which to interpolate/extrapolate.
 * @returns {number} Interpolated or extrapolated concentration, or NaN if profile is empty or targetTimeMin is NaN.
 */
export function interpolateGasConcentration(concProfile, targetTimeMin) {
    if (isNaN(targetTimeMin)) return NaN;
    if (!concProfile || concProfile.length === 0) return NaN;

    // Extrapolate if targetTimeMin is before the first point
    if (targetTimeMin < concProfile[0].time_min) {
        return concProfile[0].conc;
    }

    let resultConc = concProfile[0].conc; // Default to first if no other found
    for (let i = 0; i < concProfile.length; i++) {
        if (concProfile[i].time_min <= targetTimeMin) {
            resultConc = concProfile[i].conc;
        } else {
            // Found the point just after targetTimeMin, so the previous one was correct
            break;
        }
    }
    return resultConc; // This will be the last value where time_min <= targetTimeMin, or last point if targetTimeMin is beyond profile
}