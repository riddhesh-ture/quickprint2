import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, IconButton, Avatar, Menu, MenuItem, Divider,
  Badge, useMediaQuery, useTheme, Chip, Button, BottomNavigation, BottomNavigationAction,
  Paper
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PrintIcon from '@mui/icons-material/Print';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useAuth } from '../../hooks/useAuth';
import { signOutUser } from '../../firebase/auth';
import { supabase } from '../../supabase/client';

const DRAWER_WIDTH = 260;

const menuItems = [
  { text: 'Print Jobs', icon: <PrintIcon />, path: '/merchant/dashboard' },
  { text: 'Analytics', icon: <BarChartIcon />, path: '/merchant/analytics' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/merchant/settings' },
];

export default function MerchantLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData } = useAuth();

  // Lightweight HEAD count query for menu badge (avoids continuous heavy WebSocket on static layout)
  const fetchPendingCount = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const { count, error: countErr } = await supabase
        .from('print_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', user.uid)
        .eq('status', 'pending');
      if (!countErr && count !== null) {
        setPendingCount(count);
      }
    } catch (e) {
      console.warn('Could not fetch pending count for badge:', e);
    }
  }, [user?.uid]);

  useEffect(() => {
    // If merchant is on the dashboard, live Supabase Realtime updates
    // pendingCount via outletCtx, rendering 30s background polling redundant.
    if (location.pathname.startsWith('/merchant/dashboard')) {
      return;
    }

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingCount, location.pathname]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (path) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      navigate('/');
    }
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <StorefrontIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
            QuickPrint
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Merchant Portal
          </Typography>
        </Box>
      </Box>
      
      <Divider />

      {/* Shop Info */}
      <Box sx={{ p: 2, bgcolor: 'primary.lighter' }}>
        <Typography variant="subtitle2" fontWeight="bold" noWrap>
          {userData?.shopName || 'Your Shop'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {userData?.city || 'Location not set'}
        </Typography>
      </Box>

      <Divider />

      {/* Navigation */}
      <List sx={{ flexGrow: 1, px: 1, py: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleMenuClick(item.path)}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? 'primary.main' : 'transparent',
                  color: isActive ? 'white' : 'inherit',
                  '&:hover': {
                    bgcolor: isActive ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <ListItemIcon sx={{ color: isActive ? 'white' : 'inherit', minWidth: 40 }}>
                  {item.text === 'Print Jobs' && pendingCount > 0 ? (
                    <Badge badgeContent={pendingCount} color="error">
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                <ListItemText primary={item.text} />
                {item.text === 'Print Jobs' && pendingCount > 0 && (
                  <Chip 
                    label={pendingCount} 
                    size="small" 
                    color={isActive ? 'default' : 'error'}
                    sx={{ 
                      height: 20, 
                      fontSize: 11,
                      bgcolor: isActive ? 'rgba(255,255,255,0.2)' : undefined,
                      color: isActive ? 'white' : undefined,
                    }} 
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* User Info */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
            {userData?.ownerName?.[0] || 'M'}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {userData?.ownerName || 'Merchant'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          fullWidth
          size="small"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ mt: 1.5 }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  // Determine current active path for bottom navigation
  const currentTab = ['/merchant/analytics', '/merchant/settings'].includes(location.pathname)
    ? location.pathname
    : '/merchant/dashboard';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'grey.100' }}>
      {/* Mobile Top App Bar */}
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: '1px solid',
            borderColor: 'divider',
            zIndex: 1100,
          }}
        >
          <Toolbar sx={{ minHeight: 56, px: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorefrontIcon sx={{ color: 'primary.main', fontSize: 26 }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.15 }}>
                  QuickPrint
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 170 }}>
                  {userData?.shopName || 'Merchant Station'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.85rem', fontWeight: 700 }}>
                  {userData?.ownerName?.[0] || 'M'}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                PaperProps={{ sx: { minWidth: 200, borderRadius: 2, mt: 1 } }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {userData?.shopName || 'Your Shop'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {user?.email}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/merchant/settings'); }}>
                  <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Shop Settings" />
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                  <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText primary="Sign Out" />
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>
      )}

      {/* Desktop Sidebar (Hidden on Mobile) */}
      {!isMobile && (
        <Box component="nav" sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}>
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
                borderRight: '1px solid',
                borderColor: 'divider',
              },
            }}
          >
            {drawer}
          </Drawer>
        </Box>
      )}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: '58px', md: 0 },
          pb: { xs: '76px', md: 3 },
          minHeight: '100vh',
        }}
      >
        <Outlet context={{ pendingCount, setPendingCount, refreshPendingCount: fetchPendingCount }} />
      </Box>

      {/* Mobile Bottom Navigation Bar - Effortless One-Hand Thumb Reach */}
      {isMobile && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <BottomNavigation
            value={currentTab}
            onChange={(_e, newValue) => {
              navigate(newValue);
            }}
            showLabels
            sx={{
              height: 60,
              '& .Mui-selected': {
                color: 'primary.main',
                fontWeight: 700,
              },
            }}
          >
            <BottomNavigationAction
              label="Queue"
              value="/merchant/dashboard"
              icon={
                pendingCount > 0 ? (
                  <Badge badgeContent={pendingCount} color="error">
                    <PrintIcon />
                  </Badge>
                ) : (
                  <PrintIcon />
                )
              }
            />
            <BottomNavigationAction
              label="Analytics"
              value="/merchant/analytics"
              icon={<BarChartIcon />}
            />
            <BottomNavigationAction
              label="Settings"
              value="/merchant/settings"
              icon={<SettingsIcon />}
            />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
