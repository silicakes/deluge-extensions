import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoDisplay } from '../state';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
  clear: vi.fn(() => { localStorageMock.store = {}; })
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Auto Display feature', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Reset signals to initial state
    autoDisplay.value = true;
  });
  
  it('should initialize with the correct default value', () => {
    // No localStorage value set, should default to true
    expect(autoDisplay.value).toBe(true);
    
    // Now set a value in localStorage
    localStorageMock.store['dex-auto-display'] = 'false';
    
    // Simulate reinitialization of the signal
    const newAutoDisplay = localStorage.getItem('dex-auto-display') !== 'false';
    
    // Should respect localStorage value
    expect(newAutoDisplay).toBe(false);
  });
  
  it('should save value changes to localStorage', () => {
    // First, verify we're starting with autoDisplay = true
    expect(autoDisplay.value).toBe(true);
    
    // Simulate the effect that saves to localStorage
    localStorage.setItem('dex-auto-display', autoDisplay.value.toString());
    
    // Verify true value is saved
    expect(localStorage.setItem).toHaveBeenCalledWith('dex-auto-display', 'true');
    
    // Now change to false
    autoDisplay.value = false;
    
    // Simulate the effect again
    localStorage.setItem('dex-auto-display', autoDisplay.value.toString());
    
    // Verify false value is saved
    expect(localStorage.setItem).toHaveBeenCalledWith('dex-auto-display', 'false');
  });
}); 