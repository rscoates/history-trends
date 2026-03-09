import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Collapse,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Tooltip,
  Link,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { searchHistory, getMachines } from '../services/api';

const TRANSITIONS = [
  'link', 'typed', 'auto_bookmark', 'auto_subframe', 'manual_subframe',
  'generated', 'auto_toplevel', 'form_submit', 'reload', 'keyword', 'keyword_generated',
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatVisitTime(visitTimeMs) {
  try {
    const ms = parseFloat(visitTimeMs);
    return new Date(ms).toLocaleString();
  } catch {
    return visitTimeMs;
  }
}

function truncate(str, len = 80) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export default function SearchPage() {
  // Basic search
  const [keywords, setKeywords] = useState('');
  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [url, setUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [years, setYears] = useState('');
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedHours, setSelectedHours] = useState([]);
  const [selectedTransitions, setSelectedTransitions] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [sort, setSort] = useState('newest');

  // Results
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Machines
  const [machines, setMachines] = useState([]);

  useEffect(() => {
    getMachines().then((res) => setMachines(res.data)).catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const params = {
      page: page + 1,
      page_size: pageSize,
      sort,
    };
    if (keywords.trim()) params.keywords = keywords.trim();
    if (url.trim()) params.url = url.trim();
    if (domain.trim()) params.domain = domain.trim();
    if (title.trim()) params.title = title.trim();
    if (date.trim()) params.date = date.trim();
    if (dateFrom.trim()) params.date_from = dateFrom.trim();
    if (dateTo.trim()) params.date_to = dateTo.trim();
    if (years.trim()) {
      params.years = years.split(/[,\s]+/).map(Number).filter(Boolean);
    }
    if (selectedMonths.length) params.months = selectedMonths;
    if (selectedDays.length) params.days_of_week = selectedDays;
    if (selectedHours.length) params.hours = selectedHours;
    if (selectedTransitions.length) params.transitions = selectedTransitions;
    if (selectedMachines.length) params.machine_ids = selectedMachines;
    return params;
  }, [keywords, url, domain, title, date, dateFrom, dateTo, years,
    selectedMonths, selectedDays, selectedHours, selectedTransitions, selectedMachines,
    page, pageSize, sort]);

  const doSearch = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams();
      if (resetPage) {
        params.page = 1;
        setPage(0);
      }
      const res = await searchHistory(params);
      setResults(res.data.results);
      setTotal(res.data.total);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const handleSearch = (e) => {
    e?.preventDefault();
    doSearch(true);
  };

  // Re-search on page/sort change (but only if already searched)
  useEffect(() => {
    if (searched) doSearch(false);
  }, [page, pageSize, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearAll = () => {
    setKeywords('');
    setUrl('');
    setDomain('');
    setTitle('');
    setDate('');
    setDateFrom('');
    setDateTo('');
    setYears('');
    setSelectedMonths([]);
    setSelectedDays([]);
    setSelectedHours([]);
    setSelectedTransitions([]);
    setSelectedMachines([]);
    setResults([]);
    setTotal(0);
    setSearched(false);
  };

  const activeFilterCount = [
    url, domain, title, date, dateFrom, dateTo, years,
    selectedMonths.length, selectedDays.length, selectedHours.length,
    selectedTransitions.length, selectedMachines.length,
  ].filter(Boolean).length;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Search History
      </Typography>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <form onSubmit={handleSearch}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              placeholder="Search keywords (e.g. hacker news, react docs)…"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
            <Button
              variant="contained"
              type="submit"
              disabled={loading}
              sx={{ minWidth: 100 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Search'}
            </Button>
            <Tooltip title={showAdvanced ? 'Hide filters' : 'Show advanced filters'}>
              <IconButton onClick={() => setShowAdvanced(!showAdvanced)}>
                <FilterIcon color={activeFilterCount > 0 ? 'primary' : 'inherit'} />
                {activeFilterCount > 0 && (
                  <Chip
                    label={activeFilterCount}
                    size="small"
                    color="primary"
                    sx={{ position: 'absolute', top: -4, right: -4, height: 18, fontSize: 10 }}
                  />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear all">
              <IconButton onClick={handleClearAll}>
                <ClearIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </form>

        {/* Advanced Filters */}
        <Collapse in={showAdvanced}>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              {/* URL */}
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="URL (contains)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="github.com/user"
                />
              </Grid>

              {/* Domain */}
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com or =exact.host.com"
                  helperText="Prefix = for exact host match"
                />
              </Grid>

              {/* Page Title */}
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Page Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Search in page titles"
                />
              </Grid>

              {/* Exact Date */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Exact Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Date From */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Date From"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Date To */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Date To"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Year(s) */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Year(s)"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  placeholder="2024, 2025"
                />
              </Grid>

              {/* Day of Week */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Day of Week</InputLabel>
                  <Select
                    multiple
                    value={selectedDays}
                    onChange={(e) => setSelectedDays(e.target.value)}
                    input={<OutlinedInput label="Day of Week" />}
                    renderValue={(sel) => sel.map((d) => DAYS_OF_WEEK[d]).join(', ')}
                  >
                    {DAYS_OF_WEEK.map((day, i) => (
                      <MenuItem key={i} value={i}>
                        <Checkbox checked={selectedDays.includes(i)} />
                        <ListItemText primary={day} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Month */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Month</InputLabel>
                  <Select
                    multiple
                    value={selectedMonths}
                    onChange={(e) => setSelectedMonths(e.target.value)}
                    input={<OutlinedInput label="Month" />}
                    renderValue={(sel) => sel.map((m) => MONTHS[m]).join(', ')}
                  >
                    {MONTHS.map((month, i) => (
                      <MenuItem key={i} value={i}>
                        <Checkbox checked={selectedMonths.includes(i)} />
                        <ListItemText primary={month} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Hour */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Hour</InputLabel>
                  <Select
                    multiple
                    value={selectedHours}
                    onChange={(e) => setSelectedHours(e.target.value)}
                    input={<OutlinedInput label="Hour" />}
                    renderValue={(sel) => sel.map((h) => `${h}:00`).join(', ')}
                  >
                    {HOURS.map((h) => (
                      <MenuItem key={h} value={h}>
                        <Checkbox checked={selectedHours.includes(h)} />
                        <ListItemText primary={`${h}:00 - ${h}:59`} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Transition Type */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Transition Type</InputLabel>
                  <Select
                    multiple
                    value={selectedTransitions}
                    onChange={(e) => setSelectedTransitions(e.target.value)}
                    input={<OutlinedInput label="Transition Type" />}
                    renderValue={(sel) => sel.join(', ')}
                  >
                    {TRANSITIONS.map((t) => (
                      <MenuItem key={t} value={t}>
                        <Checkbox checked={selectedTransitions.includes(t)} />
                        <ListItemText primary={t} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Machine */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Machine</InputLabel>
                  <Select
                    multiple
                    value={selectedMachines}
                    onChange={(e) => setSelectedMachines(e.target.value)}
                    input={<OutlinedInput label="Machine" />}
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
              </Grid>

              {/* Sort */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sort</InputLabel>
                  <Select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    label="Sort"
                  >
                    <MenuItem value="newest">Newest first</MenuItem>
                    <MenuItem value="oldest">Oldest first</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {searched && (
        <Paper>
          <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {total.toLocaleString()} result{total !== 1 ? 's' : ''} found
            </Typography>
          </Box>

          <TableContainer sx={{ maxHeight: 'calc(100vh - 340px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: '35%' }}>URL</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '25%' }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date/Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Domain</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Transition</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Machine</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Tooltip title={row.url} placement="top-start">
                        <Link
                          href={row.url}
                          target="_blank"
                          rel="noopener"
                          sx={{ fontSize: '0.8rem', wordBreak: 'break-all' }}
                        >
                          {truncate(row.url, 70)}
                        </Link>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={row.title || ''}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                          {row.title || '—'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatVisitTime(row.visit_time)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.root_domain}
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setDomain(row.root_domain);
                          setShowAdvanced(true);
                        }}
                        sx={{ cursor: 'pointer' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.transition_type}
                        size="small"
                        color={row.transition_type === 'typed' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{row.machine_name}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No results found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[50, 100, 250, 500]}
          />
        </Paper>
      )}

      {!searched && !loading && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Search your browsing history
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Enter keywords or use advanced filters, then press Search
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
