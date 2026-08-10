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

import {useState, useCallback} from 'react';
import { Button, FormControl, MenuItem, Select, Typography,  TextField, Autocomplete, Radio, RadioGroup, FormControlLabel, FormLabel, Box } from '@mui/material' 
import Grid from '@mui/material/Grid2';
import { portalList, searchFields, searchTypes } from '../config';
import '../App.css'
import { fetchAllAppIds, fetchItemData, fetchItemById, promoteContent, cloneContent } from '../PortalUtils';
import PalmModal from './PalmModal';
import Loading from './Loading';

// Environment indices constants
const SOURCE_ENV = 0;
const TARGET_ENV = 1;

const PromoteContent = () => {

    const [selectedIdFrom, setSelectedIdFrom] = useState('')
    const [selectedIdTo, setSelectedIdTo] = useState('')
    const [portalKeyFrom, setPortalKeyFrom] = useState('')
    const [portalKeyTo, setPortalKeyTo] = useState('')
    const [searchField, setSearchField] = useState(Object.keys(searchFields)[0])
    const [appListDataFromOptions, setAppListDataFromOptions] = useState([])
    const [appListDataToOptions, setAppListDataToOptions] = useState([])
    const [appDataFrom, setAppDataFrom] = useState({})
    const [showConfirmPromotion, setShowConfirmPromotion] = useState(false)
    const [showErrorDialog, setShowErrorDialog] = useState(false)
    const [showPromotionSuccess, setShowPromotionSuccess] = useState(false)
    const [showPromotionFailed, setShowPromotionFailed] = useState(false)
    const [promotionSuccessMsg, setPromotionSuccessMsg] = useState('')
    const [promotionError, setPromotionError] = useState(null)
    const [showConfirmClone, setShowConfirmClone] = useState(false)
    const [isCloning, setIsCloning] = useState(false)
    const [isPromoting, setIsPromoting] = useState(false)
    const [searchType, setSearchType] = useState(Object.keys(searchTypes)[0])
    const [errorDialogMessage, setErrorDialogMessage] = useState('')

    // Helper function to match items between environments
    const matchItemBetweenEnvironments = useCallback((selectedValue, appListDataFromOptions, appListDataToOptions) => {
        const field = searchFields[searchField]
        const itemFrom = appListDataFromOptions.find((item) => item[field] === selectedValue)
        
        if (!itemFrom) {
            return { itemFrom: null, itemTo: null }
        }
        
        let itemTo = null
        if (itemFrom.type === 'Site Application' || itemFrom.type === 'StoryMap') {
            // For Site Applications and Story Maps, match by title
            itemTo = appListDataToOptions.find((item) => item.title === itemFrom.title)
        } else {
            // For other types, match by field value and verify ID matches
            const candidate = appListDataToOptions.find((item) => item[field] === selectedValue)
            if (candidate && candidate.id === itemFrom.id) {
                itemTo = candidate
            }
        }
        
        return { itemFrom, itemTo }
    }, [searchField])

    const setAppIds = useCallback((portalIndex, data) => {
        switch(portalIndex){
            case SOURCE_ENV:
                setAppListDataFromOptions(data)
                break
            case TARGET_ENV:
                setAppListDataToOptions(data)
                break
            default:
                break
        }
    }, [])

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

    const handlePromoteError = (error) => {
        setPromotionError(error)
        setShowConfirmPromotion(false)
        setShowConfirmClone(false)
        setShowPromotionFailed(true)
        setIsPromoting(false)
    }

    // Clone content from source environment to target environment, where the application does not exist in the target environment
    const handleClone = async () => {
        const idFirstEnv = selectedIdFrom
        const field = searchFields[searchField]
        const dataFrom = appListDataFromOptions.find((item) => item[field] === idFirstEnv)
        
        if (!dataFrom) {
            handlePromoteError('Source application not found')
            return
        }
        
        const itemId = dataFrom['id']

        // clone the application
        setIsCloning(true)
        setShowConfirmClone(false)
        let response = await cloneContent(TARGET_ENV, SOURCE_ENV, portalKeyFrom, itemId, dataFrom['title'])

        setIsCloning(false)
        if (response === undefined || response === null) {
            handlePromoteError(null)
            return
        }
        else if (response.success === false) {
            let errMsg = response?.error || 'Unknown error'
            handlePromoteError(errMsg)
            return
        }

        // read response body for success message
        let respJSON = JSON.parse(response.result)
        let promotionMsg = respJSON?.result || ''
        setPromotionSuccessMsg(promotionMsg)

        setSelectedIdTo('')
        if (appListDataToOptions.length !== 0) {
            const { itemTo } = matchItemBetweenEnvironments(idFirstEnv, appListDataFromOptions, appListDataToOptions)
            if (itemTo) {
                setSelectedIdTo(itemTo[field])
            }
            setAppDataFrom(dataFrom)
        }   

        setShowConfirmClone(false)
        setShowPromotionSuccess(true)
    }
        
            
    const handlePromote = async (dataFrom, dataTo) => {    

        // get app data for publish from environment
        let pubDataSource = await fetchItemData(SOURCE_ENV, portalKeyFrom, dataFrom['id'])

        // promote the application
        setShowConfirmPromotion(false)
        setIsPromoting(true)

        let response = await promoteContent(TARGET_ENV, SOURCE_ENV, portalKeyFrom, dataFrom['id'], dataTo['id'], dataFrom['title'])
        if (response === undefined || response === null) {
            handlePromoteError(null)
            return
        }
        else if (response.success === false) {
            let errMsg = response?.error || 'Unknown error'
            handlePromoteError(errMsg)
            return
        }

        let respJSON = JSON.parse(response.result)
        let promotionMsg = respJSON?.result || ''
        setPromotionSuccessMsg(promotionMsg)

        // promote web maps
        // get web map info
        const webMaps = getWebMapIds('root', pubDataSource)

        for (const nodeName in webMaps) {
            const webMap = webMaps[nodeName]
            const actualMapId = webMap?.itemId
            
            if (!actualMapId) {
                // Skip if no itemId found
                continue
            }
            
            let mapItem = await fetchItemById(TARGET_ENV, portalKeyTo, actualMapId)
            if (mapItem === undefined || mapItem === null) {
                handlePromoteError('Could not find web map item with id: ' + actualMapId + ' in target environment')
                return
            }

            response = await promoteContent(TARGET_ENV, SOURCE_ENV, portalKeyFrom, actualMapId, actualMapId, mapItem['title'])
            if (response === undefined || response === null) {
                handlePromoteError(null)
                return
            }
            else if (response.success === false) {
                let errMsg = response?.error || 'Unknown error'
                handlePromoteError(errMsg)
                return
            }
        }
        
        setIsPromoting(false)
        setShowConfirmPromotion(false)
        setShowPromotionSuccess(true)
    }

    const handlePromoteClick = async (appListDataFromOptions, appListDataToOptions) => {
        const field = searchFields[searchField]
        const idFirstEnv = selectedIdFrom
        const idSecondEnv = selectedIdTo
        const dataFrom = appListDataFromOptions.find((item) => item[field] === idFirstEnv)
        const dataTo = appListDataToOptions.find((item) => item[field] === idSecondEnv)
        
        if (!dataFrom) {
            setErrorDialogMessage('Source application not found')
            setShowErrorDialog(true)
            return
        }
        
        if (dataTo === undefined) {
            setErrorDialogMessage('No application with ' + field + ' = "' + idSecondEnv + '" found in ' + portalKeyTo)
            setShowErrorDialog(true)
            return
        }
        await handlePromote(dataFrom, dataTo);
    }

    const handleChange = (value, index) => {
        if (value !== '') {
            switch(index){
                case SOURCE_ENV:
                    setSelectedIdFrom(value)
                    setSelectedIdTo('')
                    if (appListDataToOptions.length !== 0) {
                        const { itemFrom, itemTo } = matchItemBetweenEnvironments(value, appListDataFromOptions, appListDataToOptions)
                        if (itemTo) {
                            const field = searchFields[searchField]
                            setSelectedIdTo(itemTo[field])
                        }
                        setAppDataFrom(itemFrom || {})
                    }   
                    break
                case TARGET_ENV:
                    setSelectedIdTo(value)
                    break
                default:
                    break
            }
        }
    }

    const handleSetSearchField = (value) => {   
        setSearchField(value)
        setSelectedIdFrom('')
        setSelectedIdTo('')
    }

    const getSelectOptions = (index) => {
        let options = []
        let data = []
        switch(index){
            case SOURCE_ENV:
                data = appListDataFromOptions
                break
            case TARGET_ENV:
                data = appListDataToOptions
                break
            default:
                break
        }
        Object.keys(data).forEach((key) => {
            options.push(data[key][searchFields[searchField]])
        })
        return options
    }

    const handleSetPortal = async (event, index) => {
        const key = event.target.value
        const type = searchType
        switch(index){
            case SOURCE_ENV:
                setPortalKeyFrom(key)
                setSelectedIdFrom('')
                break
            case TARGET_ENV:
                setPortalKeyTo(key)
                setSelectedIdTo('')
                break
            default:
                break
        }
        await fetchAllAppIds(index, key, type, setAppIds)
       
    }

    const handleSetSearchType = async (value) => {

        setSearchType(value)
        if (portalKeyFrom) {
            fetchAllAppIds(SOURCE_ENV, portalKeyFrom, value, setAppIds);
        }
        if (portalKeyTo) {
            fetchAllAppIds(TARGET_ENV, portalKeyTo, value, setAppIds);
        }
        setSelectedIdFrom('')
        setSelectedIdTo('')
    }

    const confirmPromote = () => {
       
        const idFirstEnv = selectedIdFrom
        const idSecondEnv = selectedIdTo

        // ensure that both environments have the same application Id
        if (idFirstEnv === '' || (idSecondEnv !== '' && idFirstEnv !== idSecondEnv))
        {
            setErrorDialogMessage('Error: Cannot promote application. Please ensure that the application exists in the source environment, and that the target application id matches or is empty.')
            setShowErrorDialog(true)
        } 
        else if (idSecondEnv === '') 
        {
            setShowConfirmClone(true)

        }
        else {
             setShowConfirmPromotion(true)
        }
    }

    return (
        <Grid container spacing={2} sx={{ width: '100%', padding:'2rem' }}>
            {isCloning || isPromoting && <div className="loading-overlay"></div>}
            <Grid container spacing={2} size={12}>
                <Typography variant="h6">
                    Promote Content
                </Typography>
            </Grid>
            <Grid container spacing={2} size={8}>
                <Typography variant="body2">Select a Source Environment and application to promote. An application can be promoted if it does not already exist in the Target Environment, or if the application id is identical in both environments. Applications of type "Site Application" or "Story Map" can be promoted if titles match, regardless of item id. Configuration values in the application will be updated to match the Target Environment during the promotion process.
                </Typography>
            </Grid>
            <Grid size={2}></Grid>
            <Grid size={2}></Grid>
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
                    <Typography variant="subtitle1" id='first-env-label'>Promote From:</Typography>
                    <FormControl fullWidth size="small">
                        <Select
                            SelectDisplayProps={{ 'aria-labelledby': 'first-env-label' }}
                            id="first-env-select"            
                            value={portalKeyFrom}
                            onChange={(event) => handleSetPortal(event, SOURCE_ENV)}
                        >
                            {Object.keys(portalList).map((key) => (
                                <MenuItem key={key} value={key} aria-label={key}>{key}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={4}>
                    <Typography variant="subtitle1" id='second-env-label'>Promote To:</Typography>
                    <FormControl fullWidth size="small">
                        <Select
                            SelectDisplayProps={{ 'aria-labelledby': 'second-env-label' }}
                            id="second-env-select"
                            value={portalKeyTo}
                            onChange={(event) => handleSetPortal(event, TARGET_ENV)}
                        >
                            {Object.keys(portalList).map((key) => (
                               portalList[key].canPublish ? 
                                    <MenuItem key={key} value={key} aria-label={key}>{key}</MenuItem>
                                : null
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>
            <Grid container spacing={2} size={12}>  
                <Grid size={4}>
                    <FormControl fullWidth size="small">
                        <Autocomplete id="first-env-app-ids"
                            value = {selectedIdFrom}
                            disablePortal
                            options={getSelectOptions(SOURCE_ENV)}
                            renderInput={(params) => <TextField {...params} label={"Select " + searchField} />}
                            onChange={(event, value) => handleChange(value, SOURCE_ENV)}
                            key={searchField}
                        />
                    </FormControl>
                </Grid>
                <Grid size={4}>
                    <FormControl fullWidth size="small">
                        <TextField id="second-env-app-ids"
                            value = {selectedIdTo}
                            disablePortal
                            options={getSelectOptions(TARGET_ENV)}
                            renderInput={(params) => <TextField {...params} />}
                            slotProps={{
                                input: {
                                readOnly: true,
                                },
                            }}
                            key={searchField}
                        />
                    </FormControl>
                </Grid>
            </Grid>
             <Grid container spacing={2} size={12}> 
                <Button className="Button" onClick={() => confirmPromote()} color="primary" aria-label="Promote">Promote</Button>
            </Grid>
            <Grid container spacing={2} size={12}> 
                
                {Object.keys(searchFields).map((fieldKey) => (
                    <Box key={fieldKey} sx={{ display: 'flex', gap: 1, mr: 2 }}>
                        <Typography variant="subtitle1" id={searchFields[fieldKey] + '-label'}>{fieldKey}: </Typography>
                        <Typography variant="subtitle1" id={searchFields[fieldKey] + '-value'}>{appDataFrom[searchFields[fieldKey]]}</Typography>
                    </Box>
                ))}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Typography variant="subtitle1" id={'type-label'}>Type: </Typography>
                    <Typography variant="subtitle1" id={'type-value'}>{appDataFrom['type']}</Typography>
                </Box>
            </Grid>
            {isCloning || isPromoting ? (
                <div className="loading-overlay">
                    <Loading message={isCloning ? "Cloning..." : "Promoting..."} />
                </div>
            ) : (
                null
            )}

            {showConfirmPromotion && (
            <PalmModal
                open={showConfirmPromotion}
                title="Promote Application"
                text="Promote Application? This operation will overwrite the existing application in the target environment, and cannot be undone."
                button1Text="Cancel"
                button1Action={() => setShowConfirmPromotion(false)}
                button2Text="Promote"
                button2Action={() => handlePromoteClick(appListDataFromOptions, appListDataToOptions)}
                onClose={() => setShowConfirmPromotion(false)}
            />
            )}
            {showErrorDialog && (
            <PalmModal
                open={showErrorDialog}
                title="Error: Cannot Promote"
                text={errorDialogMessage || "Error: Cannot promote application. Please ensure that the application exists in the source environment, and that the target application id matches or is empty."}
                button1Text="OK"
                button1Action={() => setShowErrorDialog(false)}
                onClose={() => setShowErrorDialog(false)}
            />
            )}
            {showPromotionSuccess && (
            <PalmModal
                open={showPromotionSuccess}
                title="Promotion Success"
                text={promotionSuccessMsg || "Promotion Success! The application has been successfully promoted to the target environment."}
                button1Text="OK"
                button1Action={() => setShowPromotionSuccess(false)}
                onClose={() => setShowPromotionSuccess(false)}
            />
            )}
            {showPromotionFailed && (
            <PalmModal
                open={showPromotionFailed}
                title="Error: Promotion Failed"
                text={`Error: ${promotionError ?? 'Promotion failed. Please try again.'}`}
                button1Text="OK"
                button1Action={() => setShowPromotionFailed(false)}
                onClose={() => setShowPromotionFailed(false)}
            />
            )}
            {showConfirmClone && (
            <PalmModal
                open={showConfirmClone}
                title="Clone Application"
                text="This application does not exist in the target environment. This operation will create a copy of the existing application in the target environment."
                button1Text="Cancel"
                button1Action={() => setShowConfirmClone(false)}
                button2Text="Clone"
                button2Action={handleClone}
                onClose={() => setShowConfirmClone(false)}
            />
            )}
        </Grid>
    )
}

export default PromoteContent