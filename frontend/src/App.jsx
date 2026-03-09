import React, { useState, useMemo, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SearchPage from './pages/SearchPage';
import ImportPage from './pages/ImportPage';
import DashboardPage from './pages/DashboardPage';

const ColorModeContext = createContext();
export const useColorMode = () => useContext(ColorModeContext);

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('htu_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [mode, setMode] = useState(() => localStorage.getItem('htu_theme') || 'dark');

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prev) => {
          const next = prev === 'light' ? 'dark' : 'light';
          localStorage.setItem('htu_theme', next);
          return next;
        });
      },
      mode,
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'dark'
            ? {
                primary: { main: '#90caf9' },
                background: { default: '#121212', paper: '#1e1e1e' },
              }
            : {
                primary: { main: '#1976d2' },
              }),
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          fontSize: 13,
        },
        components: {
          MuiTableCell: {
            styleOverrides: {
              root: { padding: '8px 12px', fontSize: '0.82rem' },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<SearchPage />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/import" element={<ImportPage />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
