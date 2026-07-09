"use client";

import { type ReactNode } from "react";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import "dayjs/locale/es";

// Hex literals mirror the tokens in globals.css — MUI's color math can't consume
// CSS variables, so the calendar popup (Paper, day cells) is themed with the same
// palette the rest of the app uses. Keep in sync with globals.css.
const theme = createTheme({
  palette: {
    primary: { main: "#f59e0b", dark: "#d97706", contrastText: "#1c1917" },
    text: { primary: "#1c1917", secondary: "#78716c" },
    divider: "#eae6dd",
    background: { paper: "#ffffff" },
  },
  typography: {
    fontFamily: "var(--font-karla), ui-sans-serif, system-ui, sans-serif",
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid #eae6dd",
          boxShadow: "0 4px 8px rgb(28 25 23 / 0.06), 0 16px 40px rgb(28 25 23 / 0.10)",
        },
      },
    },
    // Selected day: MUI paints primary.contrastText (#1c1917 dark ink) on the
    // amber fill automatically, which meets AA — no per-day override needed.
    MuiOutlinedInput: {
      styleOverrides: { notchedOutline: { borderColor: "#eae6dd" } },
    },
  },
});

export function MuiProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  );
}
