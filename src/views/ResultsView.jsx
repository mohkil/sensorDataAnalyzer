// src/views/ResultsView.jsx
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext.jsx';
import TimeSeriesPlots from '../components/PlotDisplay/TimeSeriesPlots.jsx';
import SpectroscopyPlots from '../components/PlotDisplay/SpectroscopyPlots.jsx';
import { exportDataToXlsx, exportDataToCsv, exportPlotsToZip } from '../services/exportService.js';
import './ResultsView.css';

// We will import PlotlyChart and other specific plot components later
// import PlotlyChart from '../components/PlotDisplay/PlotlyChart.jsx';

const ResultsView = () => {
    const {
        analysisType, timeSeriesData, spectroscopyData, config, resetAppState,
        plotTimeRange, setPlotTimeRange,
        isExporting, setIsExporting, // Get export state and setter
        addLogMessage // Pass to export function for feedback
    } = useAppContext();

    // Local state for active tabs
    // Default to the first tab for each analysis type
    const [activeTimeSeriesTab, setActiveTimeSeriesTab] = useState('impedance'); // 'impedance', 'phase', 'signal'
    const [activeSpectroscopyTab, setActiveSpectroscopyTab] = useState('impedance3d'); // 'impedance3d', 'phase3d'


    // NEW HANDLER for time range inputs
    const handleTimeRangeChange = (event) => {
        const { name, value } = event.target;
        setPlotTimeRange(prevRange => ({
            ...prevRange,
            [name]: value // 'start' or 'end'
        }));
    };

    // NEW HANDLER for XLSX export
    const handleXlsxExport = () => {
        exportDataToXlsx(analysisType, timeSeriesData, spectroscopyData, config);
    };

    // NEW HANDLER for CSV export
    const handleCsvExport = () => {
        exportDataToCsv(analysisType, timeSeriesData, spectroscopyData, config);
    };

    // NEW HANDLER for plot export
    const handlePlotExport = () => {
        const activeTab = analysisType === 'time_series' ? activeTimeSeriesTab : activeSpectroscopyTab;
        exportPlotsToZip(analysisType, activeTab, config, setIsExporting, addLogMessage);
    };

    const disableButtons = isExporting; // Can add isProcessing here too if needed

    const handleNewAnalysis = () => {
        resetAppState(); // This will also set currentStep back to 'upload_config'
    };

    // Effect to set default active tab when analysisType changes or data loads
    useEffect(() => {
        if (analysisType === 'time_series') {
            setActiveTimeSeriesTab('impedance');
        } else if (analysisType === 'spectroscopy') {
            setActiveSpectroscopyTab('impedance3d');
        }
    }, [analysisType]);


    const renderTabNavigation = () => {
        if (analysisType === 'time_series') {
            return (
                <div className="tab-navigation">
                    <button
                        className={`tab-button ${activeTimeSeriesTab === 'impedance' ? 'active' : ''}`}
                        onClick={() => setActiveTimeSeriesTab('impedance')}
                    >
                        Impedance
                    </button>
                    <button
                        className={`tab-button ${activeTimeSeriesTab === 'phase' ? 'active' : ''}`}
                        onClick={() => setActiveTimeSeriesTab('phase')}
                    >
                        Phase
                    </button>
                    <button
                        className={`tab-button ${activeTimeSeriesTab === 'signal' ? 'active' : ''}`}
                        onClick={() => setActiveTimeSeriesTab('signal')}
                    >
                        Signal
                    </button>
                </div>
            );
        } else if (analysisType === 'spectroscopy') {
            return (
                <div className="tab-navigation">
                    <button
                        className={`tab-button ${activeSpectroscopyTab === 'impedance3d' ? 'active' : ''}`}
                        onClick={() => setActiveSpectroscopyTab('impedance3d')}
                    >
                        3D Impedance
                    </button>
                    <button
                        className={`tab-button ${activeSpectroscopyTab === 'phase3d' ? 'active' : ''}`}
                        onClick={() => setActiveSpectroscopyTab('phase3d')}
                    >
                        3D Phase
                    </button>
                </div>
            );
        }
        return null;
    };

    const renderTabContent = () => {
        if (analysisType === 'time_series') {
            return (
                <div className="tab-content">
                    <TimeSeriesPlots activeTab={activeTimeSeriesTab} />
                </div>
            );
        } else if (analysisType === 'spectroscopy') {
            // RENDER THE NEW COMPONENT
            return (
                <div className="tab-content">
                    <SpectroscopyPlots activeTab={activeSpectroscopyTab} />
                </div>
            );
        }
        return <div className="tab-content">Please select an analysis type and process data.</div>;
    };



    return (
        <div className="step-view results-view">
            <h2>Step 3: View Data & Export Results</h2>

            <div className="action-buttons-group">
                <button id="export-xlsx-btn" onClick={handleXlsxExport} disabled={disableButtons}>
                    Export All to XLSX
                </button>
                <button id="export-csv-btn" onClick={handleCsvExport} disabled={disableButtons}>
                    Export All to CSV
                </button>
                <button id="export-plots-btn" onClick={handlePlotExport} disabled={disableButtons}>
                    {isExporting ? 'Exporting Plots...' : 'Export Current Plots to PNG'}
                </button>
                <button id="new-analysis-btn" onClick={handleNewAnalysis} disabled={disableButtons}>
                    Start New Analysis
                </button>
            </div>

            {/* Placeholder for Plot Range Controls (Time-Series) */}
            {analysisType === 'time_series' && (
                <div id="plot-range-controls-timeseries" className="plot-range-controls">
                    <label htmlFor="start">Plot Start Time (min):</label>
                    <input
                        type="number"
                        id="start"
                        name="start" // Match state key
                        placeholder="e.g., 0"
                        step="any"
                        value={plotTimeRange.start} // Controlled component
                        onChange={handleTimeRangeChange} // Use new handler
                    />
                    <label htmlFor="end">Plot End Time (min):</label>
                    <input
                        type="number"
                        id="end"
                        name="end" // Match state key
                        placeholder="e.g., 120"
                        step="any"
                        value={plotTimeRange.end} // Controlled component
                        onChange={handleTimeRangeChange} // Use new handler
                    />
                    {/* The "Update" button is no longer strictly necessary as we can update
                        the plots live as the time range changes in context.
                        We'll leave it out for a more modern reactive feel. */}
                </div>
            )}


            {renderTabNavigation()}
            <div id="charts-container">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default ResultsView;