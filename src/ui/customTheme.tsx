import React from 'react';
import { ChevronDown } from 'lucide-react';
import ListEmpty from '../vector/components/list-empty';
import {
  LinearProgress,
  PaletteMode,
  PaletteOptions,
  ThemeOptions,
  createTheme,
  css,
  responsiveFontSizes,
} from '@mui/material';

/** Chevron for select inputs, replacing Material's filled triangle. MUI supplies the className (rotation, colour). */
const SelectChevron: React.FC<{ className?: string }> = ({ className }) => (
  <ChevronDown className={className} size={16} strokeWidth={2} aria-hidden />
);

const buttonBase = {
  defaultProps: {
    disableElevation: true,
    disableRipple: true,
    color: 'primary' as const,
    variant: 'contained' as const,
    size: 'large' as const,
  },
  styleOverrides: {
    root: {
      textTransform: 'none',
      fontWeight: 500,
      borderRadius: 0,
      transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
      lineHeight: '1',
      paddingTop: '0',
      paddingBottom: 0,
    },
    sizeLarge: {
      fontSize: 14,
      letterSpacing: 0,
      height: 40,
    },
    sizeMedium: {
      fontSize: 13,
      height: 34,
    },
    sizeSmall: {
      fontSize: 12,
      height: 28,
    },
    iconSizeLarge: {
      '>svg': {
        position: 'relative',
        top: -0.5,
        fontSize: '18px !important',
      },
    },
    iconSizeMedium: {
      '&.MuiButton-startIcon': {
        marginRight: 6,
      },
      '>svg': {
        position: 'relative',
        top: 0.5,
        fontSize: '18px !important',
      },
    },
    iconSizeSmall: {
      '&.MuiButton-startIcon': {
        marginRight: 3,
      },
      '>svg': {
        position: 'relative',
        top: 1.2,
        fontSize: '20px !important',
      },
    },
  },
} as const;

const baseTypography: ThemeOptions['typography'] = {
  fontFamily:
    "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Noto Sans', sans-serif",
} as const;

const monoTypography = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace !important',
};

const createLightPalette = (): PaletteOptions => ({
  mode: 'light',
  primary: {
    main: '#0e7490',
    light: '#22a6c4',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#52525b',
    light: '#71717a',
    contrastText: '#ffffff',
  },
  background: {
    default: '#fafafa',
    paper: '#ffffff',
  },
  chip: {
    background: '#e4f6fb',
    color: '#0e7490',
  },
  logs: {
    background: '#343434',
    text: {
      default: '#eeeeee',
      error: '#ee6666',
      warning: '#ffee66',
    },
  },
  text: {
    primary: '#09090b',
    secondary: '#52525b',
  },
  divider: 'rgba(9, 9, 11, 0.09)',
});

const createDarkPalette = (): PaletteOptions => ({
  mode: 'dark',
  primary: {
    main: '#22d3ee',
    light: '#67e8f9',
    contrastText: '#041318',
  },
  secondary: {
    main: '#a1a1aa',
    light: '#d4d4d8',
    contrastText: '#09090b',
  },
  background: {
    default: '#09090b',
    paper: '#0e0e11',
  },
  chip: {
    background: '#17171b',
    color: '#e4e4e7',
  },
  logs: {
    background: '#09090b',
    text: {
      default: '#eeeeee',
      error: '#ee6666',
      warning: '#ffee66',
    },
  },
  text: {
    primary: '#fafafa',
    secondary: '#a1a1aa',
  },
  divider: 'rgba(255, 255, 255, 0.08)',
});

const createCustomTheme = (mode: PaletteMode) => {
  const palette = mode === 'dark' ? createDarkPalette() : createLightPalette();

  let theme = createTheme({
    palette,
    typography: baseTypography,
    monoTypography,
    shape: { borderRadius: 0 },
  });

  const isDark = mode === 'dark';
  const cardHeaderBackground = isDark ? '#121216' : '#f4f4f5';
  const tableAlternateRow = isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8f9fd';
  const tableHover = isDark ? 'rgba(34, 211, 238, 0.08)' : 'rgba(51, 219, 238, 0.07)';
  const toolbarBackground = isDark ? '#0b0b0e' : theme.palette.text.primary;
  const tooltipImageBackground = isDark ? '#0e0e11' : '#ffffff';
  const tooltipImageBorder = isDark ? '1px solid rgba(160, 200, 255, 0.35)' : '1px solid rgba(97, 97, 97, 0.9)';
  const dialogSecondaryHover = isDark ? 'rgba(34, 211, 238, 0.12)' : 'rgba(42, 80, 111, 0.04)';
  const chipBackground = theme.palette.chip?.background ?? (isDark ? '#1e3a52' : '#c3efff');
  const chipColor = theme.palette.chip?.color ?? (isDark ? '#a6d7ff' : '#006387');
  const menuItemSelected =
    theme.palette.action?.hover ?? (isDark ? 'rgba(34, 211, 238, 0.1)' : 'rgba(0, 0, 0, 0.08)');

  theme = createTheme(theme, {
    components: {
      // every list uses the Vector empty state instead of react-admin's default
      // `emptyWhileLoading` stops the toolbar / search / buttons flashing before an empty list resolves
      RaList: { defaultProps: { empty: <ListEmpty />, emptyWhileLoading: true } },
      MuiCssBaseline: {
        styleOverrides: css`
          * {
            font-family:
              Inter,
              system-ui,
              -apple-system,
              Segoe UI,
              Roboto,
              Ubuntu,
              Cantarell,
              Noto Sans,
              sans-serif,
              BlinkMacSystemFont,
              'Segoe UI',
              Roboto,
              'Helvetica Neue',
              Arial,
              'Noto Sans',
              sans-serif,
              'Apple Color Emoji',
              'Segoe UI Emoji',
              'Segoe UI Symbol',
              'Noto Color Emoji' !important;
          }

          html,
          body {
            padding: 0;
            margin: 0;
            line-height: 1.5;
            height: 100%;
            overflow: auto;
            background-color: ${theme.palette.background.default};
            color: ${theme.palette.text.primary};
          }

          /* the top bar is fixed: reserve its height with padding (a margin made the page 56px too tall) */
          .RaLayout-appFrame {
            margin-top: 0 !important;
            padding-top: 56px;
          }

          /* edit / create forms render inside the Vector slide-over sheet */
          .vx-sheet {
            .RaEdit-main,
            .RaCreate-main {
              display: block !important;
              height: auto !important;
              width: 100%;
              margin: 0 !important;

              > div {
                padding: 0 !important;
                max-width: none !important;
              }
            }

            .RaEdit-card,
            .RaCreate-card {
              border: 0 !important;
              background: transparent !important;
              box-shadow: none !important;
              overflow: visible !important;
            }

            .RaSimpleForm-form,
            .RaTabbedForm-content,
            form {
              padding: 0 !important;
            }

            .MuiCardContent-root {
              padding: 0 !important;
            }

            /* footer stays reachable: Save on the right, a destructive action quietly on the left */
            .RaToolbar-desktopToolbar,
            .RaToolbar-mobileToolbar,
            .MuiToolbar-root.RaToolbar-desktopToolbar {
              position: sticky;
              bottom: 0;
              z-index: 2;
              display: flex;
              flex-direction: row-reverse;
              align-items: center;
              justify-content: space-between !important;
              gap: 12px;
              padding: 14px 24px !important;
              margin: 24px -24px 0 !important;
              min-height: 0 !important;
              background-color: ${theme.palette.background.paper} !important;
              background-image: linear-gradient(${isDark ? 'rgba(255,255,255,0.025)' : 'rgba(9,9,11,0.025)'}, ${
                isDark ? 'rgba(255,255,255,0.025)' : 'rgba(9,9,11,0.025)'
              }) !important;
              border-top: 1px solid ${theme.palette.divider};

              > * {
                flex: 0 0 auto !important;
                width: auto !important;
              }
            }

            /* Save and Delete often share one wrapper: spread them to opposite ends */
            [class*='RaToolbar'] > :has(> [class*='MuiButton-colorError']) {
              display: flex !important;
              flex-direction: row-reverse;
              justify-content: space-between !important;
              width: 100% !important;
              gap: 12px;
            }

            button[type='submit'] {
              min-width: 128px;
              height: 40px;
              background: ${theme.palette.secondary.main} !important;
              color: ${isDark ? '#041318' : '#ffffff'} !important;
              font-weight: 600;
              &:hover {
                filter: brightness(1.08);
              }
              &.Mui-disabled {
                background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(9,9,11,0.08)'} !important;
                color: ${theme.palette.text.disabled} !important;
              }
            }

            /* fields: roomier, clearer focus, calmer labels */
            .MuiOutlinedInput-root {
              height: 42px;
              background: ${isDark ? 'rgba(255,255,255,0.03)' : '#fafafa'};
              transition: background-color 0.15s ease, box-shadow 0.15s ease;
              &.Mui-focused {
                background: ${theme.palette.background.paper};
                box-shadow: 0 0 0 3px color-mix(in oklab, ${theme.palette.secondary.main} 22%, transparent);
              }
              &.Mui-disabled {
                background: ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(9,9,11,0.035)'};
                input {
                  font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
                  font-size: 12.5px;
                  -webkit-text-fill-color: ${theme.palette.text.secondary};
                }
              }
            }
            .MuiInputLabel-root {
              margin-bottom: 8px;
            }
            /* toggles sit in their own bordered cells */
            .MuiFormControlLabel-root {
              margin: 0 !important;
              padding: 10px 14px;
              border: 1px solid ${theme.palette.divider};
              justify-content: space-between;
              flex-direction: row-reverse;
              width: 100%;
            }

            [class*='MuiButton-colorError'] {
              background: transparent !important;
              color: ${theme.palette.error.main} !important;
              border: 1px solid transparent !important;

              &:hover {
                background: ${theme.palette.error.main}1f !important;
                border-color: ${theme.palette.error.main}66 !important;
              }
            }
          }

          #main-content {
            background: ${theme.palette.background.default} !important;
            padding: 24px !important;
            min-width: 0;
          }

          .RaShow-main,
          .RaCreate-main,
          .RaEdit-main {
            margin-top: 0 !important;
          }

          .edit-page,
          .create-page {
            height: 100%;
          }

          .RaCreate-main,
          .RaEdit-main {
            display: flex;
            width: 100%;
            align-items: center !important;
            justify-content: center !important;
            height: 100%;

            > div {
              padding: 30px;
              max-width: 800px;
            }
          }

          /* fits exactly between the top bar and the page padding, so an empty list never scrolls */
          .RaList-noResults {
            display: flex;
            flex-direction: column;
            justify-content: center;
            height: auto;
            min-height: calc(100vh - 104px);
          }

          .RaBulkActionsToolbar-toolbar {
            padding-left: 20px !important;
            padding-right: 15px !important;
            align-items: center !important;

            .MuiToolbar-root {
              min-height: 0 !important;
              padding: 0 !important;
            }
          }

          .RaList-actions {
            align-items: center !important;
            padding-left: 2px;

            .MuiToolbar-root {
              align-items: center !important;
              padding: 4px !important;
            }

            & > form {
              min-height: 0 !important;
              padding: 0 !important;

              .MuiFormControl-root {
                margin-top: 0 !important;
              }
            }
          }

          .RaCreate-main,
          .RaEdit-main {
            .MuiToolbar-root {
              min-height: 0 !important;
              padding: 16px !important;
              background: none !important;
            }

            .RaToolbar-defaultToolbar {
              display: flex;
              justify-content: flex-end !important;

              button {
                flex: 1;
              }

              .ra-delete-button {
                height: 48px;
                flex: 0.3;
                margin-left: 40px;
              }
            }
          }

          .RaDatagrid-tableWrapper {
            td {
              .MuiToolbar-root {
                background: none !important;
                min-height: 0 !important;
                padding: 0 !important;
                justify-content: flex-end !important;

                .MuiButtonBase-root {
                  min-width: 0 !important;
                  margin-left: 10px !important;
                }

                .MuiButton-icon,
                button > svg {
                  margin: 0 !important;
                }
              }
            }
          }

          .RaEditButton-root,
          [class$='RaButton-root'] {
            .MuiButton-icon {
              margin: 0 !important;

              svg {
                top: 0 !important;
              }
            }
          }

          .RaTabbedShowLayout-content {
            padding: 0 !important;
            margin-top: 30px !important;
          }

          .rdl-actions {
            margin: 0 15px !important;

            button {
              padding: 5px !important;
              margin: 0 !important;
              display: flex;
              align-items: center;
              margin-bottom: 1.5px !important;
              outline: none !important;
            }
          }

          /* ---------- lists ---------- */
          /* list content sits directly on the page: no container box behind rows or cards */
          .RaList-content {
            box-shadow: none !important;
            background: transparent !important;
            border: 0 !important;
            overflow: visible !important;
          }
          .RaList-content > .MuiToolbar-root {
            background: transparent !important;
          }
          .RaList-main > .MuiPaper-root,
          .RaList-main > div > .MuiPaper-root {
            background: transparent;
            border: 0;
          }

          .RaDatagrid-tableWrapper table {
            font-size: 13.5px;
          }

          .RaDatagrid-tableWrapper tbody td {
            padding-top: 14px;
            padding-bottom: 14px;
            border-bottom-color: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(9,9,11,0.06)'};
          }
          .RaDatagrid-tableWrapper thead th {
            padding-top: 12px;
            padding-bottom: 12px;
          }
          .RaDatagrid-tableWrapper tbody tr {
            transition: background-color 0.12s ease;
          }
          .RaDatagrid-tableWrapper tbody tr:hover {
            background-color: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(9,9,11,0.025)'} !important;
          }
          /* yes / no cells read as colour, not as heavy black marks */
          .RaDatagrid-tableWrapper svg[data-testid='DoneIcon'] {
            color: ${theme.palette.success.main};
            font-size: 18px;
          }
          .RaDatagrid-tableWrapper svg[data-testid='ClearIcon'],
          .RaDatagrid-tableWrapper svg[data-testid='CloseIcon'] {
            color: ${theme.palette.text.disabled};
            font-size: 16px;
            opacity: 0.7;
          }
          /* links inside rows: no underline until hovered */
          .RaDatagrid-tableWrapper a {
            text-decoration: none;
            font-weight: 500;
          }
          .RaList-content > .MuiToolbar-root {
            border-bottom: 1px solid ${theme.palette.divider};
            padding: 8px 16px !important;
          }

          /* first column reads as the row's name */
          .RaDatagrid-tableWrapper tbody td:nth-of-type(2),
          .RaDatagrid-tableWrapper tbody td.column-name {
            font-weight: 500;
          }

          /* selection boxes only show on hover, focus or when ticked */
          .RaDatagrid-tableWrapper tbody .MuiCheckbox-root:not(.Mui-checked) {
            opacity: 0;
            transition: opacity 0.12s ease;
          }
          .RaDatagrid-tableWrapper tbody tr:hover .MuiCheckbox-root,
          .RaDatagrid-tableWrapper tbody tr:focus-within .MuiCheckbox-root {
            opacity: 1;
          }

          /* row actions stay quiet until the row is hovered */
          .RaDatagrid-tableWrapper td .MuiButton-outlined,
          .RaDatagrid-tableWrapper td .MuiButton-text {
            border-color: transparent !important;
            background: transparent !important;
            color: ${theme.palette.text.secondary} !important;
            opacity: 0.55;
            transition: opacity 0.12s ease, background-color 0.12s ease, color 0.12s ease;
          }
          .RaDatagrid-tableWrapper tr:hover td .MuiButton-outlined,
          .RaDatagrid-tableWrapper tr:hover td .MuiButton-text {
            opacity: 1;
          }
          .RaDatagrid-tableWrapper td .MuiButton-outlined:hover,
          .RaDatagrid-tableWrapper td .MuiButton-text:hover {
            background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(9,9,11,0.06)'} !important;
            color: ${theme.palette.text.primary} !important;
          }
          .RaDatagrid-tableWrapper td [class*='MuiButton-colorError']:hover {
            color: ${theme.palette.error.main} !important;
            background: ${theme.palette.error.main}1f !important;
          }

          /* list toolbar: Create stays primary, everything else is quiet */
          .RaList-actions .MuiButton-root {
            height: 34px;
          }
          .RaList-actions button.MuiButton-root {
            background: transparent !important;
            color: ${theme.palette.text.primary} !important;
            border: 1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(9,9,11,0.2)'} !important;
          }
          .RaList-actions button.MuiButton-root:hover {
            background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(9,9,11,0.05)'} !important;
          }

          /* pagination footer */
          .MuiTablePagination-root {
            color: ${theme.palette.text.secondary};
            border-top: 1px solid ${theme.palette.divider};
            font-size: 12px;
          }
          .MuiTablePagination-toolbar {
            min-height: 48px !important;
            padding-left: 16px !important;
            padding-right: 8px !important;
          }
          .MuiTablePagination-selectLabel,
          .MuiTablePagination-displayedRows {
            margin: 0 !important;
            font-size: 12px !important;
          }
          .MuiTablePagination-select {
            font-size: 12px !important;
          }

          /* ---------- content views ---------- */
          .RaLabeled-label,
          .RaLabeled-root > .MuiTypography-root:first-of-type {
            font-size: 11px !important;
            font-weight: 600 !important;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: ${theme.palette.text.secondary} !important;
          }

          .MuiCardHeader-root {
            padding: 14px 20px !important;
            border-bottom: 1px solid ${theme.palette.divider};
          }
          .MuiCardHeader-title {
            font-size: 13px !important;
            font-weight: 600 !important;
            letter-spacing: -0.005em;
          }
          .MuiCardContent-root:last-child {
            padding-bottom: 20px;
          }
        `.styles,
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            'background': toolbarBackground,
            'color': isDark ? theme.palette.text.primary : '#ffffff',
            'border': 'none',
            'borderRadius': '0',
            'boxShadow': 'none',
            'height': '60px',
            'justifyContent': 'flex-start',
            'padding': 0,
            'marginLeft': '0 !important',
            'width': '100% !important',
            'left': 0,
            'right': 0,
            '& .MuiToolbar-root': {
              paddingLeft: '0 !important',
              paddingRight: '0 !important',
              width: '100%',
            },

            '.RaAppBar-menuButton': {
              display: 'none',
            },

            '#react-admin-title': {
              textAlign: 'center',
              fontWeight: 'bold',
              marginLeft: '230px',
              color: isDark ? theme.palette.text.primary : '#ffffff',
            },

            '[class$="RaLoadingIndicator-root"]': {
              position: 'relative',
              right: '25px',
            },
          },
        },
      },

      MuiCardHeader: {
        styleOverrides: {
          root: {
            backgroundColor: cardHeaderBackground,
          },
        },
      },

      MuiChip: {
        defaultProps: {
          size: 'small',
        },
        styleOverrides: {
          root: {
            'background': chipBackground,
            'border': 'none',
            'borderRadius': 0,

            '.MuiChip-label, .MuiChip-icon': {
              'color': `${chipColor}!important`,

              '&.MuiChip-labelSmall': {
                padding: '0 12px',
              },
            },
          },
        },
      },

      MuiButton: buttonBase,

      MuiLoadingButton: {
        ...buttonBase,
        defaultProps: {
          ...buttonBase.defaultProps,
          loadingIndicator: React.createElement(LinearProgress, { color: 'inherit' }),
        },
        styleOverrides: {
          ...buttonBase.styleOverrides,
          root: {
            ...buttonBase.styleOverrides.root,

            '.MuiLinearProgress-root': {
              width: '100%',
            },

            '.MuiLoadingButton-loadingIndicator': {
              width: '50%',
            },
          },
        },
      },

      MuiFormHelperText: {
        styleOverrides: {
          root: {
            marginLeft: 0,
            marginTop: 6,
            fontSize: 11,
          },
        },
      },

      MuiInputLabel: {
        defaultProps: {
          variant: 'outlined',
          disableAnimation: true,
          shrink: true,
        },
        styleOverrides: {
          root: {
            transform: 'none',
            fontWeight: 500,
            display: 'block',
            position: 'unset',
            lineHeight: 1,
            fontSize: 12,
            letterSpacing: '0.01em',
            color: theme.palette.text.secondary,
            marginBottom: 7,
            '&.Mui-focused': { color: theme.palette.text.primary },
            '.MuiFormLabel-asterisk': { color: theme.palette.text.disabled },
          },
        },
      },

      MuiTextField: {
        defaultProps: {
          color: 'primary',
          variant: 'outlined',
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: {
            borderWidth: '1px !important',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(9, 9, 11, 0.2)',
            transition: 'border-color 0.15s ease',
          },
          root: {
            'borderRadius': 0,
            'height': 40,
            'fontSize': 14,
            'lineHeight': 1,
            'background': isDark ? 'rgba(255, 255, 255, 0.025)' : '#ffffff',

            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(9, 9, 11, 0.4)',
            },

            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: `${theme.palette.primary.main} !important`,
            },

            '&.Mui-disabled': {
              background: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(9, 9, 11, 0.03)',
            },

            '&.MuiInputBase-multiline': {
              height: 'auto',
            },

            '.MuiInputAdornment-root': {
              color: theme.palette.text.disabled,
              marginRight: 4,
            },

            '&.Mui-focused .MuiInputAdornment-root': {
              color: theme.palette.primary.main,
            },

            'input': {
              padding: '10px 12px',
              fontSize: 14,
              height: 'auto',
            },

            '&.MuiInputBase-sizeSmall': {
              'height': 32,
              'lineHeight': 1,
              'fontSize': 14,

              'input': {
                padding: '7px 10px',
                fontSize: 14,
                height: 'auto',
              },

              '.MuiInputAdornment-root': {
                marginRight: 0,

                svg: {
                  width: 18,
                  height: 18,
                },
              },
            },

            'fieldset legend': {
              maxWidth: '0.01px !important',
            },

            '&.Mui-focused .MuiSelect-iconOutlined': {
              color: theme.palette.primary.main,
            },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            background: theme.palette.background.paper,
            borderRadius: 0,
            boxShadow: 'none',
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden',
          },
        },
      },

      MuiCheckbox: {
        defaultProps: { size: 'small', disableRipple: true },
        styleOverrides: {
          root: {
            'padding': 6,
            'borderRadius': 0,
            'color': isDark ? 'rgba(255, 255, 255, 0.32)' : 'rgba(9, 9, 11, 0.38)',
            '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: theme.palette.primary.main },
          },
        },
      },

      MuiSelect: {
        defaultProps: {
          size: 'medium',
          IconComponent: SelectChevron,
        },
        styleOverrides: {
          select: {
            minHeight: 0,
          },
        },
      },

      MuiMenuItem: {
        defaultProps: {
          disableRipple: true,
        },
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              background: `${menuItemSelected}!important`,
            },
            'fontSize': 13,
            'minHeight': 34,
            '&[role="option"]': {
              paddingTop: 7,
              paddingBottom: 7,
              paddingLeft: 12,
              paddingRight: 12,
            },
          },
        },
      },

      // dropdown panels: square, bordered, capped so long lists scroll instead of filling the screen
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            maxHeight: 'min(360px, 60vh)',
          },
        },
      },

      // square toggles that match the rest of the UI
      MuiSwitch: {
        styleOverrides: {
          root: { width: 36, height: 20, padding: 0, overflow: 'visible' },
          switchBase: {
            'padding': 2,
            'color': isDark ? '#d4d4d8' : '#ffffff',
            '&.Mui-checked': {
              'transform': 'translateX(16px)',
              'color': isDark ? '#041318' : '#ffffff',
              '& + .MuiSwitch-track': { backgroundColor: theme.palette.primary.main, opacity: 1 },
            },
          },
          thumb: { width: 16, height: 16, borderRadius: 0, boxShadow: 'none' },
          track: {
            borderRadius: 0,
            opacity: 1,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(9, 9, 11, 0.28)',
          },
        },
      },

      MuiFormControlLabel: {
        styleOverrides: {
          root: { marginLeft: 0, marginRight: 24, gap: 8 },
          label: { fontSize: 13 },
        },
      },

      MuiLink: {
        styleOverrides: {
          root: {
            '&, *': {
              color: `${theme.palette.secondary.main}!important`,
            },
            '&:hover': {
              textDecoration: 'underline',
            },
          },
        },
      },

      MuiTable: {
        defaultProps: {
          size: 'medium',
        },
        styleOverrides: {
          root: {
            'borderColor': theme.palette.divider,

            'th': {
              textTransform: 'none',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              color: theme.palette.text.secondary,
              backgroundColor: 'transparent !important',
              borderBottom: `1px solid ${theme.palette.divider}`,
            },

            'th, td': {
              border: 'none',
              borderBottom: `1px solid ${theme.palette.divider}`,
              padding: '14px 16px',
            },

            'tbody tr:last-of-type td': {
              borderBottom: 'none',
            },

            'tbody tr:nth-of-type(even)': {
              backgroundColor: 'transparent',
            },

            'tr.MuiTableRow-hover:hover': {
              backgroundColor: `${tableHover}!important`,
            },
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            'borderRadius': 0,
            '&.isImage': {
              background: tooltipImageBackground,
              border: tooltipImageBorder,
              textAlign: 'center',
            },
          },
        },
      },

      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: '0 24px',
          },
        },
      },

      MuiDialogActions: {
        styleOverrides: {
          root: {
            'display': 'flex',
            'justifyContent': 'space-between',
            'padding': '30px 24px 20px',

            '&:not(.custom)': {
              '.MuiButton-root': {
                '&.MuiButton-containedPrimary': {
                  color: isDark ? theme.palette.text.primary : '#ffffff',
                },

                '&:first-of-type': {
                  'background': 'none',
                  'border': `1px solid ${theme.palette.primary.light}`,
                  'color': theme.palette.primary.main,

                  '&:hover': {
                    background: dialogSecondaryHover,
                    border: `1px solid ${theme.palette.primary.main}`,
                  },
                },

                '.MuiButton-icon': {
                  display: 'none',
                },
              },
            },
          },
        },
      },
    },
  } as Record<string, unknown>);

  return responsiveFontSizes(theme);
};

const customTheme = createCustomTheme('light');

export { createCustomTheme, customTheme };
export default createCustomTheme;
