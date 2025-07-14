class QuickPath {
  constructor() {
    this.currentTab = null;
    this.savedPaths = [];
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
    const result = await chrome.storage.sync.get(['quickpaths']);
    this.savedPaths = result.quickpaths || [];
  }

  async savePaths() {
    await chrome.storage.sync.set({ quickpaths: this.savedPaths });
  }

  setupEventListeners() {
    document.getElementById('savePath').addEventListener('click', () => {
      this.saveCurrentPath();
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

    // Add event delegation for path list buttons
    document.getElementById('pathsList').addEventListener('click', (e) => {
      const pathItem = e.target.closest('.path-item');
      if (!pathItem) return;

      const pathId = parseInt(pathItem.dataset.pathId);
      const pathData = this.savedPaths.find(p => p.id === pathId);

      if (e.target.classList.contains('navigate-btn')) {
        this.navigateToPath(pathData);
      } else if (e.target.classList.contains('delete-btn')) {
        this.deletePath(pathId);
      }
    });
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

  async saveCurrentPath() {
    const path = this.getCurrentPath();
    const domain = this.getCurrentDomain();
    
    if (!path || path === '/') {
      this.showNotification('Cannot save root path', 'error');
      return;
    }

    const existingIndex = this.savedPaths.findIndex(p => p.path === path);
    
    const pathData = {
      id: existingIndex >= 0 ? this.savedPaths[existingIndex].id : Date.now(),
      path: path,
      name: this.generatePathName(path),
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

  generatePathName(path) {
    const segments = path.split('/').filter(s => s);
    if (segments.length === 0) return 'Root';
    
    const lastSegment = segments[segments.length - 1];
    const cleanSegment = lastSegment.split('?')[0].split('#')[0];
    
    return cleanSegment || segments[segments.length - 2] || 'Path';
  }

  async navigateToPath(pathData) {
    console.log('Navigating to path:', pathData);
    const currentDomain = this.getCurrentDomain();
    const protocol = this.currentTab.url.split('://')[0];
    const newUrl = `${protocol}://${currentDomain}${pathData.path}`;
    
    pathData.lastUsed = new Date().toISOString();
    await this.savePaths();
    
    await chrome.tabs.update(this.currentTab.id, { url: newUrl });
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
    link.download = 'quickpath-export.json';
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
    document.getElementById('currentPath').textContent = this.getCurrentPath();
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

    pathsList.innerHTML = sortedPaths.map(path => `
      <div class="path-item" data-path-id="${path.id}">
        <div class="path-info">
          <div class="path-name">${this.escapeHtml(path.name)}</div>
          <div class="path-url">${this.escapeHtml(path.path)}</div>
        </div>
        <div class="path-actions">
          <button class="btn-icon navigate-btn" title="Navigate to path">→</button>
          <button class="btn-icon delete-btn" title="Delete path">×</button>
        </div>
      </div>
    `).join('');
  }

  escapeHtml(text) {
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
  window.quickPath = new QuickPath();
});