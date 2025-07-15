class SwiftPath {
  constructor() {
    this.currentTab = null;
    this.savedPaths = [];
    this.currentEditingPathId = null;
    this.init();
  }

  async init() {
    await this.getCurrentTab();
    await this.loadSavedPaths();
    this.setupEventListeners();
    this.updateUI();
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;
  }

  async loadSavedPaths() {
    const result = await chrome.storage.sync.get(['swiftpaths']);
    this.savedPaths = result.swiftpaths || [];
  }

  async savePaths() {
    await chrome.storage.sync.set({ swiftpaths: this.savedPaths });
  }

  setupEventListeners() {
    document.getElementById('savePath').addEventListener('click', () => {
      this.saveCurrentPath();
    });

    // Save on Enter key in name input
    document.getElementById('pathName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveCurrentPath();
      }
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filterPaths(e.target.value);
    });

    document.getElementById('clearAll').addEventListener('click', () => {
      this.clearAllPaths();
    });

    document.getElementById('exportPaths').addEventListener('click', () => {
      this.exportPaths();
    });

    document.getElementById('importPaths').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
      this.importPaths(e.target.files[0]);
    });

    // Event delegation for dynamically created path list items
    document.getElementById('pathsList').addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const pathItem = button.closest('.path-item');
      if (!pathItem) return;

      const pathId = parseInt(pathItem.dataset.pathId);
      
      if (button.classList.contains('navigate-btn')) {
        const pathData = this.savedPaths.find(p => p.id === pathId);
        if (pathData) {
          this.navigateToPath(pathData, false);
        }
      } else if (button.classList.contains('new-tab-btn')) {
        const pathData = this.savedPaths.find(p => p.id === pathId);
        if (pathData) {
          this.navigateToPath(pathData, true);
        }
      } else if (button.classList.contains('edit-btn')) {
        this.showEditNameModal(pathId);
      } else if (button.classList.contains('delete-btn')) {
        this.deletePath(pathId);
      }
    });

    // Handle double-click on path name to edit
    document.getElementById('pathsList').addEventListener('dblclick', (e) => {
      const pathName = e.target.closest('.path-name');
      if (pathName) {
        const pathItem = pathName.closest('.path-item');
        const pathId = parseInt(pathItem.dataset.pathId);
        this.showEditNameModal(pathId);
      }
    });

    // Edit name modal event listeners
    document.getElementById('cancelEditName').addEventListener('click', () => {
      this.hideEditNameModal();
    });

    document.getElementById('saveEditName').addEventListener('click', () => {
      this.saveEditedName();
    });

    // Close modal on overlay click
    document.getElementById('editNameModal').addEventListener('click', (e) => {
      if (e.target.id === 'editNameModal') {
        this.hideEditNameModal();
      }
    });

    // Handle Enter key in edit name input
    document.getElementById('editNameInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveEditedName();
      } else if (e.key === 'Escape') {
        this.hideEditNameModal();
      }
    });

    // Listen for tab updates to refresh the UI
    if (chrome.tabs && chrome.tabs.onUpdated) {
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab.active && changeInfo.url) {
          this.refreshCurrentTab();
        }
      });
    }
  }

  async refreshCurrentTab() {
    await this.getCurrentTab();
    this.updateUI();
  }

  getCurrentPath() {
    if (!this.currentTab?.url) return '/';
    
    try {
      const url = new URL(this.currentTab.url);
      return url.pathname + url.search + url.hash;
    } catch {
      return '/';
    }
  }

  getCurrentDomain() {
    if (!this.currentTab?.url) return '';
    
    try {
      const url = new URL(this.currentTab.url);
      return url.hostname;
    } catch {
      return '';
    }
  }

  updateNameInput() {
    const nameInput = document.getElementById('pathName');
    const path = this.getCurrentPath();
    
    if (!path || path === '/') {
      nameInput.value = '';
      nameInput.placeholder = 'Cannot save root path';
      nameInput.disabled = true;
      return;
    }

    nameInput.disabled = false;
    
    // Check if this path already exists
    const existingPath = this.savedPaths.find(p => p.path === path);
    
    if (existingPath) {
      // Path exists, populate with existing name
      nameInput.value = existingPath.name;
      nameInput.placeholder = 'Update existing path';
    } else {
      // New path, generate suggested name
      const suggestedName = this.generatePathName(path);
      nameInput.value = suggestedName;
      nameInput.placeholder = 'Enter a name for this path';
    }
    
    // Select the text for easy editing
    nameInput.select();
  }

  async saveCurrentPath() {
    const path = this.getCurrentPath();
    const nameInput = document.getElementById('pathName');
    const customName = nameInput.value.trim();
    
    if (!path || path === '/') {
      this.showNotification('Cannot save root path', 'error');
      return;
    }

    if (!customName) {
      this.showNotification('Please enter a name for this path', 'error');
      nameInput.focus();
      return;
    }

    const domain = this.getCurrentDomain();
    const existingIndex = this.savedPaths.findIndex(p => p.path === path);
    
    // Check if name already exists (excluding current path if updating)
    const nameExists = this.savedPaths.some(p => 
      p.name === customName && p.path !== path
    );

    if (nameExists) {
      const confirmed = confirm(`A path with the name "${customName}" already exists. Do you want to replace it?`);
      if (!confirmed) {
        nameInput.focus();
        nameInput.select();
        return;
      }
      
      // Remove the existing path with the same name
      this.savedPaths = this.savedPaths.filter(p => p.name !== customName);
    }
    
    const pathData = {
      id: existingIndex >= 0 ? this.savedPaths[existingIndex].id : Date.now(),
      path: path,
      name: customName,
      savedFrom: domain,
      createdAt: existingIndex >= 0 ? this.savedPaths[existingIndex].createdAt : new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.savedPaths[existingIndex] = pathData;
      this.showNotification('Path updated!');
    } else {
      this.savedPaths.unshift(pathData);
      this.showNotification('Path saved!');
    }

    await this.savePaths();
    this.updateUI();
  }

  showEditNameModal(pathId) {
    const pathData = this.savedPaths.find(p => p.id === pathId);
    if (!pathData) return;

    this.currentEditingPathId = pathId;
    
    // Populate modal fields
    document.getElementById('editNameInput').value = pathData.name || '';
    document.getElementById('editPathUrl').textContent = pathData.path;
    
    // Clear any previous error
    this.hideEditNameError();
    
    // Show modal
    document.getElementById('editNameModal').style.display = 'flex';
    
    // Focus and select the input
    setTimeout(() => {
      const input = document.getElementById('editNameInput');
      input.focus();
      input.select();
    }, 100);
  }

  hideEditNameModal() {
    document.getElementById('editNameModal').style.display = 'none';
    this.currentEditingPathId = null;
    this.hideEditNameError();
  }

  showEditNameError(message) {
    const errorElement = document.getElementById('editNameError');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }

  hideEditNameError() {
    const errorElement = document.getElementById('editNameError');
    errorElement.style.display = 'none';
  }

  async saveEditedName() {
    if (!this.currentEditingPathId) return;

    const pathData = this.savedPaths.find(p => p.id === this.currentEditingPathId);
    if (!pathData) return;

    const newName = document.getElementById('editNameInput').value.trim();
    
    if (!newName) {
      this.showEditNameError('Please enter a name for this path');
      document.getElementById('editNameInput').focus();
      return;
    }

    if (newName === pathData.name) {
      this.hideEditNameModal();
      return;
    }

    // Check if new name already exists
    const nameExists = this.savedPaths.some(p => p.name === newName && p.id !== this.currentEditingPathId);
    if (nameExists) {
      const confirmed = confirm(`A path with the name "${newName}" already exists. Do you want to replace it?`);
      if (!confirmed) {
        document.getElementById('editNameInput').focus();
        document.getElementById('editNameInput').select();
        return;
      }
      
      // Remove the existing path with the same name
      this.savedPaths = this.savedPaths.filter(p => p.name !== newName);
    }

    pathData.name = newName;
    await this.savePaths();
    this.updateUI();
    this.hideEditNameModal();
    this.showNotification('Name updated!');
  }

  generatePathName(path) {
    const segments = path.split('/').filter(s => s);
    if (segments.length === 0) return 'Root';
    
    const lastSegment = segments[segments.length - 1];
    const cleanSegment = lastSegment.split('?')[0].split('#')[0];
    
    // Decode URL encoding (%20, +, etc.) and other HTML entities
    let decodedName = cleanSegment || segments[segments.length - 2] || 'Path';
    
    try {
      // First decode URI components (%20 -> space, %21 -> !, etc.)
      decodedName = decodeURIComponent(decodedName);
      
      // Handle + signs (commonly used for spaces in query parameters)
      decodedName = decodedName.replace(/\+/g, ' ');
      
      // Handle common HTML entities
      const htmlEntities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' '
      };
      
      for (const [entity, char] of Object.entries(htmlEntities)) {
        decodedName = decodedName.replace(new RegExp(entity, 'gi'), char);
      }
      
      // Clean up multiple spaces and trim
      decodedName = decodedName.replace(/\s+/g, ' ').trim();
      
      // If after decoding we get an empty string, fallback
      if (!decodedName) {
        decodedName = segments[segments.length - 2] || 'Path';
      }
      
    } catch (error) {
      // If decoding fails, use the original segment
      console.warn('Failed to decode path segment:', error);
      decodedName = cleanSegment || segments[segments.length - 2] || 'Path';
    }
    
    return decodedName;
  }

  async navigateToPath(pathData, openInNewTab = false) {
    console.log('Navigating to path:', pathData, 'New tab:', openInNewTab);
    const currentDomain = this.getCurrentDomain();
    const protocol = this.currentTab.url.split('://')[0];
    const newUrl = `${protocol}://${currentDomain}${pathData.path}`;
    
    pathData.lastUsed = new Date().toISOString();
    await this.savePaths();
    
    if (openInNewTab) {
      await chrome.tabs.create({ url: newUrl });
    } else {
      await chrome.tabs.update(this.currentTab.id, { url: newUrl });
    }
    
    window.close();
  }

  deletePath(pathId) {
    this.savedPaths = this.savedPaths.filter(p => p.id !== pathId);
    this.savePaths();
    this.updateUI();
    this.showNotification('Path deleted');
  }

  async clearAllPaths() {
    if (confirm('Are you sure you want to delete all saved paths?')) {
      this.savedPaths = [];
      await this.savePaths();
      this.updateUI();
      this.showNotification('All paths cleared');
    }
  }

  exportPaths() {
    const dataStr = JSON.stringify(this.savedPaths, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'swiftpath-export.json';
    link.click();
    
    this.showNotification('Paths exported!');
  }

  async importPaths(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedPaths = JSON.parse(text);
      
      if (!Array.isArray(importedPaths)) {
        throw new Error('Invalid file format');
      }
      
      const existingPaths = new Set(this.savedPaths.map(p => p.path));
      const newPaths = importedPaths.filter(p => !existingPaths.has(p.path));
      
      this.savedPaths = [...this.savedPaths, ...newPaths];
      await this.savePaths();
      this.updateUI();
      
      this.showNotification(`Imported ${newPaths.length} new paths`);
    } catch (error) {
      this.showNotification('Import failed: Invalid file', 'error');
    }
  }

  filterPaths(query) {
    const pathItems = document.querySelectorAll('.path-item');
    const lowerQuery = query.toLowerCase();
    
    pathItems.forEach(item => {
      const name = item.querySelector('.path-name').textContent.toLowerCase();
      const path = item.querySelector('.path-url').textContent.toLowerCase();
      
      if (name.includes(lowerQuery) || path.includes(lowerQuery)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

      updateUI() {
      const currentPath = this.getCurrentPath();
      const currentPathElement = document.getElementById('currentPath');
    
      // Display current path or placeholder text
      if (!currentPath || currentPath === '/') {
        currentPathElement.textContent = 'Root path (cannot be saved)';
        currentPathElement.style.opacity = '0.6';
        currentPathElement.style.fontStyle = 'italic';
      } else {
        currentPathElement.textContent = currentPath;
        currentPathElement.style.opacity = '1';
        currentPathElement.style.fontStyle = 'normal';
      }
    
      // Update the name input with auto-populated value
      this.updateNameInput();
    
      // Update save button state
      const saveButton = document.getElementById('savePath');
      const nameInput = document.getElementById('pathName');
    
      if (!currentPath || currentPath === '/') {
        saveButton.disabled = true;
        saveButton.textContent = 'Cannot Save Root Path';
      } else {
        saveButton.disabled = false;
        const existingPath = this.savedPaths.find(p => p.path === currentPath);
        saveButton.textContent = existingPath ? 'Update Path' : 'Save Path';
      }
    
      this.renderPathsList();
    }

  renderPathsList() {
    const pathsList = document.getElementById('pathsList');
    
    if (this.savedPaths.length === 0) {
      pathsList.innerHTML = `
        <div class="empty-state">
          <p>No saved paths yet</p>
          <p class="hint">Save the current path to get started</p>
        </div>
      `;
      return;
    }

    const sortedPaths = [...this.savedPaths].sort((a, b) => 
      new Date(b.lastUsed) - new Date(a.lastUsed)
    );

    const currentPath = this.getCurrentPath();

    pathsList.innerHTML = sortedPaths.map(path => `
      <div class="path-item ${path.path === currentPath ? 'current-path-item' : ''}" data-path-id="${path.id}">
        <div class="path-info">
          <div class="path-name" title="Double-click to edit">${this.escapeHtml(path.name || 'Unnamed')}</div>
          <div class="path-url">${this.escapeHtml(path.path)}</div>
        </div>
        <div class="path-actions">
          <button class="btn-icon navigate-btn" title="Navigate to path (same tab)">→</button>
          <button class="btn-icon new-tab-btn" title="Open in new tab">⧉</button>
          <button class="btn-icon delete-btn" title="Delete path">×</button>
        </div>
      </div>
    `).join('');
  }
    //<button class="btn-icon edit-btn" title="Edit name">✏</button>

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.swiftPath = new SwiftPath();
});
