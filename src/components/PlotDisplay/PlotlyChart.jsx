// src/components/PlotDisplay/PlotlyChart.jsx
import React from 'react';
import Plot from 'react-plotly.js';

const PlotlyChart = ({ data, layout, divId, exportPlotName, exportSensorNumber }) => { // Added new props
    const dataAttributes = {};
    if (exportPlotName) {
        dataAttributes['data-export-plot-name'] = exportPlotName;
    }
    if (exportSensorNumber !== undefined && exportSensorNumber !== null) {
        dataAttributes['data-export-sensor-number'] = exportSensorNumber;
    }

    return (
        <div
            id={divId}
            className="chart-container-wrapper plotly-chart-export-target"
            {...dataAttributes} // Spread the data attributes here
        >
            <Plot
                data={data}
                layout={{
                    ...layout,
                    autosize: true
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{
                    responsive: true,
                    displaylogo: false,
                    plotGlPixelRatio: window.devicePixelRatio,
                    getContext: {
                        willReadFrequently: true
                    }
                }}
            />
        </div>
    );
};

export default PlotlyChart;