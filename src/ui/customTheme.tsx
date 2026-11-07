import React from 'react';
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

            /* Save / Delete stay reachable at the bottom of the sheet */
            .RaToolbar-desktopToolbar,
            .RaToolbar-mobileToolbar,
            .MuiToolbar-root.RaToolbar-desktopToolbar {
              position: sticky;
              bottom: 0;
              z-index: 2;
              display: flex;
              gap: 12px;
              justify-content: flex-start !important;
              padding: 14px 24px !important;
              margin: 24px -24px -24px !important;
              min-height: 0 !important;
              background: ${theme.palette.background.paper} !important;
              border-top: 1px solid ${theme.palette.divider};
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

          .RaList-noResults {
            display: flex;
            flex-direction: column;
            justify-content: center;
            height: 100vh;
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
            fontSize: 13,
            color: theme.palette.text.primary,
            marginBottom: 6,
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
            borderColor: theme.palette.text.disabled,
          },
          root: {
            'borderRadius': 0,
            'height': 40,
            'fontSize': 14,
            'lineHeight': 1,
            'background': theme.palette.background.paper,

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

      MuiSelect: {
        defaultProps: {
          size: 'medium',
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
            '&[role="option"]': {
              paddingTop: 12,
              paddingBottom: 12,
            },
          },
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
              textTransform: 'uppercase',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: theme.palette.text.secondary,
              backgroundColor: `${cardHeaderBackground}!important`,
            },

            'th, td': {
              border: 'none',
              borderBottom: `1px solid ${theme.palette.divider}`,
              padding: '10px 16px',
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
