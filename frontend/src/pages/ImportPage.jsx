import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Stack,
  Autocomplete,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Computer as ComputerIcon,
  Edit as EditIcon,
  CleaningServices as CleanIcon,
} from '@mui/icons-material';
import { uploadTsv, getImports, deleteImport, getMachines, createMachine, renameMachine, cleanImport } from '../services/api';

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [machineName, setMachineName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [imports, setImports] = useState([]);
  const [machines, setMachines] = useState([]);
  const [showNewMachine, setShowNewMachine] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [editingMachine, setEditingMachine] = useState(null);
  const [editMachineName, setEditMachineName] = useState('');
  const [cleaningImport, setCleaningImport] = useState(null);
  const [cleanAgainstIds, setCleanAgainstIds] = useState([]);
  const [cleanResult, setCleanResult] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const fileRef = useRef();

  const loadData = async () => {
    try {
      const [importsRes, machinesRes] = await Promise.all([getImports(), getMachines()]);
      setImports(importsRes.data);
      setMachines(machinesRes.data);
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async () => {
    if (!file || !machineName.trim()) return;
    setUploading(true);
    setProgress(0);
    setError('');
    setResult(null);
    try {
      const res = await uploadTsv(file, machineName.trim(), (e) => {
        if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
      });
      setResult(res.data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this import and all its visits?')) return;
    try {
      await deleteImport(id);
      loadData();
    } catch {}
  };

  const handleCreateMachine = async () => {
    if (!newMachineName.trim()) return;
    try {
      await createMachine(newMachineName.trim());
      setNewMachineName('');
      setShowNewMachine(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create machine');
    }
  };

  const handleRenameMachine = async () => {
    if (!editMachineName.trim() || !editingMachine) return;
    try {
      await renameMachine(editingMachine.id, editMachineName.trim());
      setEditingMachine(null);
      setEditMachineName('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to rename machine');
    }
  };

  const handleClean = async () => {
    if (!cleaningImport || cleanAgainstIds.length === 0) return;
    setCleaning(true);
    setCleanResult(null);
    try {
      const res = await cleanImport(cleaningImport.id, cleanAgainstIds);
      setCleanResult(res.data);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Clean failed');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Import History
      </Typography>

      {/* Upload Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Upload TSV File
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Supports HTU export formats: 3-column (url, time, transition), 4-column (+ title),
          and 8-column (full analysis export).
        </Typography>

        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Autocomplete
              freeSolo
              options={machines.map((m) => m.name)}
              value={machineName}
              onInputChange={(_, val) => setMachineName(val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Machine Tag"
                  placeholder="e.g. Work Laptop, Home Desktop"
                  size="small"
                  required
                  helperText="Tag this import with a machine name"
                />
              )}
              sx={{ minWidth: 300 }}
            />
            <Tooltip title="Create new machine">
              <IconButton onClick={() => setShowNewMachine(true)} color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
              Choose File
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".tsv,.txt,.csv"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </Button>
            {file && (
              <Typography variant="body2">
                {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={!file || !machineName.trim() || uploading}
              startIcon={<UploadIcon />}
            >
              {uploading ? 'Uploading...' : 'Import'}
            </Button>
          </Stack>

          {uploading && <LinearProgress variant="determinate" value={progress} />}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {result && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Imported {result.row_count.toLocaleString()} visits from "{result.filename}" →{' '}
            <strong>{result.machine_name}</strong>
          </Alert>
        )}
      </Paper>

      {/* Machines */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          <ComputerIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Machines
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {machines.map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              variant="outlined"
              color="primary"
              onDelete={() => { setEditingMachine(m); setEditMachineName(m.name); }}
              deleteIcon={<Tooltip title="Rename"><EditIcon fontSize="small" /></Tooltip>}
              sx={{ mb: 1 }}
            />
          ))}
          {machines.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No machines yet. Import a file to create one automatically.
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* Import History */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Import History</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>File</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Machine</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Visits Imported</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {imports.map((imp) => (
                <TableRow key={imp.id} hover>
                  <TableCell>{imp.filename}</TableCell>
                  <TableCell>
                    <Chip label={imp.machine_name} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{imp.row_count.toLocaleString()}</TableCell>
                  <TableCell>{new Date(imp.imported_at).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="De-duplicate against other imports">
                      <IconButton
                        size="small"
                        color="info"
                        onClick={() => {
                          setCleaningImport(imp);
                          setCleanAgainstIds([]);
                          setCleanResult(null);
                        }}
                      >
                        <CleanIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete import and all its visits">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(imp.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {imports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">No imports yet</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* New Machine Dialog */}
      <Dialog open={showNewMachine} onClose={() => setShowNewMachine(false)}>
        <DialogTitle>Create New Machine</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Machine Name"
            value={newMachineName}
            onChange={(e) => setNewMachineName(e.target.value)}
            autoFocus
            sx={{ mt: 1 }}
            placeholder="e.g. Work Laptop"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewMachine(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateMachine} disabled={!newMachineName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Machine Dialog */}
      <Dialog open={!!editingMachine} onClose={() => setEditingMachine(null)}>
        <DialogTitle>Rename Machine</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="New Name"
            value={editMachineName}
            onChange={(e) => setEditMachineName(e.target.value)}
            autoFocus
            sx={{ mt: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameMachine()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingMachine(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleRenameMachine} disabled={!editMachineName.trim()}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clean / De-duplicate Dialog */}
      <Dialog
        open={!!cleaningImport}
        onClose={() => { setCleaningImport(null); setCleanResult(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>De-duplicate Import</DialogTitle>
        <DialogContent>
          {cleaningImport && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Remove visits from <strong>"{cleaningImport.filename}"</strong> ({cleaningImport.machine_name})
                that already exist in the selected reference imports. The reference copies are kept.
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Keep visits from these imports (remove duplicates from the one above):
              </Typography>
              <Autocomplete
                multiple
                options={imports.filter((i) => i.id !== cleaningImport.id)}
                getOptionLabel={(opt) => `${opt.filename} (${opt.machine_name}, ${opt.row_count.toLocaleString()} visits)`}
                value={imports.filter((i) => cleanAgainstIds.includes(i.id))}
                onChange={(_, val) => setCleanAgainstIds(val.map((v) => v.id))}
                renderInput={(params) => (
                  <TextField {...params} label="Reference imports" placeholder="Select imports to keep" />
                )}
                sx={{ mb: 2 }}
              />
              {cleanResult && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Removed {cleanResult.removed.toLocaleString()} duplicate visits.{' '}
                  {cleanResult.remaining.toLocaleString()} visits remaining in this import.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCleaningImport(null); setCleanResult(null); }}>
            {cleanResult ? 'Done' : 'Cancel'}
          </Button>
          {!cleanResult && (
            <Button
              variant="contained"
              color="warning"
              onClick={handleClean}
              disabled={cleanAgainstIds.length === 0 || cleaning}
            >
              {cleaning ? 'Cleaning...' : 'Remove Duplicates'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
