/*
 * Copyright 2026 Comcast Cable Communications Management, LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button, Typography, Box } from '@mui/material'; 
import Grid from '@mui/material/Grid2';
import { ToastContainer, toast } from 'react-toastify'; // Importing toast for notifications
import 'react-toastify/dist/ReactToastify.css'; // Importing toast styles
import { AgGridReact } from 'ag-grid-react';
import "@ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the Data Grid
import "@ag-grid-community/styles/ag-theme-quartz.css"; // Optional Theme applied to the Data Grid
import { config } from '../config';
import { callBackendAPI } from '../PortalUtils';

const EditConfig = () => {
    const gridRef = useRef(null); // Reference to the grid component
    const [rowData, setRowData] = useState([]); // State to hold the row data for the grid

    // Column definitions for the grid
    const columnDefs = useMemo(() => [
        { field: "type", editable: true },
        { field: "key", editable: true },
        { field: "Production", editable: true },
        { field: "Staging", editable: true },
        { field: "Development", editable: true }
    ], []);

    // Default column definition for the grid
    const defaultColDef = useMemo(() => {
        return {
            filter: "agTextColumnFilter",
            floatingFilter: true,
            flex: 1,
        };
    }, []);

    // Row selection configuration
    const rowSelection = {
        mode: "multiRow",
        suppressRowDeselection: true,
        suppressRowClickSelection: true,
    };

    // Function to load configuration data from the server
    const loadConfig = async () => {
        try {
            const url = config["GetConfig"];
            const response = await callBackendAPI(url, 'GET');
            const data = await response.json();
            const configData = [];
            Object.keys(data).forEach((key) => {
                configData.push(data[key]);
            });

            setRowData(configData);

        } catch (error) {
            if (import.meta.env.DEV) console.error('Error loading configuration:', error);
            toast.error('Failed to load configuration. Please try again.');
        }
    }

    // Function to save the configuration data to the server
    const saveConfig = async () => {
        try {
            const data = [];
            gridRef.current.api.forEachNode((node) => data.push(node.data));

            const configData = {}
            const duplicateKeys = new Set();

            data.forEach((row) => {
                let key = row["key"];
                if (configData[key]) {
                    duplicateKeys.add(key);
                } else {
                    configData[key] = row;
                }
            });

            if (duplicateKeys.size > 0) {
                toast.error(`Error: Duplicate keys found - ${Array.from(duplicateKeys).join(', ')}`);
                return;
            }

            const url = config["UpdateConfig"];
            await callBackendAPI(url, 'POST', configData);
            
            toast.dismiss();
            toast.success('Configuration saved successfully!');
                
        } catch (error) {
            if (import.meta.env.DEV) console.error('Error saving configuration:', error);
            toast.dismiss();
            toast.error(error.message || 'Failed to save configuration. Please try again.');
        }
    }

    // Function to handle adding a new configuration row
    const addConfig = () => {
        const newRow = {
            type: "Enter Type",
            key: "Enter Key",
            Production: "Enter Value",
            Staging: "Enter Value",
            Development: "Enter Value"
        };
        gridRef.current.api.applyTransaction({ add: [newRow], addIndex: 0 });
    }

    // Function to handle removing selected configuration rows
    const removeConfig = () => {
        const selectedRows = gridRef.current.api.getSelectedRows();
        if (selectedRows.length === 0) {
            toast.warning("No rows selected for deletion.");
            return;
        }
        gridRef.current.api.applyTransaction({ remove: selectedRows });
    }

    // Function to handle exporting the grid data as CSV
    const handleExportCSV = () => {
        gridRef.current.api.exportDataAsCsv({
            fileName: 'config_export.csv',
            columnKeys: ['type', 'key', 'Production', 'Staging', 'Development']
        });
        toast.success('CSV exported successfully!');
    }

    // Load the configuration data when the component mounts
    useEffect(() => {
        loadConfig();
    }, []);

    return (
        <Grid container spacing={2} sx={{ width: '100%', height: '100%', padding:'2rem' }}>
            <Typography variant="h6">
                ArcGIS Experience Apps Configuration Details
            </Typography>
            <Grid container spacing={2} size={12}>
                <Grid container spacing={2} size={12}>
                    <Grid size={12}>
                        <Box display="flex" justifyContent="flex-start" gap={2}>
                            <Button className="Button" variant="contained" color="primary" onClick={loadConfig} aria-label="Load Config">Load Config</Button>
                            <Button className="Button" variant="contained" color="primary" onClick={handleExportCSV} aria-label="Save Changes">Export CSV</Button>
                        </Box>
                    </Grid>
                   <Grid size={12} sx={{ flexGrow: 1 }}>
                        <Box display="flex" justifyContent="flex-end" gap={2}>
                            <Button className="Button" variant="outlined" color="primary" onClick={addConfig} aria-label="Add Config">Add Config</Button>
                            <Button className="Button" variant="outlined" color="primary" onClick={removeConfig} aria-label="Delete Config">Delete Config</Button>
                            <Button className="Button" variant="contained" color="primary" onClick={saveConfig} aria-label="Export CSV">Save Changes</Button>
                        </Box>
                    </Grid>  
                </Grid>
                <Grid container spacing={2} size={12} sx={{ width: '100%', height: '100%' }}>
                    <Box className="ag-theme-quartz" sx={{ width: '100%', height: '100%', flexGrow: 1 }}>
                        <AgGridReact
                            ref={gridRef}
                            rowData={rowData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            pagination={true}
                            paginationPageSize={10}
                            paginationPageSizeSelector={[10, 20, 50]}
                            rowSelection={rowSelection}
                            domLayout='autoHeight'
                        />
                    </Box>
                </Grid>
            </Grid>
            <ToastContainer />
        </Grid> 
    );
};

export default EditConfig;