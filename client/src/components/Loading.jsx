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

import PropTypes from "prop-types";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * Loading component displays a full-screen loading overlay
 * @param {object} props
 * @param {string} [props.message="Loading..."] - Optional loading message
 * @param {object} [props.loaderProps={}] - Additional props for CircularProgress
 * @returns {JSX.Element} Loading overlay component
 */
const Loading = ({ message = "Loading...", loaderProps = {} }) => (
    <Box
        sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 9999
        }}
    >
        <CircularProgress {...loaderProps} />
        {message && <Typography variant="body1" sx={{ marginTop: "1rem", color: "white" }}>{message}</Typography>}
    </Box>
);

Loading.propTypes = {
    message: PropTypes.string,
    loaderProps: PropTypes.object
};

export default Loading;