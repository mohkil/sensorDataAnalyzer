// src/components/PlotDisplay/TimeSeriesPlots.jsx
import React from 'react';
import { useAppContext } from '../../contexts/AppContext.jsx';
import PlotlyChart from './PlotlyChart.jsx';

const TimeSeriesPlots = ({ activeTab }) => {
    const { timeSeriesData, gasConcProfile, config, plotTimeRange } = useAppContext();

    if (!timeSeriesData || timeSeriesData.length === 0) {
        return <p>No time-series sensor data processed or available to display.</p>;
    }

    let dataKey, yLabelPrimary;
    const primaryTraceColor = '#007bff';
    const secondaryTraceColor = '#ff7f0e';

    switch (activeTab) {
        case 'phase':
            dataKey = 'phase';
            yLabelPrimary = 'Phase (deg)';
            break;
        case 'signal':
            dataKey = 'signal';
            yLabelPrimary = 'Signal (%)';
            break;
        default: // 'impedance'
            dataKey = 'impedance';
            yLabelPrimary = 'Impedance (Ohm)';
            break;
    }

    return (
        <div className="charts-grid">
            {timeSeriesData.map((sensorTable) => {
                const validTimeData = sensorTable.data.filter(row => !isNaN(row.time_min));

                if (validTimeData.length === 0) {
                    return (
                        <div key={sensorTable.fileName} className="chart-container-wrapper">
                            <p>Sensor {sensorTable.sensorNumber}: No valid time data to plot.</p>
                        </div>
                    );
                }

                // --- NEW: Calculate data's natural time boundaries ---
                const timeValues = validTimeData.map(row => row.time_min);
                const dataMinTime = Math.min(...timeValues);
                const dataMaxTime = Math.max(...timeValues);

                // --- NEW: Determine the final range for the plot ---
                const startInputVal = parseFloat(plotTimeRange.start);
                const endInputVal = parseFloat(plotTimeRange.end);

                const finalRange = [
                    // Use input value if it's a valid number, otherwise use data's min
                    !isNaN(startInputVal) ? startInputVal : dataMinTime,
                    // Use input value if it's a valid number, otherwise use data's max
                    !isNaN(endInputVal) ? endInputVal : dataMaxTime
                ];


                // --- Build Traces and Layout for Plotly ---
                const traces = [];
                const layoutShapes = [];
                let yaxis2Config = null;

                if (gasConcProfile && gasConcProfile.length > 0 && config.gasExposureEvents && config.gasExposureEvents.length > 0) {
                    traces.push({
                        x: validTimeData.map(row => row.time_min),
                        y: validTimeData.map(row => row.gas_concentration),
                        name: config.gasConcentrationLabel || 'Gas Conc. (ppm)',
                        type: 'scatter', mode: 'lines', yaxis: 'y2',
                        line: { color: secondaryTraceColor, dash: 'dashdot' }
                    });
                    yaxis2Config = {
                        title: { text: config.gasConcentrationLabel || 'Gas Conc. (ppm)', font: { size: 11, color: secondaryTraceColor } },
                        overlaying: 'y', side: 'right', showgrid: false, automargin: true, tickfont: { size: 9 }
                    };
                    config.gasExposureEvents.forEach(event => {
                        layoutShapes.push({
                            type: 'rect', xref: 'x', yref: 'paper',
                            x0: event.startTime, y0: 0, x1: event.endTime, y1: 1,
                            fillcolor: 'rgba(100, 100, 100, 0.1)', layer: 'below', line: { width: 0 }
                        });
                    });
                }

                traces.push({
                    x: validTimeData.map(row => row.time_min),
                    y: validTimeData.map(row => row[dataKey]),
                    name: yLabelPrimary, type: 'scatter', mode: 'lines', yaxis: 'y1',
                    line: { color: primaryTraceColor }
                });

                const layout = {
                    title: {
                        text: `Sensor <span class="math-inline">\{sensorTable\.sensorNumber\}<br\><span style\="font\-size\:0\.8em; color\:\#555;"\>\(</span>{sensorTable.fileName})</span>`,
                        font: { size: 14 }
                    },
                    xaxis: {
                        title: { text: 'Time (min)' },
                        range: finalRange, // Use our calculated final range
                        autorange: false // Explicitly disable autorange when providing a range
                    },
                    yaxis: {
                        title: { text: yLabelPrimary, font: { color: primaryTraceColor } },
                        side: 'left', automargin: true, autorange: true
                    },
                    yaxis2: yaxis2Config,
                    margin: { l: 70, r: (yaxis2Config ? 70 : 40), t: 60, b: 50 },
                    legend: { x: 0.5, y: -0.2, xanchor: 'center', yanchor: 'top', orientation: "h", font: { size: 10 } },
                    height: 380,
                    shapes: layoutShapes
                };

                return (
                <PlotlyChart
                    key={sensorTable.fileName}
                    divId={`chart-<span class="math-inline">\{dataKey\}\-</span>{sensorTable.sensorNumber || sensorTable.fileName}`}
                    data={traces}
                    layout={layout}
                    exportPlotName={sensorTable.fileName} // Pass filename
                    exportSensorNumber={sensorTable.sensorNumber} // Pass sensor number
                />
            );
            })}
        </div>
    );
};

export default TimeSeriesPlots;