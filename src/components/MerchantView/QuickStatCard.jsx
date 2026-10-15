// src/components/MerchantView/QuickStatCard.jsx
import React from 'react';
import { Card, CardContent, Box, Typography, Grid } from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';

export function QuickStatCard({ title, value, icon, color = 'primary', subtitle }) {
  return (
    <Card
      elevation={0}
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 2.5,
        borderTop: 3,
        borderTopColor: `${color}.main`,
      }}
    >
      <CardContent sx={{ py: 1.75, px: 2, '&:last-child': { pb: 1.75 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography
              variant="h5"
              fontWeight={800}
              color={`${color}.main`}
              sx={{ mt: 0.25, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: `${color}.lighter`,
              color: `${color}.main`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function StatsOverview({
  activeCount = 0,
  todayPrints = 0,
  todayEarnings = 0,
}) {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <QuickStatCard
          title="Active Queue"
          value={activeCount}
          icon={<PrintOutlinedIcon />}
          color={activeCount > 0 ? 'warning' : 'primary'}
          subtitle={activeCount > 0 ? `${activeCount} pending print or pickup` : 'Counter clear'}
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <QuickStatCard
          title="Today's Prints"
          value={todayPrints}
          icon={<CheckCircleOutlineIcon />}
          color="success"
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <QuickStatCard
          title="Today's Earnings"
          value={`₹${Number(todayEarnings).toFixed(2)}`}
          icon={<CurrencyRupeeIcon />}
          color="primary"
        />
      </Grid>
    </Grid>
  );
}
