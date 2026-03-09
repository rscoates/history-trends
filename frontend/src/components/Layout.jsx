import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Upload as UploadIcon,
  Dashboard as DashboardIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  Logout as LogoutIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useColorMode } from '../App';

const DRAWER_WIDTH = 220;

const navItems = [
  { path: '/search', label: 'Search', icon: <SearchIcon /> },
  { path: '/import', label: 'Import', icon: <UploadIcon /> },
  { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleColorMode, mode } = useColorMode();

  const handleLogout = () => {
    localStorage.removeItem('htu_token');
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar sx={{ gap: 1, px: 2 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h6" noWrap fontWeight={700} color="primary">
            HTU Viewer
          </Typography>
        </Toolbar>
        <Divider />
        <List sx={{ flex: 1 }}>
          {navItems.map((item) => (
            <ListItemButton
              key={item.path}
              selected={location.pathname === item.path || (item.path === '/search' && location.pathname === '/')}
              onClick={() => navigate(item.path)}
              sx={{ borderRadius: 1, mx: 1, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton onClick={toggleColorMode} size="small">
              {mode === 'dark' ? <LightIcon /> : <DarkIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton onClick={handleLogout} size="small">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
        {children}
      </Box>
    </Box>
  );
}
