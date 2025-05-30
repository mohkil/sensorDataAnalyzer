// src/components/PlotDisplay/SpectroscopyPlots.jsx
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext.jsx';
import PlotlyChart from './PlotlyChart.jsx';

const SpectroscopyPlots = ({ activeTab }) => {
    const { spectroscopyData, config } = useAppContext();

    const plotType = activeTab === 'impedance3d' ? 'impedance' : 'phase';

    const uniqueFrequencies = useMemo(() => {
        if (!spectroscopyData || spectroscopyData.length === 0) return [];
        const freqSet = new Set();
        spectroscopyData.forEach(sweep => {
            sweep.frequencies.forEach(f => freqSet.add(f));
        });
        return Array.from(freqSet).sort((a, b) => a - b);
    }, [spectroscopyData]);

    const [selectedFrequencyIndex, setSelectedFrequencyIndex] = useState(0);

    const handleSliderChange = (event) => {
        setSelectedFrequencyIndex(parseInt(event.target.value, 10));
    };

    const selectedFrequency = uniqueFrequencies[selectedFrequencyIndex];

    if (!spectroscopyData || spectroscopyData.length === 0) {
        return <p>No spectroscopy data processed or available to display.</p>;
    }
    if (uniqueFrequencies.length === 0) {
        return <p>Could not determine unique frequencies from the data.</p>;
    }

    // --- 3D Plot Data Preparation ---
    const get3dPlotData = () => {
        const dataByFrequency = {};
        spectroscopyData.forEach(sweep => {
            for (let i = 0; i < sweep.frequencies.length; i++) {
                const freq = sweep.frequencies[i];
                if (!dataByFrequency[freq]) dataByFrequency[freq] = [];
                dataByFrequency[freq].push({
                    time: sweep.relativeTimeMin,
                    value: plotType === 'impedance' ? sweep.impedances[i] : sweep.phases[i],
                });
            }
        });

        const traces = [];
        Object.keys(dataByFrequency).map(f => parseFloat(f)).sort((a, b) => a - b).forEach(freq => {
            const pointsForFreq = dataByFrequency[freq].sort((a, b) => a.time - b.time);
            if (pointsForFreq.length > 1) {
                traces.push({
                    x: pointsForFreq.map(p => p.time),
                    y: Array(pointsForFreq.length).fill(freq),
                    z: pointsForFreq.map(p => p.value),
                    mode: 'lines', type: 'scatter3d', name: `${freq.toExponential(1)} Hz`,
                    line: { width: 2 },
                    hoverinfo: 'text',
                    text: pointsForFreq.map(p => `Freq: ${freq.toExponential(2)} Hz<br>Time: <span class="math-inline">\{p\.time\.toFixed\(2\)\} min<br\></span>{plotType === 'impedance' ? 'Z' : 'Phase'}: ${p.value.toFixed(2)} ${plotType === 'impedance' ? 'Ohm' : 'deg'}`)
                });
            }
        });
        return traces;
    };

    // --- 2D Slice Plot Data Preparation ---
    const get2dSlicePlotData = () => {
        const timeValues = [];
        const dataValues = [];
        spectroscopyData.forEach(sweep => {
            for (let i = 0; i < sweep.frequencies.length; i++) {
                if (Math.abs(sweep.frequencies[i] - selectedFrequency) < 1e-9) {
                    timeValues.push(sweep.relativeTimeMin);
                    dataValues.push(plotType === 'impedance' ? sweep.impedances[i] : sweep.phases[i]);
                    break;
                }
            }
        });
        const sortedIndices = timeValues.map((_, i) => i).sort((a, b) => timeValues[a] - timeValues[b]);
        const sortedTime = sortedIndices.map(i => timeValues[i]);
        const sortedData = sortedIndices.map(i => dataValues[i]);

        return [{
            x: sortedTime, y: sortedData,
            mode: 'lines+markers', type: 'scatter',
            name: `${plotType.charAt(0).toUpperCase() + plotType.slice(1)} at ${selectedFrequency.toExponential(1)} Hz`
        }];
    };

    // Inside SpectroscopyPlots.jsx, replace the layout definitions

    // --- Layout Definitions ---
    const layout3d = {
        title: { text: `${config.experimentName || 'Experiment'} - 3D ${plotType.charAt(0).toUpperCase() + plotType.slice(1)} vs. Time & Frequency` },
        margin: { l: 0, r: 0, b: 0, t: 60 },
        scene: {
            xaxis: { title: { text: 'Time (min)' }, autorange: 'reversed' },
            yaxis: { title: { text: 'Frequency (Hz)' }, type: 'log' },
            zaxis: { title: { text: plotType === 'impedance' ? 'Impedance (Ohm)' : 'Phase (deg)' } }
        },
        height: 700,
        showlegend: true,
        legend: { orientation: 'v', y: 0.5, yanchor: 'middle', x: 1.05, xanchor: 'left' }
    };

    const layout2d = {
        xaxis: { title: { text: 'Time (min)' } },
        yaxis: { title: { text: plotType === 'impedance' ? 'Impedance (Ohm)' : 'Phase (deg)' } },
        margin: { t: 30, l: 60, r: 30, b: 50 },
        height: 350
    };


    return (
        <div className="spectroscopy-plot-area">
            <PlotlyChart
                divId={`${plotType}-3d-plot`}
                data={get3dPlotData()}
                layout={layout3d}
                exportPlotName={`3D_${plotType}`} // e.g., 3D_impedance
            />

            <div className="frequency-slice-selector-container">
                <label htmlFor="frequency-slider">Select Frequency for 2D Slice Plot:</label>
                <input
                    id="frequency-slider"
                    type="range"
                    min="0"
                    max={uniqueFrequencies.length - 1}
                    step="1"
                    value={selectedFrequencyIndex}
                    onChange={handleSliderChange}
                />
                <span>{selectedFrequency ? selectedFrequency.toExponential(2) : 'N/A'} Hz</span>
            </div>

            <h3 className="plot-subtitle">{plotType.charAt(0).toUpperCase() + plotType.slice(1)} vs. Time at Selected Frequency</h3>
            <PlotlyChart
                divId={`${plotType}-2d-slice-plot`}
                data={get2dSlicePlotData()}
                layout={layout2d}
                exportPlotName={`2D_Slice_${plotType}_at_${selectedFrequency ? selectedFrequency.toExponential(1) : 'default'}Hz`}
            />
        </div>
    );
};

export default SpectroscopyPlots;