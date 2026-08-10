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

import PropTypes from 'prop-types'
import { Divider, Box, Typography } from '@mui/material'


export const LoadingComponent = () => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="body1" sx={{ mr: 1.25 }}>Loading...</Typography>
    </Box>
  )
}

export const CustomDivider = ({ orientation = 'horizontal' }) => {
  return <Divider orientation={orientation} flexItem className='Border MarginBottom' />
}

CustomDivider.propTypes = {
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
}
