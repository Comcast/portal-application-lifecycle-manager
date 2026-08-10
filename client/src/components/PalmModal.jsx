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
import Box from "@mui/material/Box";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

/**
 * Reusable modal dialog component
 * @param {object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {string} props.title - Modal title
 * @param {string} props.text - Modal content text (supports multiline)
 * @param {string} props.button1Text - Primary button text
 * @param {Function} props.button1Action - Primary button click handler
 * @param {string} [props.button2Text] - Secondary button text (optional)
 * @param {Function} [props.button2Action] - Secondary button click handler (optional)
 * @param {Function} props.onClose - Close handler for Dialog
 * @returns {JSX.Element} Modal component
 */
const PalmModal = ({
    open,
    title,
    text,
    button1Text,
    button1Action,
    button2Text,
    button2Action,
    onClose,
}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
            <Box sx={{ whiteSpace: 'pre-line' }}>{text}</Box>
        </DialogContent>
        <DialogActions>
            {button2Text && button2Action && (
                <Button onClick={button2Action} variant="outlined">
                    {button2Text}
                </Button>
            )}
            <Button onClick={button1Action} variant="contained">
                {button1Text}
            </Button>
        </DialogActions>
    </Dialog>
);

PalmModal.propTypes = {
    open: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    button1Text: PropTypes.string.isRequired,
    button1Action: PropTypes.func.isRequired,
    button2Text: PropTypes.string,
    button2Action: PropTypes.func,
    onClose: PropTypes.func.isRequired,
};

export default PalmModal;