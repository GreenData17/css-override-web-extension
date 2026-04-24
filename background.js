const debug = (msg) => {
  console.log(`css-override-web-extension: ${msg}`); // eslint-disable-line
};

const getStorageData = (domainKey) => browser.storage.sync.get(domainKey);

const getTabUrl = (tab) => {
  try {
    return new URL(tab.url).hostname;
  } catch {
    return null;
  }
};

// insertCSS does not exist in V3, injecting style element instead.
const STYLE_ELEMENT_ID = 'css-override-injected-style';

const toggleCSS = async (tabId, enabled, style) => {
  try {
    if (enabled) {
      await browser.scripting.executeScript({
        target: { tabId },
        func: (css, elementId) => {
          let el = document.getElementById(elementId);
          if (!el) {
            el = document.createElement('style');
            el.id = elementId;
            document.head.appendChild(el);
          }
          el.textContent = css;
        },
        args: [style, STYLE_ELEMENT_ID],
      });
    } else {
      await browser.scripting.executeScript({
        target: { tabId },
        func: (elementId) => {
          const el = document.getElementById(elementId);
          if (el) el.remove();
        },
        args: [STYLE_ELEMENT_ID],
      });
    }
  } catch (err) {
    debug(`toggleCSS error on tab ${tabId}: ${err.message}`);
  }
};

const setTabStyle = (id, url) => {
  if (!url) return;
  getStorageData(url).then((tabData) => {
    debug(JSON.stringify(tabData));
    if (tabData[url]) {
      const { enabled, style } = tabData[url];
      toggleCSS(id, enabled, style);
    }
  });
};

const initializeTabStyles = () => {
  browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      const tabUrl = getTabUrl(tab);
      if (tabUrl) setTabStyle(tab.id, tabUrl);
    }
  });
};

const reloadTab = (tab) => {
  debug('Reloading tab');
  setTabStyle(tab.id, tab.url);
};

const tabStyleChanged = (urlToUpdate) => {
  browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      const tabUrl = getTabUrl(tab);
      if (tabUrl === urlToUpdate) {
        browser.tabs.reload(tab.id);
      }
    }
  });
};

const eventListener = (request, sender, sendResponse) => {
  debug(`Event listener action ${request.action}`);
  if (request.action === 'reloadTab') {
    reloadTab(request.tab);
    sendResponse({ response: true });
  } else if (request.action === 'updateStyle') {
    tabStyleChanged(request.tabUrl);
  }
};

const initializeExtension = () => {
  debug('Initializing extension');
  initializeTabStyles();

  browser.runtime.onMessage.addListener(eventListener);
  browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      reloadTab({ id, url: getTabUrl(tab) });
    }
  });
};

initializeExtension();
