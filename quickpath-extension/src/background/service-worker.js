class QuickPathBackground {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details);
    });

    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });
  }

  handleInstall(details) {
    if (details.reason === 'install') {
      console.log('QuickPath installed');
      
      chrome.storage.sync.set({
        quickpaths: [],
        settings: {
          showNotifications: true,
          autoSuggest: true,
          keyboardShortcuts: true
        }
      });
    } else if (details.reason === 'update') {
      console.log('QuickPath updated to version', chrome.runtime.getManifest().version);
    }
  }

  async handleCommand(command) {
    switch (command) {
      case '_execute_action':
        break;
      
      case 'quick_save':
        await this.quickSavePath();
        break;
        
      default:
        console.log('Unknown command:', command);
    }
  }

  async quickSavePath() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const url = new URL(tab.url);
      const path = url.pathname + url.search + url.hash;
      
      if (path === '/') return;

      const result = await chrome.storage.sync.get(['quickpaths']);
      const savedPaths = result.quickpaths || [];

      const existingIndex = savedPaths.findIndex(p => p.path === path);
      
      const pathData = {
        id: existingIndex >= 0 ? savedPaths[existingIndex].id : Date.now(),
        path: path,
        name: this.generatePathName(path),
        savedFrom: url.hostname,
        createdAt: existingIndex >= 0 ? savedPaths[existingIndex].createdAt : new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        savedPaths[existingIndex] = pathData;
      } else {
        savedPaths.unshift(pathData);
      }

      await chrome.storage.sync.set({ quickpaths: savedPaths });
      
    } catch (error) {
      console.error('Error saving path:', error);
    }
  }

  generatePathName(path) {
    const segments = path.split('/').filter(s => s);
    if (segments.length === 0) return 'Root';
    
    const lastSegment = segments[segments.length - 1];
    const cleanSegment = lastSegment.split('?')[0].split('#')[0];
    
    return cleanSegment || segments[segments.length - 2] || 'Path';
  }
}

new QuickPathBackground();