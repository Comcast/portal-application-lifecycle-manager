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

import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { SearchQueryBuilder, searchItems, getItemData, getItem} from "@esri/arcgis-rest-portal";
import { getService } from '@esri/arcgis-rest-feature-service';
import { portalList, config } from './config';

// The redirect URL registered in your OAuth credentials
const redirectUri = (globalThis.location?.href || '') + 'postauth';

/**
 * Unified helper to make authenticated API calls to PALM backend
 * Sends user's ArcGIS OAuth token for authentication
 * Backend will validate token and log user actions, but use service account for operations
 * 
 * @param {string} url - API endpoint URL
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {Object|null} data - Request body data (optional)
 * @param {number|null} portalIndex - Portal index for specific portal auth (optional)
 * @param {string|null} portalKey - Portal key for specific portal auth (optional)
 * @returns {Promise<Response>} Fetch response
 */
export async function callBackendAPI(url, method = 'GET', data = null, portalIndex = null, portalKey = null) {
    let auth;
    let portalUrl;
    
    // If portal context is provided, use specific portal's session
    if (portalIndex !== null && portalKey !== null) {
        // Ensure user is authenticated (triggers OAuth if needed)
        await handleSignIn(portalIndex, portalKey);
        
        auth = getSessionFromSessionStorage(portalKey);
        portalUrl = sessionStorage.getItem('portalUrl' + portalIndex);
        
        if (!auth?.token) {
            throw new Error('Not authenticated with ArcGIS. Please sign in.');
        }
        
        // Check if token is expired
        if (isTokenExpired(auth)) {
            sessionStorage.removeItem("__ARCGIS_REST_USER_SESSION__" + portalKey);
            throw new Error('Your session has expired. Please sign in again.');
        }
        
        // Auto-refresh if token is near expiration (within 5 minutes)
        if (isTokenNearExpiration(auth)) {
            try {
                await refreshToken(portalKey);
                auth = getSessionFromSessionStorage(portalKey);
            } catch (error) {
                // If refresh fails, continue with existing token
                if (import.meta.env.DEV) console.error('Token refresh failed:', error);
            }
        }
    } else {
        // Otherwise, use any available authenticated session
        let anyAuth = getAnyAuthToken();
        
        if (!anyAuth) {
            // No existing session - trigger sign-in with first available portal
            const firstPortalKey = Object.keys(portalList)[0];
            if (firstPortalKey) {
                await handleSignIn(0, firstPortalKey);
                anyAuth = getAnyAuthToken();
            }
            
            if (!anyAuth) {
                throw new Error('Please sign in to a portal first');
            }
        }
        
        auth = { token: anyAuth.token };
        portalUrl = anyAuth.portalUrl;
    }
    
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.token}`,
            'X-ArcGIS-Portal': portalUrl
        }
    };
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    // Handle authentication failures
    if (response.status === 401) {
        if (portalKey) {
            sessionStorage.removeItem("__ARCGIS_REST_USER_SESSION__" + portalKey);
        }
        throw new Error('Authentication required. Please sign in again.');
    }
    
    if (response.status === 403) {
        throw new Error('Access denied. Your ArcGIS session may have expired.');
    }
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed with status ${response.status}`);
    }
    
    return response;
}

/**
 * ============================================================================
 * TOKEN MANAGEMENT & AUTOMATIC REFRESH
 * ============================================================================
 * 
 * Security Features:
 * - Tokens stored in sessionStorage (cleared on tab close)
 * - Token expiration set to 8 hours (reduced from 14 days)
 * - Automatic refresh when token is within 5 minutes of expiration
 * - Silent refresh to maintain user session without interruption
 * 
 * Token Lifecycle:
 * 1. Initial authentication via OAuth 2.0 popup
 * 2. Token stored in sessionStorage with 8-hour expiration
 * 3. Before each API call, check if token expires within 5 minutes
 * 4. If near expiration, use refreshCredentials() to silently refresh token
 * 5. If refresh fails, existing token is used until expiry
 * 6. On expiry, user is prompted to re-authenticate
 */

    // Handle signed in and signed out app states
    const updateAppState = (sessionInfo, portalKey) => {
        if (sessionInfo) {
            // Set user session in browser storage
            sessionStorage.setItem("__ARCGIS_REST_USER_SESSION__" + portalKey, JSON.stringify(sessionInfo));
        }
        else {
            // Clear user session
            sessionStorage.removeItem("__ARCGIS_REST_USER_SESSION__" + portalKey);
        }
    }

    const getSessionFromSessionStorage = (portalKey) => {
        const serializedSession = sessionStorage.getItem("__ARCGIS_REST_USER_SESSION__" + portalKey);
        if (serializedSession !== null && serializedSession !== "undefined") {
            const sess = JSON.parse(serializedSession);
            
            // Check if token is expired or invalid
            if (isTokenExpired(sess) || !sess.token) {
                sessionStorage.removeItem("__ARCGIS_REST_USER_SESSION__" + portalKey);
                return null;
            }
            return ArcGISIdentityManager.deserialize(serializedSession);
        }
        return null;
    }

/**
 * Check if token is expired
 * @param {Object} session - Session object with tokenExpires property
 * @returns {boolean} True if token is expired
 */
const isTokenExpired = (session) => {
    if (!session || !session.tokenExpires) return true;
    
    const now = new Date();
    const expireTime = new Date(session.tokenExpires);
    
    return now.getTime() > expireTime.getTime();
};

/**
 * Check if token is near expiration (within 5 minutes)
 * @param {Object} session - Session object with tokenExpires property
 * @returns {boolean} True if token expires within 5 minutes
 */
const isTokenNearExpiration = (session) => {
    if (!session || !session.tokenExpires) return true;
    
    const now = new Date();
    const expireTime = new Date(session.tokenExpires);
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    return (expireTime.getTime() - now.getTime()) < fiveMinutes;
};

/**
 * Refresh the authentication token using the session's built-in refresh method
 * @param {string} portalKey - Portal key
 * @returns {Promise<ArcGISIdentityManager>} Refreshed session
 */
const refreshToken = async (portalKey) => {
    const existingSession = getSessionFromSessionStorage(portalKey);
    
    if (!existingSession) {
        throw new Error('No session to refresh');
    }
    
    // Use the session's built-in refresh method
    const refreshedSession = await existingSession.refreshCredentials();
    
    updateAppState(refreshedSession, portalKey);
    return refreshedSession;
};

const handleSignIn = async (portalIndex, portalKey) => {
    // Check the browser's session storage for existing sessions
    const existingSession = getSessionFromSessionStorage(portalKey);
    const clientId = portalList[portalKey]['clientid'];
    const portalUrl = portalList[portalKey]['url'];
    const redirectUriForAuth = redirectUri + '?portalId=' + portalIndex;

    sessionStorage.setItem('portalUrl'+portalIndex, portalUrl);
    sessionStorage.setItem('clientId'+portalIndex, clientId);
    sessionStorage.setItem('redirectUri'+portalIndex, redirectUriForAuth);

    // If session exists but token is near expiration, refresh it
    if (existingSession !== null && isTokenNearExpiration(existingSession)) {
        try {
            await refreshToken(portalKey);
            return;
        } catch (error) {
            // If refresh fails, clear session and fall through to new auth
            sessionStorage.removeItem("__ARCGIS_REST_USER_SESSION__" + portalKey);
        }
    }

    if (existingSession === null && clientId !== '') {
        // Use ArcGIS REST JS to handle OAuth 2.0 authentication
        await ArcGISIdentityManager.beginOAuth2({
            portal: portalUrl,
            clientId: clientId,
            redirectUri: redirectUriForAuth,
            popup: true, 
            480 // expiration in minutes (8 hours)
        })
        .then((newSession) => {
            updateAppState(newSession, portalKey);
        });
    }
}

/**
 * Get any available authenticated token from sessionStorage
 * Used for operations that don't require a specific portal (like getConfig)
 * @returns {Object|null} Object with {token, portalUrl} or null if no auth found
 */
export const getAnyAuthToken = () => {
    // Try to find any authenticated session in sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('__ARCGIS_REST_USER_SESSION__')) {
            const serializedSession = sessionStorage.getItem(key);
            if (serializedSession && serializedSession !== 'undefined') {
                try {
                    const sess = JSON.parse(serializedSession);
                    
                    // Check if token is valid and not near expiration
                    if (isTokenExpired(sess)) {
                        // Clean up expired session
                        sessionStorage.removeItem(key);
                    } else if (!isTokenNearExpiration(sess) && sess.token) {
                        // Found a valid token that's not near expiration
                        return {
                            token: sess.token,
                            portalUrl: sess.portal
                        };
                    }
                } catch (e) {
                    // Skip invalid session data
                    continue;
                }
            }
        }
    }
    return null;
}

export const fetchAllAppIds = async (portalIndex, portalKey, type, callBack) => {
    // Input validation
    if (portalIndex === undefined || portalIndex === null) {
        if (import.meta.env.DEV) console.error('fetchAllAppIds: portalIndex is required');
        return { error: 'Portal index is required', success: false };
    }
    if (!portalKey) {
        if (import.meta.env.DEV) console.error('fetchAllAppIds: portalKey is required');
        return { error: 'Portal key is required', success: false };
    }
    if (!type) {
        if (import.meta.env.DEV) console.error('fetchAllAppIds: type is required');
        return { error: 'Search type is required', success: false };
    }

    try{      
        await handleSignIn(portalIndex, portalKey)

        const sortField = 'modified'
        const sortOrder = 'desc'
        const auth = getSessionFromSessionStorage(portalKey);
        const portalUrl = sessionStorage.getItem('portalUrl' + portalIndex)
        let data = []
        let nextStart = 0

        // Build query based on type
        const queryApp = new SearchQueryBuilder()
            .match("0123456789ABCDEF")
            .in("orgid")
            .not()
            .match("esri_apps")
            .in("owner")
            .not()
            .match("esri_nav")
            .in("owner")
            .not()
            .match("esri_webstyles")
            .in("owner")
            .and()
            .startGroup()
            .match("Application")
            .in("type")
            .or()
            .match("Web Experience")
            .in("type")
            .or()
            .match("Web Experience Template")
            .in("type")
            .or()
            .match("Code Sample")
            .in("type")
            .or()
            .match("Web Mapping Application")
            .in("type")
            .or()
            .match("Mobile Application")
            .in("type")
            .or()
            .match("Desktop Application Template")
            .in("type")
            .or()
            .match("Desktop Application")
            .in("type")
            .or()
            .match("Operation View")
            .in("type")
            .or()
            .match("Dashboard")
            .in("type")
            .or()
            .match("Operations Dashboard Extension")
            .in("type")
            .or()
            .match("Workforce Project")
            .in("type")
            .or()
            .match("Insights Workbook")
            .in("type")
            .or()
            .match("Insights Page")
            .in("type")
            .or()
            .match("Insights Model")
            .in("type")
            .or()
            .match("Hub Page")
            .in("type")
            .or()
            .match("Hub Initiative")
            .in("type")
            .or()
            .match("Hub Site Application")
            .in("type")
            .or()
            .match("StoryMap")
            .in("type")
            .or()
            .match("Form")
            .in("type")
            .endGroup();

        const queryMap = new SearchQueryBuilder()
            .match("0123456789ABCDEF")
            .in("orgid")
            .not()
            .match("esri_apps")
            .in("owner")
            .not()
            .match("esri_nav")
            .in("owner")
            .not()
            .match("esri_webstyles")
            .in("owner")
            .and()
            .startGroup()
            .match("Web Map")
            .in("type")
            .endGroup();

        let query = type === 'apps' ? queryApp : queryMap

        while(nextStart !== -1){
            const response = await searchItems({q: query, num: 100, sortField: sortField, sortOrder: sortOrder,  enriched: true,
                portal: portalUrl, start: nextStart, authentication: auth}
            )  
            nextStart = response.nextStart
            data.push(...response.results)
        }

        if (callBack) {
            callBack(portalIndex, data)
        }
        return data
        
    }
    catch(error){
        if (import.meta.env.DEV) {
            console.error('Error fetching application IDs:', error);
        }
        return { error: 'Failed to fetch applications. Please try again.', success: false };
    }
}

export const fetchItemById = async (portalIndex, portalKey, id) => {
    // Input validation
    if (!id) {
        if (import.meta.env.DEV) console.error('fetchItemById: id is required');
        return { error: 'Item ID is required', success: false };
    }
    if (portalIndex === undefined || portalIndex === null) {
        if (import.meta.env.DEV) console.error('fetchItemById: portalIndex is required');
        return { error: 'Portal index is required', success: false };
    }
    if (!portalKey) {
        if (import.meta.env.DEV) console.error('fetchItemById: portalKey is required');
        return { error: 'Portal key is required', success: false };
    }

    try {
        await handleSignIn(portalIndex, portalKey)
        const auth = getSessionFromSessionStorage(portalKey);
        const portalUrl = sessionStorage.getItem('portalUrl' + portalIndex)
        const response = await getItem(id, {portal: portalUrl, authentication: auth})
        return response
    }
    catch(error){
        if (import.meta.env.DEV) {
            console.error('Error fetching item by ID:', error);
        }
        return { error: 'Failed to fetch item. Please check the item ID and try again.', success: false };
    }
}

export const fetchItemData = async (portalIndex, portalKey, id) => {
    // Input validation
    if (!id) {
        if (import.meta.env.DEV) console.error('fetchItemData: id is required');
        return { error: 'Item ID is required', success: false };
    }
    if (portalIndex === undefined || portalIndex === null) {
        if (import.meta.env.DEV) console.error('fetchItemData: portalIndex is required');
        return { error: 'Portal index is required', success: false };
    }
    if (!portalKey) {
        if (import.meta.env.DEV) console.error('fetchItemData: portalKey is required');
        return { error: 'Portal key is required', success: false };
    }

    try {
        await handleSignIn(portalIndex, portalKey)
        const auth = getSessionFromSessionStorage(portalKey);
        const portalUrl = sessionStorage.getItem('portalUrl' + portalIndex)
        const response = await getItemData(id, {portal: portalUrl, authentication: auth})
        return response
    }
    catch(error){
        if (import.meta.env.DEV) {
            console.error('Error fetching item data:', error);
        }
        return { error: 'Failed to fetch item data. Please try again.', success: false };
    }    
}

export const fetchServiceData = async (portalIndex, portalKey, url) => {
    // Input validation
    if (!url) {
        if (import.meta.env.DEV) console.error('fetchServiceData: url is required');
        return { error: 'Service URL is required', success: false };
    }
    if (portalIndex === undefined || portalIndex === null) {
        if (import.meta.env.DEV) console.error('fetchServiceData: portalIndex is required');
        return { error: 'Portal index is required', success: false };
    }
    if (!portalKey) {
        if (import.meta.env.DEV) console.error('fetchServiceData: portalKey is required');
        return { error: 'Portal key is required', success: false };
    }

    try {
        await handleSignIn(portalIndex, portalKey)
        const auth = getSessionFromSessionStorage(portalKey);
        const portalUrl = sessionStorage.getItem('portalUrl' + portalIndex)
        const response = await getService({'url': url, portal: portalUrl, authentication: auth})
        return response
    }
    catch(error){
        if (import.meta.env.DEV) {
            console.error('Error fetching service data:', error);
        }
        return { error: 'Failed to fetch service data. Please verify the service URL.', success: false };
    }    
}

export const cloneContent = async (targetPortalIndex, sourcePortalIndex, sourcePortalKey, itemId, title) => {
    const rawSourcePortalUrl = sessionStorage.getItem('portalUrl' + sourcePortalIndex);
    const rawTargetPortalUrl = sessionStorage.getItem('portalUrl' + targetPortalIndex);

    if (!rawSourcePortalUrl || !rawTargetPortalUrl) {
        if (import.meta.env.DEV) {
            console.error('Missing portalUrl in sessionStorage for source or target portal index.', {
                sourcePortalIndex,
                targetPortalIndex
            });
        }
        return { error: 'Missing portal URL configuration for source or target environment.', success: false };
    }

    const sourcePortalUrl = rawSourcePortalUrl.replace('/sharing/rest', '');
    const targetPortalUrl = rawTargetPortalUrl.replace('/sharing/rest', '');
    const auth = getSessionFromSessionStorage(sourcePortalKey);
    const username = auth?.username ?? null;
    let logurl = config["LogPromotionAction"]
    let url = config["CloneContent"]
    let promoteData = {
            sourceEnv: sourcePortalUrl,
            targetEnv: targetPortalUrl,
            itemId: itemId
        }
    try {
        // Use authenticated backend API call
        const response = await callBackendAPI(
            url,
            'POST',
            promoteData,
            sourcePortalIndex,
            sourcePortalKey
        );

        let promoteResp = {};
        let responseBody = await response.text();
        if (response.status === 200) {        
            promoteResp = { result: responseBody, success: true };
        }
        else {
            const respJSON = JSON.parse(responseBody)
            promoteResp = { error: response.statusText + ": " + respJSON?.error, success: false };
        }


        // Log promotion action (fire-and-forget with authentication)
        callBackendAPI(
            logurl,
            'POST',
            {
                ...promoteData,
                username: username,
                id: itemId,
                title: title,
                success: promoteResp.success,
                error: promoteResp.success ? null : promoteResp.error
            },
            sourcePortalIndex,
            sourcePortalKey
        )
        .catch((logError) => {
            if (import.meta.env.DEV) console.error('Error logging promotion action:', logError);
        });

        return promoteResp;

    }
    catch(error){
        if (import.meta.env.DEV) {
            console.error('Error cloning content:', error);
        }
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return {error: 'Request timed out. \nCheck back later to see if the item was cloned to the target environment.  \nIf necesssary, run Promote to ensure the cloned item in the target environment is configured correctly.', success: false }
        }
        return {error: 'An unexpected error occurred during cloning. Please try again.', success: false}
    }
    
};

// Helper function to perform deep replacement on data structures
function deepReplace(data, replacements) {
    if (typeof data === 'string') {
        return replacements.reduce((str, { from, to }) => str.replaceAll(from, to), data);
    }
    if (Array.isArray(data)) {
        return data.map(item => deepReplace(item, replacements));
    }
    if (data && typeof data === 'object') {
        return Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, deepReplace(v, replacements)])
        );
    }
    return data;
}

export const replaceEnvConfigValues = (portalFrom, portalTo, data, configData) => {
    if (!configData || data === null || data === undefined) return data;
    
    const replacements = Object.values(configData)
        .filter(item => item[portalFrom] !== undefined && item[portalTo] !== undefined)
        .map(item => ({ from: item[portalFrom], to: item[portalTo] }));
    
    if (replacements.length === 0) return data;
    
    return deepReplace(data, replacements);
};

export const promoteContent = async (targetPortalIndex, sourcePortalIndex, sourcePortalKey, sourceId, targetId, title) => {
    const sourcePortalUrlValue = sessionStorage.getItem?.('portalUrl' + sourcePortalIndex)
    const targetPortalUrlValue = sessionStorage.getItem?.('portalUrl' + targetPortalIndex)

    if (!sourcePortalUrlValue || !targetPortalUrlValue) {
        return { error: 'Missing portal URL configuration in sessionStorage.', success: false }
    }

    try {
        const sourcePortalUrl = sourcePortalUrlValue.replaceAll('/sharing/rest', '')
        const targetPortalUrl = targetPortalUrlValue.replaceAll('/sharing/rest', '')
        const auth = getSessionFromSessionStorage(sourcePortalKey)
        const username = auth?.username ?? null
        let logurl = config["LogPromotionAction"]

        let url = config["UpdateContent"]
        let promoteData = {
                sourceEnv: sourcePortalUrl,
                targetEnv: targetPortalUrl,
                sourceId: sourceId,
                targetId: targetId
            }

        const response = await callBackendAPI(
            url,
            'POST',
            promoteData,
            sourcePortalIndex,
            sourcePortalKey
        );
        let promoteResp = {}
        let responseBody = await response.text();
        if (response.status === 200) {        
            promoteResp = { result: responseBody, success: true };
        }
        else {
            const respJSON = JSON.parse(responseBody)
            promoteResp = { error: response.statusText + ": " + respJSON?.error, success: false };
        }

        // Log promotion action (fire-and-forget with authentication)
        callBackendAPI(
            logurl,
            'POST',
            {
                ...promoteData,
                username: username,
                id: sourceId,
                title: title,
                success: promoteResp.success,
                error: promoteResp.success ? null : promoteResp.error
            },
            sourcePortalIndex,
            sourcePortalKey
        )
        .catch((logError) => {
            if (import.meta.env.DEV) {
                console.error('Error logging promotion action:', logError);
            }
        });

        return promoteResp;

    } catch(error) {
        if (import.meta.env.DEV) {
            console.error('Error in promoteContent:', error);
        }
        return { error: 'An unexpected error occurred during promotion. Please try again.', success: false }
    }
    
};
