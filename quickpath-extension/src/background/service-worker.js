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

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
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

  async handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'quickSave':
        const result = await this.quickSavePath(request.customName);
        sendResponse(result);
        break;
      
      case 'checkNameExists':
        const exists = await this.checkNameExists(request.name, request.excludeId);
        sendResponse({ exists });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
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

  async quickSavePath(customName = null) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { success: false, error: 'No active tab' };

      const url = new URL(tab.url);
      const path = url.pathname + url.search + url.hash;
      
      if (path === '/') return { success: false, error: 'Cannot save root path' };

      const result = await chrome.storage.sync.get(['quickpaths']);
      const savedPaths = result.quickpaths || [];

      const existingIndex = savedPaths.findIndex(p => p.path === path);
      const generatedName = this.generatePathName(path);
      const finalName = customName || generatedName;
      
      // Check if name already exists (excluding current path if updating)
      const nameExists = savedPaths.some(p => 
        p.name === finalName && p.id !== (existingIndex >= 0 ? savedPaths[existingIndex].id : null)
      );

      if (nameExists && !customName) {
        return { 
          success: false, 
          error: 'name_conflict',
          suggestedName: finalName,
          existingPath: existingIndex >= 0
        };
      }
      
      const pathData = {
        id: existingIndex >= 0 ? savedPaths[existingIndex].id : Date.now(),
        path: path,
        name: finalName,
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
      
      return { 
        success: true, 
        updated: existingIndex >= 0,
        name: finalName
      };
      
    } catch (error) {
      console.error('Error saving path:', error);
      return { success: false, error: error.message };
    }
  }

  async checkNameExists(name, excludeId = null) {
    try {
      const result = await chrome.storage.sync.get(['quickpaths']);
      const savedPaths = result.quickpaths || [];
      
      return savedPaths.some(p => p.name === name && p.id !== excludeId);
    } catch (error) {
      console.error('Error checking name:', error);
      return false;
    }
  }

  generatePathName(path) {
    const segments = path.split('/').filter(s => s);
    if (segments.length === 0) return 'Root';
    
    const lastSegment = segments[segments.length - 1];
    const cleanSegment = lastSegment.split('?')[0].split('#')[0];
    
    return cleanSegment || segments[segments.length - 2] || 'Path';
  }

  generateUniqueName(baseName, existingNames) {
    if (!existingNames.includes(baseName)) {
      return baseName;
    }
    
    let counter = 1;
    let newName = `${baseName} (${counter})`;
    
    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName} (${counter})`;
    }
    
    return newName;
  }
}

new QuickPathBackground();