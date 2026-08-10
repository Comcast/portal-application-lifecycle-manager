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

import React, { useState, useRef, useCallback, useEffect} from 'react';
import PropTypes from 'prop-types';
import { AgGridReact } from 'ag-grid-react'
import "@ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the Data Grid
import "@ag-grid-community/styles/ag-theme-quartz.css"; // Optional Theme applied to the Data Grid
import { themeQuartz } from '@ag-grid-community/theming';
import { Button, FormControl, MenuItem, Select, Typography,  TextField, Autocomplete, Radio, RadioGroup, FormControlLabel, FormLabel, Tab, Box } from '@mui/material'
import Grid from '@mui/material/Grid2';
import { TabList, TabPanel, TabContext } from '@mui/lab';
import { config,  portalList, searchFields, searchTypes } from '../config';
import '../App.css'
import { fetchAllAppIds, fetchItemData, fetchServiceData, callBackendAPI } from '../PortalUtils';

const getComparisonStyle = (value, compareValue, isDateField, textMissingItem, textDiffLargeObj) => {
    if (isDateField) {
        return { overflow: 'auto', maxHeight: '100px' };
    }
    if (value === textMissingItem) {
        return { overflow: 'auto', maxHeight: '100px', color: 'red' };
    }
    if (value && value.length > 1000) {
        return value === compareValue ? { overflow: 'auto', maxHeight: '100px' } : { overflow: 'auto', maxHeight: '100px', color: 'red' };
    }
    return { overflow: 'auto', maxHeight: '100px' };
};

const ScrollableCellRenderer = ({ value, data, textMissingItem, textDiffLargeObj, portalKey0 }) => {
    let strValue = '';
    if (value !== undefined && value !== '' && value !== null) {
        strValue = value.toString();
    }
    const isDateField = data.key === 'created' || data.key === 'modified';
    if (isDateField) {
        strValue = new Date(value).toLocaleString();
    }
    let compareValue = '';
    if (data[portalKey0] !== undefined && data[portalKey0] !== '' && data[portalKey0] !== null) {
        compareValue = data[portalKey0].toString();
    }
    if (strValue === null) {
        return <div style={{ overflow: 'auto', maxHeight: '100px' }}>{strValue}</div>;
    }
    const style = getComparisonStyle(strValue, compareValue, isDateField, textMissingItem, textDiffLargeObj);
    if (strValue.length > 1000 || strValue === textMissingItem || (strValue !== compareValue && compareValue === textMissingItem)) {
        return <div style={style}>{strValue}</div>;
    }
    let compChars = [];
    if (compareValue !== null && compareValue.length > 0) {
        compChars = compareValue.split('');
    }
    return (
        <div style={style}>
            {typeof strValue === 'string' ? (strValue.split('').map((char, index) => (
                char === compChars[index] ?
                    <span key={`${index}-${char}-match`}>{char}</span>
                    :
                    <span key={`${index}-${char}-diff`} style={{ color: 'red' }}>{char}</span>
            ))) : strValue}
        </div>
    );
};

ScrollableCellRenderer.propTypes = {
    value: PropTypes.any,
    data: PropTypes.object.isRequired,
    textMissingItem: PropTypes.string.isRequired,
    textDiffLargeObj: PropTypes.string.isRequired,
    portalKey0: PropTypes.string.isRequired
};

const myTheme = themeQuartz.withParams({
    fontFamily: [
        'Avenir Next',
        'Helvetica Neue',
        'sans-serif',
        'PingFang SC',
        'Microsoft YaHei',
      ].join(','),
});


const maxDifferences = 500 // max number of differences to recurse into objects for compare
const textDiffLargeObj = 'Object is different' 
const textMissingItem = 'Missing'

const CompareForm = () => {

    const gridRef1 = useRef(null)
    const gridRef2 = useRef(null)
    const gridRef3 = useRef(null)
    const hasLoadedConfig = useRef(false)
    const [selectedId0, setSelectedId0] = useState('')
    const [selectedId1, setSelectedId1] = useState('')
    const [selectedId2, setSelectedId2] = useState('')
    const [portalKey0, setPortalKey0] = useState('')
    const [portalKey1, setPortalKey1] = useState('')
    const [portalKey2, setPortalKey2] = useState('')
    const [searchField, setSearchField] = useState(Object.keys(searchFields)[0])
    const [appListData0, setAppListData0] = useState([])
    const [appListData1, setAppListData1] = useState([])
    const [appListData2, setAppListData2] = useState([])
    const [appData0, setAppData0] = useState({})
    const [configData, setConfigData] = useState({})
    const [selectedMapId, setSelectedMapId] = useState('')
    const [selectedMapIdForServices, setSelectedMapIdForServices] = useState('')
    const [selectedServiceId, setSelectedServiceId] = useState('')
    const [webMapDisplayOptions, setWebMapDisplayOptions] = useState({});
    const [webMapDiffs, setWebMapDiffs] = useState({})
    const [serviceOptions, setServiceOptions] = useState([]);
    const [serviceDiffs, setServiceDiffs] = useState({})
    const allWebMapData0 = useRef({})
    const allWebMapData1 = useRef({})
    const allWebMapData2 = useRef({})
    const [serviceData0, setServiceData0] = useState({})
    const [serviceData1, setServiceData1] = useState({})
    const [serviceData2, setServiceData2] = useState({})
    const [showWebMap, setShowWebMap] = useState(false)
    const [showServices, setShowServices] = useState(false)
    const [searchType, setSearchType] = useState(Object.keys(searchTypes)[0])

    const webMaps0 = useRef({})
    const webMaps1 = useRef({})
    const webMaps2 = useRef({})


    const defaultColDef = {
        filter: false,
        suppressMovable: true         
    }

    const [rowData1, setRowData1] = useState([]);
    const [rowData2, setRowData2] = useState([]);
    const [rowData3, setRowData3] = useState([]);

    const [gridOptions1, setGridOptions1] = useState({
        columnDefs: [defaultColDef],
        rowData: null
    })

    const [gridOptions2, setGridOptions2] = useState({
        columnDefs: [defaultColDef],
        rowData: null
    })

    const [gridOptions3, setGridOptions3] = useState({
        columnDefs: [defaultColDef],
        rowData: null
    })


    const onBtnExport1 = useCallback(() => {
        gridRef1.current.api.exportDataAsCsv({fileName: 'palm-compare-' + selectedId0 + '.csv'});
      }, [selectedId0]);

    const onBtnExport2 = useCallback(() => {
        gridRef2.current.api.exportDataAsCsv({fileName: 'palm-compare-' + selectedId0 + '-' + selectedMapId + '.csv'});
    }, [selectedId0, selectedMapId]);

    const onBtnExport3 = useCallback(() => {
        gridRef3.current.api.exportDataAsCsv({fileName: 'palm-compare-' + selectedId0 + '-' + selectedMapIdForServices + '-' + selectedServiceId + '.csv'});
      }, [selectedId0, selectedMapIdForServices, selectedServiceId]);
   
    const [tabValue, setTabValue] = useState('1');

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const setAppIds = (portalIndex, data) => {
        switch(portalIndex){
            case 0:
                setAppListData0(data)
                break
            case 1:
                setAppListData1(data)
                break
            case 2:
                setAppListData2(data)
                break
        }
    }

    const getUniqueKeys = (data0, data1, data2) => {
        let uniqueValues = []
        if (data0 !== undefined && data0 !== null) {
            uniqueValues = Object.keys(data0)
        }
        if (data1 !== undefined && data1 !== null) {
            uniqueValues = uniqueValues.concat(Object.keys(data1))
        }
        if (data2 !== undefined && data2 !== null) {
            uniqueValues = uniqueValues.concat(Object.keys(data2))
        }
        let s = new Set(uniqueValues)
        uniqueValues = Array.from(s)
        return uniqueValues
    }

    /* replace missing objects with text 'missing' */
    const handleUndefined = (data, key) => {
        if (data === null) {
            data = {}
        }
        if (typeof data !== 'object') {
            data = {}
        }
        if (data[key] === undefined) {   
            data[key] = textMissingItem
        }
        return data
     }

    const isUnexpectedDiff = (portal1, portal2, datakey, data1, data2) => { 
        let isValidDiff = false
        let val1 = data1[datakey]
        let val2 = data2[datakey]
        if (typeof val1 === 'object')
            val1 = JSON.stringify(val1)
        if (typeof val2 === 'object')
            val2 = JSON.stringify(val2)
        if (val1 === val2) {
            // check if values should be different based on config
            if (typeof val1 === 'string' && typeof val2 === 'string') {
                Object.keys(configData).forEach((key) => {
                    let item = configData[key]
                    let keysToCheck = Object.keys(item).filter(k => k !== "description" && k !== "type" && k !== "key" && k !== portal1);
                    keysToCheck.forEach(k => {
                        if (val1.includes(item[k])) {
                            isValidDiff = true;
                        }
                    });
                    keysToCheck = Object.keys(item).filter(k => k !== "description" && k !== "type" && k !== "key" && k !== portal2);
                    keysToCheck.forEach(k => {
                        if (val2.includes(item[k])) {
                            isValidDiff = true;
                        }
                    });
                    
                })
            }
        }
        else {
            isValidDiff = true
            // find urls in config data
            if (typeof val1 === 'string' && typeof val2 === 'string') {
                Object.keys(configData).forEach((key) => {
                    let item = configData[key]
                    if (item[portal1] !== undefined && item[portal2] !== undefined) {
                        if (val1.includes(item[portal1]) && val2.includes(item[portal2])) {
                            
                            let config1 = item[portal1]
                            let config2 = item[portal2]
    
                            val1 = val1.replaceAll(config1, '')
                            val2 = val2.replaceAll(config2, '')
                            
                            if (val1 === val2) {
                                isValidDiff = false
                            }
                        }
                    }
                })
            }
        }
        return isValidDiff
    }

    /* return true if data contains any config value */
    /* used for flagging unexpected similarities between environments */
    const hasWrongConfig = (portalName, data) => {

        if (!data || data === undefined) return false
        let retval = false

        const found = Object.keys(configData).find((key) =>
            Object.keys(configData[key]).some((subKey) =>
            (subKey === "Production" || subKey === "Staging" || subKey === "Development") &&
            data.includes(configData[key][subKey])
            )
        );

        if (found)
        {
            if (!data.includes(configData[found][portalName])) {
                retval = true // return true if data doesn't match config for this portal

            }
        }

        return retval
    }


    const formatData = (data) => {
        return (typeof data === 'object' || typeof data === 'boolean')? JSON.stringify(data) : data
    }

    const getUniquePortalKeys = () => {
        let uniqueKeys = []
        if (portalKey0 !== '') {
            uniqueKeys.push(portalKey0)
        }
        if (portalKey1 !== '') {
            if (!uniqueKeys.includes(portalKey1)) {
                uniqueKeys.push(portalKey1)
            }
            else {
                // if portalKey1 is already in the list, append (2) to it
                uniqueKeys[uniqueKeys.indexOf(portalKey1)] = portalKey1 + ' (2)'
            }
        }
        if (portalKey2 !== '') {
            if (!uniqueKeys.includes(portalKey2)) {
                // if portalKey2 is not in the list, add it
                uniqueKeys.push(portalKey2)
            }
            else {
                // if portalKey2 is already in the list, append (3) to it
                uniqueKeys[uniqueKeys.indexOf(portalKey2)] = portalKey2 + ' (3)'
            }
        }
        return uniqueKeys
    }


    const handleDeepCompare = (node, data0, data1, data2) => {
      //  console.log('handleDeepCompare:', node) 
      //  console.log('data0:', data0)

        let diffList = []
        let allKeys = getUniqueKeys(data0, data1, data2)

        const uniquePortalKey = getUniquePortalKeys()
        const portalName0 = uniquePortalKey[0]
        const portalName1 = uniquePortalKey[1]
        const portalName2 = uniquePortalKey.length > 2 ? uniquePortalKey[2] : null
     
        allKeys.forEach((key) => {
            //console.log('key:', key)
            data0 = handleUndefined(data0, key)
            if (data0[key] != null && typeof data0[key] === 'object') {
                data1 = handleUndefined(data1, key)
                if (data2 !== null) {
                    //console.log('data2:', data2)
                    data2 = handleUndefined(data2, key)
                }
                // flag to stop recursion if we do not have valid data for portal 1 and portal 2 (if comparing portal 2)
                let abortRecursion = false
                let diff = {}
                if (typeof data1[key] !== 'object' || data1[key] === null)
                {
                    //console.log('data1[key]:', data1[key])
                    diff['key'] = node + '/' + key
                    diff[portalName0] = formatData(data0[key])
                    diff[portalName1] = formatData(data1[key])
                    if (data2 !== null) {
                        diff[portalName2] = formatData(data2[key])
                    }
                    
                    abortRecursion = true // stop recursion if we have do not have valid data for portal 1
                }       
                if (data2 !== null) {
                    if (typeof data2[key] !== 'object' || data2[key] === null)
                    { 
                        //console.log('data2[key]:', data2[key])
                        diff['key'] = node + '/' + key
                        diff[portalName0] = formatData(data0[key])
                        diff[portalName1] = formatData(data1[key])
                        diff[portalName2] = formatData(data2[key])
                    }
                    else { 
                        abortRecursion = false // continue recursion if we have valid data for portal 2
                    }
                }
                if (Object.keys(diff).length !== 0 && abortRecursion === true) {
                    //console.log("abort recursions! diff:", diff)
                    diffList = diffList.concat(diff)
                }
                // continue recursion if we have valid data for portal 1 or portal 2
                if (!abortRecursion) {
                    //console.log('recursing into:', node + '/' + key)
                    if (diffList.length > maxDifferences)
                    {
                        //console.log('max differences reached!')
                        let isDifferent2 = false
                        let isDifferent1 = false
                        // we have too many differences to recurse further, compare the objects as strings
                        if (JSON.stringify(data0[key]) !== JSON.stringify(data1[key])) {
                            isDifferent1 = true
                        }
                        else if (data2 !== null) {
                            if (JSON.stringify(data0[key]) !== JSON.stringify(data2[key])) {
                                isDifferent2 = true
                            }
                        }
                        if (isDifferent1 || isDifferent2){
                            let diff = {}
                            diff['key'] = node + '/' + key
                            diff[portalName0] = 'Object' 
                            diff[portalName1] = isDifferent1 ? textDiffLargeObj : 'Object is the same' 
                            if (data2 !== null) {
                                diff[portalName2] = isDifferent2 ? textDiffLargeObj : 'Object is the same' 
                            }
                            diffList = diffList.concat(diff)
                        }
                    }
                    else {
                        let value2 = null
                        if (data2 !== undefined && data2 !== null) {
                            value2 = data2[key]
                        }

                        let diff = handleDeepCompare(node + '/' + key, data0[key], data1[key], value2)
                        if (diff.length !== 0) {
                            diffList = diffList.concat(diff)
                        }
                    }
                }
                else {
                    //console.log('aborting recursion into:', node + '/' + key)
                }
                
            }
            else { 
                // check for missing parent object
                data1 = handleUndefined(data1, key)
                let isDifferent = false 
                if (isUnexpectedDiff(portalName0, portalName1, key, data0, data1)) {
                    isDifferent = true
                }
                if (data2 !== null) {
                    data2 = handleUndefined(data2, key)
                    if (isUnexpectedDiff(portalName0, portalName2, key, data0, data2)) {
                        isDifferent = true
                    }
                }
                
                if (isDifferent) {
                    let diff = {}
                    
                    let handleMissing = false
                    if (data1[key] === textMissingItem) {
                        handleMissing = true
                    }
                    else if (data2 !== null) {
                        if (data2[key] === textMissingItem) {
                            handleMissing = true
                        }
                    }
                    if (handleMissing) {
                        // show difference at node level 
                        const existingDiff = diffList.find(diff => diff.key === node);
                        if (!existingDiff) {
                            diff['key'] = node;
                            diff[portalName0] = formatData(data0[key])
                            diff[portalName1] = data1[key] === textMissingItem ? textMissingItem : JSON.stringify(data1);
                            if (data2 !== null) {
                                diff[portalName2] = data2[key] === textMissingItem ? textMissingItem : JSON.stringify(data2);
                            }
                            diffList = diffList.concat(diff);
                        }
                    }
                    else{
                        diff['key'] = node + '/' + key
                        diff[portalName0] = formatData(data0[key])
                        diff[portalName1] = formatData(data1[key])
                        if (data2 !== null) {
                            diff[portalName2] = formatData(data2[key])
                        }
                        diffList = diffList.concat(diff)
                    }
                    
                }
            }
        }
        )
        if (Object.keys(data0).includes('label') && diffList.length > 0) 
        {
            let diff= {}
            let key  = 'label'
            diff['key'] = node + '/' + key
            diff[portalName0] = formatData(data0[key])
            diff[portalName1] = formatData(data1[key])
            if (data2 !== null) {
                diff[portalName2] = formatData(data2[key])
            }
            diffList.unshift(diff)
        }
        return diffList
    }

    const getServiceInfo = (node, data) => {
        let serviceList = {}
        if (Object.keys(data).length > 0) {
            Object.keys(data).forEach((key) => {
                if (key === 'url' && data.hasOwnProperty('id')) {
                    let service = {}
                    service['url'] = data[key]
                    service['id'] = data['id']
                    service['title'] = data['title']
                    serviceList[node] = service    
                }
                else if (typeof data[key] === 'object' && data[key] != null) {
                    serviceList = {...serviceList, ...getServiceInfo(key, data[key])}
                }
            })
        }
        return serviceList
    }

    
    const fetchAllServiceDataForMap = async (serviceList, portalIndex, portalKey) => {
        let allServiceData = {}
        await Promise.all(Object.keys(serviceList).map(async (key) => {
            let url = serviceList[key]['url'] 
            let title = serviceList[key]['title']

            try {
                let serviceData = {'title': title}
                let data = await fetchServiceData(portalIndex, portalKey, url)
                if (data !== undefined) {
                    serviceData = {...serviceData, ...data}
                    allServiceData[title] = serviceData
                }
            }
            catch(error){
                if (import.meta.env.DEV) console.error(error);
            }
        })
        )
        return allServiceData
    }


    const fetchAllServiceData = async (serviceList, portalIndex, portalKey) => {
        let allServiceData = {}
        await Promise.all(Object.keys(serviceList).map(async (mapId) => {
           let servicesForMap = serviceList[mapId]
           allServiceData[mapId] = await fetchAllServiceDataForMap(servicesForMap, portalIndex, portalKey)
        })
        )
        return allServiceData
    }

    const getServicesForMap = (webMapData) => {
        let mapServices = {}
        Object.keys(webMapData).forEach((key) => {
            let services = getServiceInfo('root', webMapData[key])
            mapServices[key] = services
        })
        return mapServices
    }

    const compareServices = (allServiceData0, allServiceData1, allServiceData2) => {
        let diffList = {}

        //console.log('allServiceData0:', allServiceData0)
        //console.log('allServiceData1:', allServiceData1)
        //console.log('allServiceData2:', allServiceData2)

        const uniquePortalKey = getUniquePortalKeys()
        const portalName0 = uniquePortalKey[0]
        const portalName1 = uniquePortalKey[1]
        const portalName2 = uniquePortalKey.length > 2 ? uniquePortalKey[2] : null

        let mapsIds = getUniqueKeys(allServiceData0, allServiceData1, allServiceData2)
        mapsIds.forEach((mapId) => {
            let mapDiffList = {}
            let services0 = allServiceData0[mapId]
            let services1 = allServiceData1[mapId]
            let services2 = null
            if (allServiceData2 !== null) {
                services2 = allServiceData2[mapId]
            }
        
           let serviceIds = getUniqueKeys(services0, services1, services2)
            serviceIds.forEach((serviceId) => {
                let data0 = {}
                let data1 = {}
                let data2 = null

                if (services0 !== undefined && services0 !== null) {
                    if (services0[serviceId] !== undefined) {
                        data0 = services0[serviceId]
                    }
                }
                if (services1 !== undefined && services1 !== null) {
                    if (services1[serviceId] !== undefined) {
                        data1 = services1[serviceId]
                    }
                }
                if (services2 !== undefined && services2 !== null) {
                    if (services2[serviceId] !== undefined) {
                        data2 = services2[serviceId]
                    }
                    else
                    {
                        data2 = {}
                    }
                }
                let diff = handleDeepCompare('', data0, data1, data2)
                // include title, even if no differences
                let hasTitle = false
                for (const item of diff) {
                    if (item.key === '/title') {
                        hasTitle = true;
                        break;
                    }
                }
                if (Object.keys(data0).includes('title') && !hasTitle)
                {
                    let diffTitle= {}
                    let key  = 'title'
                    diffTitle['key'] = key
                    diffTitle[portalName0] = formatData(data0[key])
                    diffTitle[portalName1] = data1?.hasOwnProperty(key) ? formatData(data1[key]) : textMissingItem
                    if (data2 !== null) {
                        diffTitle[portalName2] = formatData(data2[key])
                    }
                    diff.unshift(diffTitle)
                }
                mapDiffList[serviceId] = diff
            })
            diffList[mapId] = mapDiffList
            if (serviceIds.length > 0) {
                setShowServices(true)
            }
        })
        //console.log('diffList:', diffList)
        
        return diffList
    }

    const getWebMapIds = (node, data) => {
        let webMapList = {}
        if (data !== undefined && data !== null) {
            if (Object.keys(data).length > 0) {
                Object.keys(data).forEach((key) => {
                    if (key === 'type' && (data[key] === 'WEB_MAP' || data[key] === 'mapWidget')) {
                        webMapList[node] = data
                    }
                    else if (typeof data[key] === 'object' && data[key] != null) {
                        webMapList = {...webMapList, ...getWebMapIds(key, data[key])}
                    }
                })
            }
        }
        return webMapList
    }

    const getWebMapTitle = (webMap, itemId) => {
        return webMap['sourceLabel'] || webMap['title'] || itemId;
    }

    const fetchAllWebMapData = async (webMapIds, portalIndex, portalKey) => {
        let allWebMapData = {}

        await Promise.all(Object.keys(webMapIds).map(async (key) => {
            let webMap = webMapIds[key]
            let itemId = webMap['itemId']
            let title = getWebMapTitle(webMap, itemId)
            try {
                let webMapData = {'title': title}   
                let data = await fetchItemData(portalIndex, portalKey, itemId)
                if (data !== undefined) {
                    webMapData = {...webMapData, ...data}
                    allWebMapData[itemId] = webMapData
                }
            }
            catch(error){
                if (import.meta.env.DEV) console.error(error);
            }
        })
        )
        return allWebMapData
    }




    const getWebMapTitleFromData = (key, allWebMapData0, allWebMapData1, allWebMapData2) => {
        if (allWebMapData0.hasOwnProperty(key)) {
            return allWebMapData0[key]['title'];
        }
        if (allWebMapData1.hasOwnProperty(key)) {
            return allWebMapData1[key]['title'];
        }
        if (allWebMapData2 !== null && allWebMapData2.hasOwnProperty(key)) {
            return allWebMapData2[key]['title'];
        }
        return '';
    }

    const compareWebMaps = (allWebMapData0, allWebMapData1, allWebMapData2) => {
        let diffList = {}
        const uniquePortalKey = getUniquePortalKeys()
        const portalName0 = uniquePortalKey[0]
        const portalName1 = uniquePortalKey[1]
        const portalName2 = uniquePortalKey.length > 2 ? uniquePortalKey[2] : null

        let webMapKeys = getUniqueKeys(allWebMapData0, allWebMapData1, allWebMapData2)
        let webMapTitles = {}
        // get web map titles associated with ids
        for (const key of webMapKeys) {
            let title = getWebMapTitleFromData(key, allWebMapData0, allWebMapData1, allWebMapData2);
            webMapTitles[title] = key
        }
        setWebMapDisplayOptions(webMapTitles)
        //console.log('webMapKeys:', webMapKeys)
        webMapKeys?.forEach((key) => {
            let webMap0 = allWebMapData0[key]
            let webMap1 = allWebMapData1[key]
            let webMap2 = null
            if (allWebMapData2 !== null && allWebMapData2 !== undefined) {
                webMap2 = allWebMapData2[key] || null
            }

            let diff = handleDeepCompare('', webMap0, webMap1, webMap2)
            // include title, even if no differences
            //console.log('webMap0:', webMap0)
            if (webMap0 !== undefined && webMap0 !== null) {
                if (Object.keys(webMap0).includes('title'))
                {
                    let diffTitle= {}
                    let titlekey  = 'title'
                    diffTitle['key'] = titlekey
                    diffTitle[portalName0] = formatData(webMap0[titlekey])
                    diffTitle[portalName1] = webMap1?.hasOwnProperty(titlekey) ? formatData(webMap1[titlekey]) : textMissingItem
                    if (allWebMapData2 !== null && portalName2 !== null) {
                        diffTitle[portalName2] = webMap2?.hasOwnProperty(titlekey) ? formatData(webMap2[titlekey]) : textMissingItem
                    }
                    diff.unshift(diffTitle)
                }
            }
            diffList[key] = diff
        })
        if (webMapKeys.length > 0) {
            setShowWebMap(true)
        }
        return diffList
    }


    const clearData = () => {
        setRowData1([])
        setRowData2([])
        setRowData3([])
        setSelectedMapId('')
        setSelectedMapIdForServices('')
        setSelectedServiceId('')
        setServiceOptions([])
        setWebMapDisplayOptions({})

        allWebMapData0.current = {}
        allWebMapData1.current = {}
        allWebMapData2.current = {}
        webMaps0.current = {}
        webMaps1.current = {}
        webMaps2.current = {}

        setShowServices(false)
        setShowWebMap(false)
        setTabValue('1')
    }

    const handleCompare = async (event) => {
        
        clearData()
        const idFirstEnv = selectedId0
        const idSecondEnv = selectedId1
        const idThirdEnv = selectedId2

        const field = searchFields[searchField]
        let fieldList = []
        Object.keys(searchFields).forEach((key) => {
            fieldList.push(searchFields[key])
        })

        if (idFirstEnv === '' || idSecondEnv === '') {
            alert('Please select valid ' + field + 's to compare')
            return
        }

        const data0 = appListData0.find((item) => item[field] === idFirstEnv)
        const data1 = appListData1.find((item) => item[field] === idSecondEnv)
        const data2 = appListData2.find((item) => item[field] === idThirdEnv)

        if (data1 === undefined) {
            alert('No application with ' + field + ' = "' + idFirstEnv + '" found in ' + portalKey1)
            return
        }

        let diffData0 = {}
        let diffData1 = {}
        let diffData2 = {}
        let diffKeys = []  

        let appData0 = await fetchItemData(0, portalKey0, data0['id'])
        let appData1 = await fetchItemData(1, portalKey1, data1['id'])
        let appData2 = null

        if (data2 !== undefined) {
            appData2 = await fetchItemData(2, portalKey2, data2['id'])
        }

        let deepCompareList = []
        if (appData0 !== undefined && appData1 !== undefined) {
            deepCompareList = handleDeepCompare('', appData0, appData1, appData2)
        }
        //console.log('deepCompareList:', deepCompareList)

      
        fieldList.forEach((key) => {
            diffKeys.push(key)
        })
        Object.keys(data0).forEach((key) => {        
            // include all search keys
            if (!fieldList.includes(key))
            {
                // compare objects
                if (typeof data0[key] === 'object' || typeof data1[key] === 'object') {
                    if (isUnexpectedDiff(portalKey0, portalKey1, key, data0, data1)) {
                        diffKeys.push(key)
                    }
                    else if (data2 !== undefined) {
                       if (isUnexpectedDiff(portalKey0, portalKey2, key, data0, data2)) {
                           diffKeys.push(key)
                       }
                    }
                } 
                else if (isUnexpectedDiff(portalKey0, portalKey1, key, data0, data1)) {
                    diffKeys.push(key)
                }
                else if (data2 !== undefined) {
                    if (isUnexpectedDiff(portalKey0, portalKey2,  key, data0, data2)) {
                        diffKeys.push(key)
                    }
                }
            }
            
        }
        )

        diffKeys.forEach((key) => {
            diffData0[key] = formatData(data0[key])
            diffData1[key] = formatData(data1[key])
            if (data2 !== undefined) {
                diffData2[key] = formatData(data2[key])
            }
        })

        let diffData = []

        const uniquePortalKey = getUniquePortalKeys()
        const portalName0 = uniquePortalKey[0]
        const portalName1 = uniquePortalKey[1]
        const portalName2 = uniquePortalKey.length > 2 ? uniquePortalKey[2] : null
        
        Object.keys(diffData0).forEach((key) => {
            let row = {}
            row['key'] = key
            row[portalName0] = diffData0[key]
            row[portalName1] = diffData1[key]
            if (diffData2[key] !== undefined) {
                row[portalName2] = diffData2[key]
            }
            diffData.push(row)
        })

        diffData = [...diffData, ...deepCompareList]
        //console.log('diffData:', diffData)

        // update grid to display differences
        const keys = Object.keys(diffData[0])
        let colDef = keys.map((datum) => {
            if (datum === 'key') {
                return {
                    field: datum,
                    cellDataType: false,
                    headerName: '',
                    pinned: true,
                    filter: true, 
                    flex: 1,
                    wrapText: true,
                }
            }
            else {
                return {
                    field: datum,
                    cellDataType: false,
                    filter: true, 
                    flex: 1, 
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    suppressSizeToFit: true,
                    cellRenderer: ScrollableCellRenderer,
                    autoHeaderHeight: true,
                    cellClass: params => {
                        let colId = params.column.colId 
                        // show in red if value doesn't match first portal env
                        if (params.value !== params.data[portalKey0]) {
                            return 'rag-red'
                        }
                        else
                        {   
                            // display yellow for data that might be different than configured for the portal environment
                            if (params.data[portalKey0] === params.data[colId] && hasWrongConfig(colId, String(params.data[colId])) )
                            {
                                return 'rag-yellow'
                            }
                            return 'rag-green'
                        }
                    }
                }
            }
        })
        
        setGridOptions1({
            ...gridOptions1,
            columnDefs: colDef,
            rowData: diffData
        })
        //console.log(diffData)
        setRowData1(diffData)


        // get web map info
        webMaps0.current = getWebMapIds('root', appData0)
        
        allWebMapData0.current = await fetchAllWebMapData(webMaps0.current, 0, portalKey0)

        webMaps1.current = getWebMapIds('root', appData1)
        allWebMapData1.current = await fetchAllWebMapData(webMaps1.current, 1, portalKey1)

        allWebMapData2.current = null
        if (data2 !== undefined) {
            webMaps2.current = getWebMapIds('root', appData2)
            allWebMapData2.current = await fetchAllWebMapData(webMaps2.current, 2, portalKey2)
        }
        
        let webMapDiffs = compareWebMaps(allWebMapData0.current, allWebMapData1.current, allWebMapData2.current)
        setWebMapDiffs(webMapDiffs)

        // get service info
        let services0 = getServicesForMap(allWebMapData0.current)
        let services1 = getServicesForMap(allWebMapData1.current)
        let services2 = null
        if (data2 !== undefined) {
            services2 = getServicesForMap(allWebMapData2.current)
        }
        let allServiceData0 = await fetchAllServiceData(services0, 0, portalKey0)
        let allServiceData1 = await fetchAllServiceData(services1, 1, portalKey1)
        let allServiceData2 = null
        if (services2 !== null) {
            allServiceData2 = await fetchAllServiceData(services2, 2, portalKey2)
        }

        setServiceData0(allServiceData0)
        setServiceData1(allServiceData1)
        setServiceData2(allServiceData2)

        let serviceDiffs = compareServices(allServiceData0, allServiceData1, allServiceData2)
        setServiceDiffs(serviceDiffs)
    }

    const handleSelectMapId = (title) => {
        setRowData2([])
        let value = webMapDisplayOptions[title]
        setSelectedMapId(title)

        let webMapKeys = [];
        const diffList = webMapDiffs[value]
        if (diffList?.length > 0) {
            if ( Object.keys(diffList[0]).length > 0) {
                webMapKeys = Object.keys(diffList[0]);
            }
        }
 
        let webMapColDefs = webMapKeys.map((datum) => {
            if (datum === 'key') {
                return {
                    field: datum,
                    cellDataType: false,
                    headerName: '',
                    pinned: true,
                    filter: false, 
                    flex: 1,
                    wrapText: true,
                }
            }
            else {
                return {
                    field: datum,
                    cellDataType: false,
                    filter: false, 
                    flex: 1, 
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    suppressSizeToFit: true,
                    cellRenderer: ScrollableCellRenderer,
                    autoHeaderHeight: true,
                    cellClass: params => {
                        let colId = params.column.colId 
                        // show in red if value doesn't match first portal env
                        if (params.value !== params.data[portalKey0]) {
                            return 'rag-red'
                        }
                        else
                        {   
                            // display yellow for data that might be different than configured for the portal environment
                            if (params.data[portalKey0] === params.data[colId] && hasWrongConfig(colId, String(params.data[colId])) )
                            {
                                return 'rag-yellow'
                            }
                            return 'rag-green'
                        }
                    }
                }
            }
        })
        setGridOptions2({
            ...gridOptions2,
            columnDefs: webMapColDefs,
            rowData: diffList
        })
        setRowData2(diffList)
    }

    const handleSelectMapIdForServices = (title) => {
        let value = webMapDisplayOptions[title]
        setRowData3([])
        setSelectedServiceId('')
        setSelectedMapIdForServices(title)
        let services0 = serviceData0[value]
        let services1 = serviceData1[value]
        let services2 = null
        if (serviceData2 !== null) {
            services2 = serviceData2[value]
        }
        let allServices = getUniqueKeys(services0, services1, services2)
        setServiceOptions(allServices)
    }

    const handleSelectServiceId = (value) => {
        setRowData3([])
        //console.log('handleSelectServiceId:', value)
        setSelectedServiceId(value)
        let mapid = webMapDisplayOptions[selectedMapIdForServices]
        let serviceKeys = [];
        const diffList = serviceDiffs[mapid][value]
        if (diffList?.length > 0) {
            if ( Object.keys(diffList[0]).length > 0) {
                serviceKeys = Object.keys(diffList[0]);
            }
        }
 
        let serviceColDefs = serviceKeys.map((datum) => {
            if (datum === 'key') {
                return {
                    field: datum,
                    cellDataType: false,
                    headerName: '',
                    pinned: true,
                    filter: false, 
                    flex: 1,
                    wrapText: true,
                }
            }
            else {
                return {
                    field: datum,
                    cellDataType: false,
                    filter: false, 
                    flex: 1, 
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    suppressSizeToFit: true,
                    cellRenderer: ScrollableCellRenderer,
                    autoHeaderHeight: true,
                    cellClass: params => {
                        let colId = params.column.colId 
                        // show in red if value doesn't match first portal env
                        if (params.value !== params.data[portalKey0]) {
                            return 'rag-red'
                        }
                        else
                        {   
                            // display yellow for data that might be different than configured for the portal environment
                            if (params.data[portalKey0] === params.data[colId] && hasWrongConfig(colId, String(params.data[colId])) )
                            {
                                return 'rag-yellow'
                            }
                            return 'rag-green'
                        }
                    }
                }
            }
        })

        setGridOptions3({
            ...gridOptions3,
            columnDefs: serviceColDefs,
            rowData: diffList
        })
        setRowData3(diffList)
    }

            

    const handleChange = (value, index) => {
        clearData()
        const field = searchFields[searchField]
        if (value !== '') {
            switch(index){
                case 0:
                    setSelectedId0(value)
                    setSelectedId1('')
                    setSelectedId2('')
                    if (appListData1.length !== 0) {
                        const data = appListData1.find((item) => item[field] === value)
                        if (data !== undefined) {
                            // check if ids match
                            if (data['id'] === appListData0.find((item) => item[field] === value)['id']) {
                                setSelectedId1(value)
                            }
                            
                        }
                        const data0 = appListData0.find((item) => item[field] === value)
                        setAppData0(data0 !== undefined ? data0 : {})
                    }   
                    if (appListData2.length !== 0) {
                        const data = appListData2.find((item) => item[field] === value)
                        if (data !== undefined) {
                            // check if ids match
                            if (data['id'] === appListData0.find((item) => item[field] === value)['id']) {
                                setSelectedId2(value)
                            }
                        }
                    }
                    break
                case 1:
                    setSelectedId1(value)
                    break
                case 2:
                    setSelectedId2(value)
                    break
            }
        }
    }

    const handleSetSearchField = (value) => {   
        setSearchField(value)
        setSelectedId0('')
        setSelectedId1('')
        setSelectedId2('')
    }

    const getSelectOptions = (index) => {
        let options = []
        let data = []
        switch(index){
            case 0:
                data = appListData0
                break
            case 1:
                data = appListData1
                break
            case 2:
                data = appListData2
                break
        }
        Object.keys(data).forEach((key) => {
            options.push(data[key][searchFields[searchField]])
        })
        return options
    }

    const handleSetPortal = async (event, index) => {
        setRowData1([])
        const key = event.target.value
        const type = searchType
        switch(index){
            case 0:
                setPortalKey0(key)
                setSelectedId0('')
                break
            case 1:
                setPortalKey1(key)
                setSelectedId1('')
                break
            case 2:
                setPortalKey2(key)
                setSelectedId2('')
                break
        }
        fetchAllAppIds(index, key, type, setAppIds)
    }

    const handleSetSearchType = async (value) => {
        setRowData1([])
        setSearchType(value)
        if (portalKey0) {
            fetchAllAppIds(0, portalKey0, value, setAppIds);
        }
        if (portalKey1) {
            fetchAllAppIds(1, portalKey1, value, setAppIds);
        }
        if (portalKey2) {
            fetchAllAppIds(2, portalKey2, value, setAppIds);
        }
        setSelectedId0('')
        setSelectedId1('')
        setSelectedId2('')
    }

    const options = {
        overlayLoadingTemplate: '<div class="custom-loading-message"><b>Loading...</b></div>',
        overlayNoRowsTemplate: '<div class="custom-no-rows-message">...</div>'
    }

    useEffect(() => {
        // Guard against duplicate calls (React StrictMode in dev mode)
        if (hasLoadedConfig.current) {
            return;
        }
        
        const loadConfig = async () => {
            hasLoadedConfig.current = true; // Mark as loaded immediately
            try {
                const url = config["GetConfig"];
                const response = await callBackendAPI(url, 'GET');
                const data = await response.json();
                setConfigData(data);
            } catch (error) {
                if (import.meta.env.DEV) console.error('Error loading config:', error);
                hasLoadedConfig.current = false; // Reset on error so it can retry
                // Config will be loaded after user signs in
            }
        };
        
        loadConfig();
    }, [])


    return (
        <Grid container spacing={2} sx={{ width: '100%', padding:'2rem' }}>
            <Typography variant="h6">
                Compare Portal Content
            </Typography>
            <Grid container spacing={2} size={12}>  
                <Box sx={{ border: 1, borderColor: 'grey.400', borderRadius: 1, p: 1, mb: 0, display: 'inline-block' }}>    
                    <FormControl>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <FormLabel id="search-type-label" sx={{ ml: 2, mr: 2, minWidth: 100 }}>Search Type</FormLabel>
                            <RadioGroup
                                row
                                aria-labelledby="search-type-label"
                                id="search-type"            
                                onChange={(event) => handleSetSearchType(event.target.value)}
                                defaultValue = {Object.keys(searchTypes)[0]}
                            >
                                {Object.keys(searchTypes).map((key) => (
                                    <FormControlLabel key={key} value={key} control={<Radio />} label={searchTypes[key]} />
                                ))}
                            </RadioGroup>
                        </Box>
                    </FormControl>   
                </Box> 
                <Box sx={{ border: 1, borderColor: 'grey.400', borderRadius: 1, p: 1, mb: 0, display: 'inline-block' }}>    
                    <FormControl>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <FormLabel id="search-field-label" sx={{ ml: 2, mr: 2, minWidth: 100 }}>Search By Field</FormLabel>
                            <RadioGroup
                                row
                                aria-labelledby="search-field-label"
                                id="search-field"            
                                onChange={(event) => handleSetSearchField(event.target.value)}
                                defaultValue = {Object.keys(searchFields)[0]}
                            >
                                {Object.keys(searchFields).map((key) => (
                                    <FormControlLabel key={key} value={key} control={<Radio />} label={searchFields[key]} />
                                ))}
                            </RadioGroup>
                        </Box>
                    </FormControl>   
                </Box> 
            </Grid>
            <Grid container spacing={2} size={12}>
                <Grid size={4}>
                    <Typography variant="subtitle1" id='first-env-label'>First Environment</Typography>
                    <FormControl fullWidth size="small">
                        <Select
                            SelectDisplayProps={{ 'aria-labelledby': 'first-env-label' }}
                            id="first-env-select"            
                            value={portalKey0}
                            onChange={(event) => handleSetPortal(event, 0)}
                        >
                            {Object.keys(portalList).map((key) => (
                                <MenuItem key={key} value={key} aria-label={key}>{key}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={4}>
                    <Typography variant="subtitle1" id='second-env-label'>Second Environment</Typography>
                    <FormControl fullWidth size="small">
                        <Select
                            SelectDisplayProps={{ 'aria-labelledby': 'second-env-label' }}
                            id="second-env-select"
                            value={portalKey1}
                            onChange={(event) => handleSetPortal(event, 1)}
                        >
                            {Object.keys(portalList).map((key) => (
                                <MenuItem key={key} value={key} aria-label={key}>{key}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={4}>
                    <Typography variant="subtitle1" id='third-env-label'>Third Environment (optional)</Typography>
                    <FormControl fullWidth size="small">
                        <Select
                            SelectDisplayProps={{ 'aria-labelledby': 'third-env-label' }}
                            id="third-env-select"
                            value={portalKey2}
                            onChange={(event) => handleSetPortal(event, 2)}
                        >
                            {Object.keys(portalList).map((key) => (
                                <MenuItem key={key} value={key} aria-label={key}>{key}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>
            <Grid container spacing={2} size={12}>  
                <Grid size={4}>
                    <FormControl fullWidth size="small">
                        <Autocomplete id="first-env-app-ids"
                            value = {selectedId0}
                            disablePortal
                            options={getSelectOptions(0)}
                            renderInput={(params) => <TextField {...params} label={"Select " + searchField} />}
                            onChange={(event, value) => handleChange(value, 0)}
                            key={searchField}
                        />
                    </FormControl>
                </Grid>
                <Grid size={4}>
                    <FormControl fullWidth size="small">
                        <Autocomplete id="second-env-app-ids"
                            value = {selectedId1}
                            disablePortal
                            options={getSelectOptions(1)}
                            renderInput={(params) => <TextField {...params} label={"Override " + searchField} />}
                            onChange={(event, value) => handleChange(value, 1)}
                            key={searchField}
                        />
                    </FormControl>
                </Grid>
                <Grid size={4}>
                    <FormControl fullWidth size="small">
                        <Autocomplete id="third-env-app-ids"
                            value = {selectedId2}
                            disablePortal
                            options={getSelectOptions(2)}
                            renderInput={(params) => <TextField {...params} label={"Override " + searchField} />}
                            onChange={(event, value) => handleChange(value, 2)}
                            key={searchField}
                        />
                    </FormControl>
                </Grid>
            </Grid>
            <Grid container spacing={2} size={12}> 
                <Button className="Button" onClick={handleCompare} aria-label="Compare">Compare</Button>
                {Object.keys(searchFields).map((key) => (
                    <Box key={key} sx={{ display: 'inline-flex', gap: 1 }}>
                        <Typography variant="subtitle1" id={searchFields[key] + '-label'}>{key}: </Typography>
                        <Typography variant="subtitle1" id={searchFields[key] + '-value'}>{appData0[searchFields[key]]}</Typography>
                    </Box>
                ))}
            </Grid>
            <Grid container spacing={2} size={12} sx={{ width: '100%', height: '50rem' }}>
                <Box sx={{ width: '100%', typography: 'body1' }}>
                <TabContext value={tabValue}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <TabList onChange={handleTabChange} aria-label="comparison results">
                        {rowData1?.length > 0 && <Tab label="Application" value="1" />}
                        {showWebMap && <Tab label="Web Maps" value="2" />}
                        {showServices && <Tab label="Services" value="3" />}
                    </TabList>
                    </Box>
                    <TabPanel value="1">         
                        {rowData1?.length > 0 &&
                            <Grid container spacing={2} size={12}>
                                <Button className="Button" id="export-app-diff" variant="contained" color="primary" onClick={onBtnExport1} aria-label="Download CSV">Download App Comparison as CSV</Button>
                                <Box sx={{ width: '100%', height: '50rem', flexGrow: 1 }}>
                                    <AgGridReact 
                                        theme={myTheme}
                                        ref={gridRef1}
                                        defaultColDef={defaultColDef} 
                                        rowData={rowData1} 
                                        style={{ width: '100%', height: '100%' }}
                                        columnDefs={gridOptions1.columnDefs} 
                                        alwaysShowVerticalScroll={true}
                                        alwaysShowHorizontalScroll={true}
                                        domLayout={"autoHeight"}
                                        rowHeight={75}
                                        pagination={true}
                                        enableCellTextSelection = {true}
                                        gridOptions={options} 
                                        paginationPageSize={100}
                                    />
                                </Box>
                            </Grid>
                        }   
                    </TabPanel>
                    {showWebMap && 
                    <TabPanel value="2">
                        <Grid container spacing={2} size={12}>
                            <Grid size={6}>
                                <FormControl fullWidth size="small">
                                    <Autocomplete id="web-map-ids"
                                        value = {selectedMapId}
                                        disablePortal
                                        options={Object.keys(webMapDisplayOptions)}
                                        renderInput={(params) => <TextField {...params} label={"Select Map"} />}
                                        onChange={(event, value) => handleSelectMapId(value)}
                                        key={searchField}
                                    />
                                </FormControl>
                            </Grid>
                            {rowData2?.length > 0 &&
                                <>                                
                                    <Button className="Button" id="export-map-diff" variant="contained" color="primary" onClick={onBtnExport2} aria-label="Download CSV">Download Web Map Comparison as CSV</Button>
                                    <Grid size={12}>
                                        <Box sx={{ width: '100%', height: '50rem', flexGrow: 1 }}>
                                            <AgGridReact 
                                                theme={myTheme}
                                                ref={gridRef2}
                                                defaultColDef={defaultColDef} 
                                                rowData={rowData2} 
                                                style={{ width: '100%', height: '100%' }}
                                                columnDefs={gridOptions2.columnDefs} 
                                                alwaysShowVerticalScroll={true}
                                                alwaysShowHorizontalScroll={true}
                                                domLayout={"autoHeight"}
                                                rowHeight={75}
                                                pagination={true}
                                                enableCellTextSelection = {true}
                                                gridOptions={options} 
                                                paginationPageSize={100}
                                            />
                                        </Box>
                                    </Grid>
                                </>
                            }
                            
                        </Grid>
                    </TabPanel>
                    }
                    {showServices &&
                    <TabPanel value="3">
                        <Grid container spacing={2} size={12}>            
                            <Grid container spacing={2} size={12}> 
                                <Grid size={4}>
                                    <FormControl fullWidth size="small">
                                        <Autocomplete id="web-map-ids-services"
                                            value = {selectedMapIdForServices}
                                            disablePortal
                                            options={Object.keys(webMapDisplayOptions)}
                                            renderInput={(params) => <TextField {...params} label={"Select Map"} />}
                                            onChange={(event, value) => handleSelectMapIdForServices(value)}
                                            key={searchField}
                                        />
                                    </FormControl>
                                </Grid>
                                <Grid size={4}>
                                    <FormControl fullWidth size="small">
                                        <Autocomplete id="service-ids"
                                            value = {selectedServiceId}
                                            disablePortal
                                            options={serviceOptions}
                                            renderInput={(params) => <TextField {...params} label={"Select Service"} />}
                                            onChange={(event, value) => handleSelectServiceId(value)}
                                            key={searchField}
                                        />
                                    </FormControl>
                                </Grid>
                            </Grid>
                            {rowData3?.length > 0 &&
                                <>
                                    <Button className="Button" id="export-services-diff" variant="contained" color="primary" onClick={onBtnExport3} aria-label="Download CSV">Download Service Comparison as CSV</Button>
                                    <Box sx={{ width: '100%', height: '50rem', flexGrow: 1 }}>
                                        <AgGridReact 
                                            theme={myTheme}
                                            ref={gridRef3}
                                            defaultColDef={defaultColDef} 
                                            rowData={rowData3} 
                                            style={{ width: '100%', height: '100%' }}
                                            columnDefs={gridOptions3.columnDefs} 
                                            alwaysShowVerticalScroll={true}
                                            alwaysShowHorizontalScroll={true}
                                            domLayout={"autoHeight"}
                                            rowHeight={75}
                                            pagination={true}
                                            enableCellTextSelection = {true}
                                            gridOptions={options} 
                                            paginationPageSize={100}
                                        />
                                    </Box>
                                </>
                            }
                            
                        </Grid>
                    </TabPanel>
                    }
                </TabContext>
                </Box>
                    
            </Grid>
        </Grid>

    )
}

export default CompareForm