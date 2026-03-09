import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Link,
  Tooltip,
} from '@mui/material';
import {
  Language as GlobeIcon,
  Link as LinkIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as ClockIcon,
  Devices as DevicesIcon,
} from '@mui/icons-material';
import { getStats, getMachines } from '../services/api';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTimestamp(ms) {
  try {
    return new Date(parseFloat(ms)).toLocaleDateString();
  } catch {
    return ms;
  }
}

function StatCard({ icon, label, value, color = 'primary' }) {
  return (
    <Card elevation={2}>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Box sx={{ color: `${color}.main`, mb: 0.5 }}>{icon}</Box>
        <Typography variant="h4" fontWeight={700}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

function BarRow({ label, value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
      <Typography variant="body2" sx={{ width: 60, flexShrink: 0, textAlign: 'right', mr: 1 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, mr: 1 }}>
        <Box
          sx={{
            height: 20,
            width: `${pct}%`,
            bgcolor: 'primary.main',
            borderRadius: 1,
            minWidth: pct > 0 ? 2 : 0,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>
      <Typography variant="body2" sx={{ width: 60, flexShrink: 0 }}>
        {value.toLocaleString()}
      </Typography>
    </Box>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [machines, setMachines] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMachines().then((res) => setMachines(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const ids = selectedMachines.length > 0 ? selectedMachines : null;
    getStats(ids)
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMachines]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stats) {
    return (
      <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
        No data available. Import some history first.
      </Typography>
    );
  }

  const hourMax = Math.max(...Object.values(stats.by_hour).map(Number), 0);
  const dowMax = Math.max(...Object.values(stats.by_day_of_week).map(Number), 0);
  const monthMax = Math.max(...Object.values(stats.by_month).map(Number), 0);
  const yearMax = Math.max(...Object.values(stats.by_year).map(Number), 0);
  const transMax = Math.max(...Object.values(stats.by_transition).map(Number), 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Dashboard
        </Typography>

        {machines.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Filter by Machine</InputLabel>
            <Select
              multiple
              value={selectedMachines}
              onChange={(e) => setSelectedMachines(e.target.value)}
              input={<OutlinedInput label="Filter by Machine" />}
              renderValue={(sel) =>
                sel.map((id) => machines.find((m) => m.id === id)?.name || id).join(', ')
              }
            >
              {machines.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Checkbox checked={selectedMachines.includes(m.id)} />
                  <ListItemText primary={m.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard icon={<LinkIcon />} label="Total Visits" value={stats.total_visits} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon={<GlobeIcon />} label="Unique URLs" value={stats.total_urls} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon={<DevicesIcon />} label="Machines" value={stats.total_machines} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<CalendarIcon />}
            label="Date Range"
            value={
              stats.oldest_visit && stats.newest_visit
                ? `${formatTimestamp(stats.oldest_visit)} – ${formatTimestamp(stats.newest_visit)}`
                : '—'
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* By Hour */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              <ClockIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              By Hour of Day
            </Typography>
            {Array.from({ length: 24 }, (_, h) => (
              <BarRow key={h} label={`${h}:00`} value={Number(stats.by_hour[h] || 0)} max={hourMax} />
            ))}
          </Paper>
        </Grid>

        {/* By Day of Week */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              By Day of Week
            </Typography>
            {DAYS_OF_WEEK.map((day, i) => (
              <BarRow key={i} label={day} value={Number(stats.by_day_of_week[i] || 0)} max={dowMax} />
            ))}

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              By Month
            </Typography>
            {MONTHS.map((month, i) => (
              <BarRow key={i} label={month} value={Number(stats.by_month[i] || 0)} max={monthMax} />
            ))}
          </Paper>
        </Grid>

        {/* By Year */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              By Year
            </Typography>
            {Object.entries(stats.by_year)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([year, count]) => (
                <BarRow key={year} label={year} value={Number(count)} max={yearMax} />
              ))}
          </Paper>
        </Grid>

        {/* By Transition */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              By Transition Type
            </Typography>
            {Object.entries(stats.by_transition)
              .sort(([, a], [, b]) => Number(b) - Number(a))
              .map(([trans, count]) => (
                <BarRow key={trans} label={trans} value={Number(count)} max={transMax} />
              ))}
          </Paper>
        </Grid>

        {/* Top Domains */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              <GlobeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Top Domains
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Domain</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Visits</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.top_domains.map((d, i) => (
                    <TableRow key={d.domain} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Chip label={d.domain} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{d.count.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Top URLs */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Top URLs
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>URL</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Visits</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.top_urls.map((u, i) => (
                    <TableRow key={u.url} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Tooltip title={u.url}>
                          <Link
                            href={u.url}
                            target="_blank"
                            rel="noopener"
                            sx={{ fontSize: '0.8rem', wordBreak: 'break-all' }}
                          >
                            {u.title || u.url.slice(0, 60)}
                          </Link>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">{u.count.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
