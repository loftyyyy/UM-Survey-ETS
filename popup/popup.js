// =============================================
// UM Survey Auto-Fill - Popup Script
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
  // --- Element references ---
  const ratingButtons = document.querySelectorAll('.rating-btn');
  const commentToggle = document.getElementById('comment-toggle');
  const commentSection = document.getElementById('comment-section');
  const commentInput = document.getElementById('comment-input');
  const submitToggle = document.getElementById('submit-toggle');
  const fillBtn = document.getElementById('fill-btn');
  const fillBtnText = document.getElementById('fill-btn-text');
  const fillBtnLoader = document.getElementById('fill-btn-loader');
  const statusBanner = document.getElementById('status-banner');
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const pageDot = document.getElementById('page-dot');
  const pageStatusText = document.getElementById('page-status-text');

  let selectedRating = null;
  let isOnSurveyPage = false;

  // --- Load saved preferences from storage ---
  try {
    const saved = await chrome.storage.local.get([
      'rating',
      'commentEnabled',
      'comment',
      'autoSubmit'
    ]);

    if (saved.rating) {
      selectedRating = saved.rating;
      ratingButtons.forEach((btn) => {
        if (btn.dataset.value === saved.rating) {
          btn.classList.add('selected');
        }
      });
    }

    if (saved.commentEnabled) {
      commentToggle.checked = true;
      commentSection.classList.remove('hidden');
    }

    if (saved.comment) {
      commentInput.value = saved.comment;
    }

    if (saved.autoSubmit) {
      submitToggle.checked = true;
    }
  } catch (e) {
    // Storage not available, continue with defaults
  }

  // --- Check if current tab is on a survey page ---
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = tab.url;
      const isEts = url.match(/https:\/\/mis\.umin\.edu\.ph\/oPEAS\/ets\/ug\/.*/);
      const isCa = url.match(/https:\/\/mis\.umin\.edu\.ph\/oPEAS\/ca\/ug\/.*/);

      if (isEts || isCa) {
        isOnSurveyPage = true;
        pageDot.classList.add('active');
        pageStatusText.textContent = 'Survey page detected';
      } else {
        pageDot.classList.add('inactive');
        pageStatusText.textContent = 'Not on a survey page';
      }
    } else {
      pageDot.classList.add('inactive');
      pageStatusText.textContent = 'Cannot access this page';
    }
  } catch (e) {
    pageDot.classList.add('inactive');
    pageStatusText.textContent = 'Cannot access this page';
  }

  updateFillButton();

  // --- Rating button click handlers ---
  ratingButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      ratingButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedRating = btn.dataset.value;
      savePreferences();
      updateFillButton();
    });
  });

  // --- Comment toggle ---
  commentToggle.addEventListener('change', () => {
    if (commentToggle.checked) {
      commentSection.classList.remove('hidden');
    } else {
      commentSection.classList.add('hidden');
    }
    savePreferences();
  });

  // --- Save comment on input ---
  commentInput.addEventListener('input', () => {
    savePreferences();
  });

  // --- Auto-submit toggle ---
  submitToggle.addEventListener('change', () => {
    savePreferences();
  });

  // --- Fill button click ---
  fillBtn.addEventListener('click', async () => {
    if (!selectedRating || !isOnSurveyPage) return;

    // Show loading state
    fillBtn.disabled = true;
    fillBtnText.textContent = 'Filling...';
    fillBtnLoader.classList.remove('hidden');
    hideStatus();

    const options = {
      rating: selectedRating,
      comment: commentToggle.checked ? commentInput.value : null,
      autoSubmit: submitToggle.checked
    };

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'fillSurvey',
        options: options
      });

      if (response && response.success) {
        showStatus('success', response.message || 'Survey filled successfully!');
      } else {
        showStatus('error', response?.message || 'Failed to fill survey.');
      }
    } catch (err) {
      // Content script might not be injected, try programmatic injection
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });

        // Retry sending message after injection
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'fillSurvey',
          options: options
        });

        if (response && response.success) {
          showStatus('success', response.message || 'Survey filled successfully!');
        } else {
          showStatus('error', response?.message || 'Failed to fill survey.');
        }
      } catch (retryErr) {
        showStatus('error', 'Could not connect to the page. Please refresh and try again.');
      }
    }

    // Reset button state
    fillBtn.disabled = false;
    fillBtnText.textContent = 'Fill Survey';
    fillBtnLoader.classList.add('hidden');
    updateFillButton();
  });

  // --- Helper functions ---

  function updateFillButton() {
    fillBtn.disabled = !selectedRating || !isOnSurveyPage;

    if (!isOnSurveyPage) {
      fillBtnText.textContent = 'Navigate to a survey page first';
    } else if (!selectedRating) {
      fillBtnText.textContent = 'Select a rating first';
    } else {
      fillBtnText.textContent = 'Fill Survey';
    }
  }

  function savePreferences() {
    try {
      chrome.storage.local.set({
        rating: selectedRating,
        commentEnabled: commentToggle.checked,
        comment: commentInput.value,
        autoSubmit: submitToggle.checked
      });
    } catch (e) {
      // Silently fail if storage unavailable
    }
  }

  function showStatus(type, message) {
    statusBanner.className = `status-banner ${type}`;
    statusIcon.textContent = type === 'success' ? '\u2713' : type === 'error' ? '\u2717' : '\u26A0';
    statusText.textContent = message;
    statusBanner.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      hideStatus();
    }, 5000);
  }

  function hideStatus() {
    statusBanner.classList.add('hidden');
  }
});
