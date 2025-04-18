/**
 * Theme Manager for DEx: Deluge Extensions
 * Handles theme detection, switching, and persistence
 */

// Theme storage key for localStorage
const THEME_STORAGE_KEY = 'dex-theme';

// Available themes
const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// ThemeManager module
const ThemeManager = {
  // Current active theme
  currentTheme: THEME.SYSTEM,
  
  // System preference media query
  systemPrefersDark: window.matchMedia('(prefers-color-scheme: dark)'),
  
  /**
   * Initialize the theme manager
   * Detects saved preferences or system settings
   */
  initialize() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    
    if (savedTheme === THEME.LIGHT || savedTheme === THEME.DARK) {
      this.currentTheme = savedTheme;
      this.applyTheme(savedTheme);
    } else {
      // Default to system preference
      this.currentTheme = THEME.SYSTEM;
      this.applySystemTheme();
      
      // Listen for system theme changes
      this.setupSystemListener();
    }
    
    // Initialize UI controls
    this.initializeUI();
  },
  
  /**
   * Apply the specified theme
   * @param {string} theme - The theme to apply ('light' or 'dark')
   */
  applyTheme(theme) {
    if (theme === THEME.DARK) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  },
  
  /**
   * Apply theme based on system preference
   */
  applySystemTheme() {
    const isDarkMode = this.systemPrefersDark.matches;
    this.applyTheme(isDarkMode ? THEME.DARK : THEME.LIGHT);
  },
  
  /**
   * Set up the system theme change listener
   */
  setupSystemListener() {
    this.systemPrefersDark.addEventListener('change', (e) => {
      if (this.currentTheme === THEME.SYSTEM) {
        this.applySystemTheme();
      }
    });
  },
  
  /**
   * Set the theme and persist the choice
   * @param {string} theme - The theme to set
   */
  setTheme(theme) {
    this.currentTheme = theme;
    
    if (theme === THEME.SYSTEM) {
      // For system theme, remove the stored preference and use system preference
      localStorage.removeItem(THEME_STORAGE_KEY);
      this.applySystemTheme();
    } else {
      // For explicit themes, store the preference and apply it
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      this.applyTheme(theme);
    }
    
    // Update the UI controls
    this.updateUI();
  },
  
  /**
   * Initialize the theme selection UI
   */
  initializeUI() {
    // Find all theme radio inputs
    const radioInputs = document.querySelectorAll('input[name="theme-select"]');
    
    // Add change event listeners
    radioInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.setTheme(e.target.value);
        }
      });
    });
    
    // Set the initial state for UI controls
    this.updateUI();
  },
  
  /**
   * Update the UI controls to match the current theme
   */
  updateUI() {
    const selectedInput = document.querySelector(`input[name="theme-select"][value="${this.currentTheme}"]`);
    if (selectedInput) {
      selectedInput.checked = true;
    }
  }
};

// Initialize theme when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.initialize();
}); 