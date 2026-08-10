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

import {useState} from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar from '@mui/material/AppBar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { CompareArrows, EditNote, Publish } from '@mui/icons-material'; 
import CompareForm from './CompareForm';
import EditConfig from './EditConfig';
import PromoteContent from './PromoteContent';
import Grid from '@mui/material/Grid2';

const drawerWidth = 240;

const menuItems = [
  { text: 'Compare', icon: CompareArrows, component: CompareForm },
  { text: 'Promote', icon: Publish, component: PromoteContent },
  { text: 'Edit Config', icon: EditNote, component: EditConfig }
];

const openedMixin = (theme) => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  variants: [
    {
      props: ({ open }) => open,
      style: {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
  ],
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    variants: [
      {
        props: ({ open }) => open,
        style: {
          ...openedMixin(theme),
          '& .MuiDrawer-paper': openedMixin(theme),
        },
      },
      {
        props: ({ open }) => !open,
        style: {
          ...closedMixin(theme),
          '& .MuiDrawer-paper': closedMixin(theme),
        },
      },
    ],
  }),
);

export default function MiniDrawer() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(<CompareForm />);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const onClick = (Component) => {
    setContent(<Component />);
  }

  return (
    <Box sx={{ display: 'flex'}}>
      <CssBaseline />  
      <AppBar position="fixed" open={open}>
          <Grid container size={12} className="MuiGrid2-container-dark">
            <Grid size={1}>
              <IconButton
                color='#120C83'
                aria-label="open drawer"
                onClick={handleDrawerOpen}
                edge="start"
                sx={[
                  {
                    marginRight: 5,
                    marginLeft: 3,
                    marginTop: 1
                  },
                  open && { display: 'none' }
                ]}
              >
                <MenuIcon sx={{ color: 'white' }} />
              </IconButton>
            </Grid>
            <Grid size={6}>
              <Typography variant="h5" noWrap component="div" className="Title" sx={{ paddingLeft: '14px', paddingTop: '18px', color: 'white' }}>
                Portal Application Lifecycle Manager
              </Typography>
            </Grid>
            <Grid size={5}>
            </Grid>
          </Grid>
        </AppBar>

      <Drawer variant="permanent" open={open}> 
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose} className='MenuIcon' aria-label="close drawer"> 
            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        
        </DrawerHeader>
        <Divider />
        <List
          sx={{
            "&.Mui-selected": {
                backgroundColor: "#2e8b57!important"
            }
        }} 
        >
            {menuItems.map((item) => (
            <ListItem key={item.text} sx={{ display: 'block', color: 'white' }} onClick={() => onClick(item.component)}>
              <ListItemButton aria-label={item.text} sx={[
                  { minHeight: 48, px: 2.5 },
                  open
                    ? { justifyContent: 'initial' }
                    : { justifyContent: 'center' }
                ]}
              >
                <ListItemIcon className='MenuIcon' sx={[
                    { minWidth: 0, justifyContent: 'center' },
                    open
                      ? { mr: 3 }
                      : { mr: 'auto' }
                  ]}
                >
                  <item.icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={[
                    open
                      ? {
                          opacity: 1,
                        }
                      : {
                          opacity: 0,
                        },
                  ]}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, backgroundColor: '#120C83' }}>
        <DrawerHeader/>
        {content}
      </Box>
    </Box>
  );
}
