// Default settings
const DEFAULT_SETTINGS = {
  enablePreviews: true,
  previewDelay: 300,
  showImages: true,
  securityCheck: true
};

// DOM elements
const elements = {
  enablePreviews: document.getElementById('enablePreviews'),
  previewDelay: document.getElementById('previewDelay'),
  showImages: document.getElementById('showImages'),
  securityCheck: document.getElementById('securityCheck')
};

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  updateUI(settings);
  attachEventListeners();
});

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...result.settings };
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// Save settings to storage
async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set({ settings });
    // Notify content script of settings change
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SETTINGS_UPDATED',
        settings
      });
    }
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Update UI with current settings
function updateUI(settings) {
  elements.enablePreviews.checked = settings.enablePreviews;
  elements.previewDelay.value = settings.previewDelay;
  elements.showImages.checked = settings.showImages;
  elements.securityCheck.checked = settings.securityCheck;
}

// Attach event listeners to form elements
function attachEventListeners() {
  // Handle checkbox changes
  ['enablePreviews', 'showImages', 'securityCheck'].forEach(id => {
    elements[id].addEventListener('change', async (e) => {
      const settings = await loadSettings();
      settings[id] = e.target.checked;
      await saveSettings(settings);
    });
  });

  // Handle preview delay input
  elements.previewDelay.addEventListener('change', async (e) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 0) {
      e.target.value = DEFAULT_SETTINGS.previewDelay;
      return;
    }

    const settings = await loadSettings();
    settings.previewDelay = value;
    await saveSettings(settings);
  });
} 