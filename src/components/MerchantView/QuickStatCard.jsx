// src/components/MerchantView/QuickStatCard.jsx
import React from 'react';
import { Card, CardContent, Box, Typography, Grid } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PaymentIcon from '@mui/icons-material/Payment';
import TodayIcon from '@mui/icons-material/Today';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

export function QuickStatCard({ title, value, icon, color = 'primary', subtitle }) {
  return (
    <Card sx={{ height: '100%', borderTop: 3, borderColor: `${color}.main` }}>
      <CardContent sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}.lighter`, color: `${color}.main` }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function StatsOverview({
  pendingCount = 0,
  awaitingPaymentCount = 0,
  paymentClaimedCount = 0,
  todayPrints = 0,
  todayEarnings = 0,
}) {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <QuickStatCard
          title="Pending"
          value={pendingCount}
          icon={<HourglassEmptyIcon />}
          color="warning"
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <QuickStatCard
          title="Payment"
          value={awaitingPaymentCount}
          subtitle={paymentClaimedCount > 0 ? `${paymentClaimedCount} claimed` : undefined}
          icon={<PaymentIcon />}
          color={paymentClaimedCount > 0 ? 'error' : 'info'}
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <QuickStatCard
          title="Today's Prints"
          value={todayPrints}
          icon={<TodayIcon />}
          color="success"
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <QuickStatCard
          title="Today's Earnings"
          value={`₹${Number(todayEarnings).toFixed(2)}`}
          icon={<AttachMoneyIcon />}
          color="primary"
        />
      </Grid>
    </Grid>
  );
}
