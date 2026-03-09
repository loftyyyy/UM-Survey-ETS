// =============================================
// UM Survey Auto-Fill - Background Service Worker
// Handles auto-opening the side panel on survey pages.
// =============================================

const SURVEY_URL_PATTERNS = [
  'https://mis.umin.edu.ph/oPEAS/ets/ug/*/*/*',
  'https://mis.umin.edu.ph/oPEAS/ca/ug/*/*/*'
];

/**
 * Check if a URL matches a survey page.
 */
function isSurveyPage(url) {
  if (!url) return false;
  return (
    /^https:\/\/mis\.umin\.edu\.ph\/oPEAS\/ets\/ug\//.test(url) ||
    /^https:\/\/mis\.umin\.edu\.ph\/oPEAS\/ca\/ug\//.test(url)
  );
}

// --- Enable side panel open on action click (toolbar icon) ---
// When the user clicks the extension icon, open the side panel instead of the popup.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('Failed to set panel behavior:', err));

// --- Auto-open side panel when navigating to a survey page ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when navigation completes
  if (changeInfo.status !== 'complete') return;

  if (isSurveyPage(tab.url)) {
    try {
      // Enable the side panel for this tab
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel/sidepanel.html',
        enabled: true
      });

      // Auto-open the side panel
      await chrome.sidePanel.open({ tabId: tabId });
    } catch (err) {
      console.error('Failed to open side panel:', err);
    }
  }
});

// --- Also check when switching tabs ---
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (isSurveyPage(tab.url)) {
      await chrome.sidePanel.setOptions({
        tabId: activeInfo.tabId,
        path: 'sidepanel/sidepanel.html',
        enabled: true
      });
    }
  } catch (err) {
    // Tab may not exist or URL not accessible
  }
});
