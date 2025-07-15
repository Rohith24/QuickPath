class SwiftPathContent {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
    });
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'getCurrentPath':
        sendResponse({
          path: window.location.pathname + window.location.search + window.location.hash,
          domain: window.location.hostname,
          title: document.title
        });
        break;
        
      case 'navigateToPath':
        window.location.href = request.path;
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }
}

new SwiftPathContent();