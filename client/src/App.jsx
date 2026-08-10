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

import './App.css';
import { useState, useEffect, useRef } from 'react';
import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import MainLayout from './components/MainLayout';
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { useSearchParams } from 'react-router';

const palmTheme = createTheme({
  palette: {
    mode: 'light',
      primary: {
        main: '#120C83',
      },
      secondary: {
        main: '#fdad13',
      },
      background: {
        default: '#ffffff',
        card: '#000000',
      },
      text: {
        primary: '#000000',
        secondary: '#000000',
      },
    },
    typography: {
      fontFamily: [
        'Avenir Next',
        'Helvetica Neue',
        'sans-serif',
        'PingFang SC',
        'Microsoft YaHei',
      ].join(','),
    },
});

function PostAuth() {
    const [searchParams] = useSearchParams();
    const [error, setError] = useState(null);
    const hasCompleted = useRef(false); // Guard against StrictMode double-invocation

    useEffect(() => {
        const completeAuth = async () => {
            // Prevent duplicate OAuth completion (StrictMode double-invokes in dev)
            if (hasCompleted.current) {
                return;
            }
            
            hasCompleted.current = true; // Mark as started immediately
            
            try {
                const rawPortalId = searchParams.get('portalId');
                const VALID_PORTAL_INDICES = ['0', '1', '2'];
                if (!VALID_PORTAL_INDICES.includes(rawPortalId)) {
                    setError('Invalid portal identifier');
                    return;
                }
                const portalId = rawPortalId;
                const clientId = sessionStorage.getItem('clientId' + portalId);
                const portalUrl = sessionStorage.getItem('portalUrl' + portalId);
                const redirectUriForAuth = sessionStorage.getItem('redirectUri' + portalId);
                await ArcGISIdentityManager.completeOAuth2({
                    portal: portalUrl,
                    clientId: clientId,
                    redirectUri: redirectUriForAuth,
                });
                
                // Redirect to home after successful auth
                window.location.href = '/';
            } catch (err) {
                if (import.meta.env.DEV) console.error('OAuth completion failed:', err);
                setError(err.message);
            }
        };
        
        completeAuth();
    }, [searchParams]);

    if (error) {
        return <div>Authentication failed: {error}</div>;
    }

    return <div>Completing authentication...</div>;
}

function App() {

  return(
    <BrowserRouter>
     <ThemeProvider theme={palmTheme}>
        <CssBaseline />
        <Routes>
          <Route path="/" element={<MainLayout/>} />
          <Route path="/postauth" element={<PostAuth/>} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
