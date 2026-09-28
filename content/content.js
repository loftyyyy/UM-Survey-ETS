// =============================================
// UM Survey Auto-Fill - Content Script
// Injected into UM survey pages to interact
// with the evaluation form DOM.
// =============================================

(() => {
  // Prevent double-injection
  if (window.__umSurveyAutoFillLoaded) return;
  window.__umSurveyAutoFillLoaded = true;

  // --- Listen for messages from the popup ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fillSurvey') {
      const result = fillSurvey(message.options);
      sendResponse(result);
    }

    // Return true to indicate async response (even though we respond synchronously,
    // this keeps the channel open in case we need async in the future)
    return true;
  });

  createFloatingControls();

  /**
   * Add an in-page control so the extension is available without opening the
   * browser action popup.
   */
  function createFloatingControls() {
    const host = document.createElement('div');
    host.id = 'um-survey-auto-fill-controls';
    host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;';

    const shadowRoot = host.attachShadow({ mode: 'closed' });
    shadowRoot.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .wrapper { font-family: Arial, sans-serif; color: #243447; }
        .panel {
          display: none;
          width: 286px;
          margin-bottom: 10px;
          padding: 16px;
          border: 1px solid #d9e2ec;
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(36, 52, 71, 0.22);
        }
        .panel.open { display: block; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .title { margin: 0; font-size: 16px; font-weight: 700; }
        .close { border: 0; padding: 2px 6px; background: transparent; color: #718096; font-size: 20px; line-height: 1; cursor: pointer; }
        .label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; }
        .ratings { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin-bottom: 14px; }
        .rating { border: 1px solid #b8c5d3; border-radius: 6px; padding: 8px 0; background: #f8fafc; color: #243447; font-weight: 700; cursor: pointer; }
        .rating.selected { border-color: #1769aa; background: #1769aa; color: #ffffff; }
        .option { display: flex; align-items: center; gap: 8px; margin: 10px 0; font-size: 13px; cursor: pointer; }
        textarea { display: none; width: 100%; min-height: 58px; resize: vertical; margin: 5px 0 12px; border: 1px solid #b8c5d3; border-radius: 6px; padding: 8px; font: inherit; font-size: 12px; }
        textarea.open { display: block; }
        .fill { width: 100%; border: 0; border-radius: 6px; padding: 10px; background: #1769aa; color: #ffffff; font-weight: 700; cursor: pointer; }
        .fill:disabled { background: #a0aec0; cursor: not-allowed; }
        .status { min-height: 16px; margin: 10px 0 0; color: #52606d; font-size: 11px; line-height: 1.35; }
        .toggle { position: relative; width: 42px; height: 22px; margin-left: auto; }
        .toggle input { position: absolute; opacity: 0; }
        .track { display: block; width: 42px; height: 22px; border-radius: 11px; background: #cbd5e0; cursor: pointer; }
        .track::after { display: block; width: 18px; height: 18px; margin: 2px; border-radius: 50%; background: #ffffff; content: ''; transition: transform 0.15s ease; }
        .toggle input:checked + .track { background: #1769aa; }
        .toggle input:checked + .track::after { transform: translateX(20px); }
        .launcher { border: 0; border-radius: 22px; padding: 12px 16px; background: #1769aa; color: #ffffff; box-shadow: 0 5px 14px rgba(23, 105, 170, 0.35); font: 700 13px Arial, sans-serif; cursor: pointer; }
      </style>
      <div class="wrapper">
        <section class="panel" aria-label="UM Survey Auto-Fill">
          <div class="panel-header">
            <h2 class="title">UM Survey Auto-Fill</h2>
            <button class="close" type="button" aria-label="Close">&times;</button>
          </div>
          <span class="label">Select rating</span>
          <div class="ratings">
            <button class="rating" type="button" data-rating="1">1</button>
            <button class="rating" type="button" data-rating="2">2</button>
            <button class="rating" type="button" data-rating="3">3</button>
            <button class="rating" type="button" data-rating="4">4</button>
            <button class="rating" type="button" data-rating="5">5</button>
          </div>
          <label class="option">
            <span>Include comment</span>
            <span class="toggle"><input class="comment-toggle" type="checkbox"><span class="track"></span></span>
          </label>
          <textarea class="comment" placeholder="Enter your comment..."></textarea>
          <label class="option">
            <span>Auto-submit after fill</span>
            <span class="toggle"><input class="submit-toggle" type="checkbox"><span class="track"></span></span>
          </label>
          <button class="fill" type="button" disabled>Fill survey</button>
          <p class="status" role="status"></p>
        </section>
        <button class="launcher" type="button" aria-expanded="false">UM Survey</button>
      </div>
    `;

    document.documentElement.appendChild(host);

    const panel = shadowRoot.querySelector('.panel');
    const launcher = shadowRoot.querySelector('.launcher');
    const close = shadowRoot.querySelector('.close');
    const ratingButtons = shadowRoot.querySelectorAll('.rating');
    const commentToggle = shadowRoot.querySelector('.comment-toggle');
    const commentInput = shadowRoot.querySelector('.comment');
    const submitToggle = shadowRoot.querySelector('.submit-toggle');
    const fillButton = shadowRoot.querySelector('.fill');
    const status = shadowRoot.querySelector('.status');
    let selectedRating = null;

    function setOpen(isOpen) {
      panel.classList.toggle('open', isOpen);
      launcher.setAttribute('aria-expanded', String(isOpen));
    }

    function updateFillButton() {
      fillButton.disabled = !selectedRating;
    }

    function savePreferences() {
      chrome.storage.local.set({
        rating: selectedRating,
        commentEnabled: commentToggle.checked,
        comment: commentInput.value,
        autoSubmit: submitToggle.checked
      });
    }

    launcher.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    close.addEventListener('click', () => setOpen(false));

    ratingButtons.forEach((button) => {
      button.addEventListener('click', () => {
        ratingButtons.forEach((item) => item.classList.remove('selected'));
        button.classList.add('selected');
        selectedRating = button.dataset.rating;
        savePreferences();
        updateFillButton();
      });
    });

    commentToggle.addEventListener('change', () => {
      commentInput.classList.toggle('open', commentToggle.checked);
      savePreferences();
    });
    commentInput.addEventListener('input', savePreferences);
    submitToggle.addEventListener('change', savePreferences);

    fillButton.addEventListener('click', () => {
      if (!selectedRating) return;

      fillButton.disabled = true;
      const result = fillSurvey({
        rating: selectedRating,
        comment: commentToggle.checked ? commentInput.value : null,
        autoSubmit: submitToggle.checked
      });
      status.textContent = result.message;
      status.style.color = result.success ? '#287d3c' : '#c9190b';
      updateFillButton();
    });

    chrome.storage.local.get(['rating', 'commentEnabled', 'comment', 'autoSubmit']).then((saved) => {
      selectedRating = saved.rating || null;
      ratingButtons.forEach((button) => {
        button.classList.toggle('selected', button.dataset.rating === selectedRating);
      });
      commentToggle.checked = Boolean(saved.commentEnabled);
      commentInput.classList.toggle('open', commentToggle.checked);
      commentInput.value = saved.comment || '';
      submitToggle.checked = Boolean(saved.autoSubmit);
      updateFillButton();
    }).catch(() => {
      updateFillButton();
    });
  }

  /**
   * Main function to fill the survey form.
   * @param {Object} options
   * @param {string} options.rating - The rating value ("1" through "5")
   * @param {string|null} options.comment - Optional comment text
   * @param {boolean} options.autoSubmit - Whether to auto-click submit
   * @returns {Object} Result with success status and message
   */
  function fillSurvey(options) {
    const { rating, comment, autoSubmit } = options;

    try {
      // --- Step 1: Find and fill all rating radio buttons ---
      const filledCount = fillRatings(rating);

      if (filledCount === 0) {
        return {
          success: false,
          message: 'No rating questions found on this page. The page structure may have changed.'
        };
      }

      // --- Step 2: Fill comment if provided ---
      let commentFilled = false;
      if (comment !== null && comment !== undefined) {
        commentFilled = fillComment(comment);
      }

      // --- Step 3: Auto-submit if enabled ---
      let submitted = false;
      if (autoSubmit) {
        submitted = clickSubmit();
      }

      // --- Build result message ---
      let msg = `Filled ${filledCount} question(s) with rating ${rating}`;
      if (comment !== null && comment !== undefined) {
        msg += commentFilled ? ', comment added' : ', comment box not found';
      }
      if (autoSubmit) {
        msg += submitted ? ', form submitted.' : ', submit button not found.';
      } else {
        msg += '. Review and submit manually.';
      }

      return { success: true, message: msg };
    } catch (err) {
      return {
        success: false,
        message: `Error: ${err.message}`
      };
    }
  }

  /**
   * Fill all rating radio buttons with the given value.
   * Detects questions dynamically by scanning for radio inputs
   * with names matching "rating_N" pattern.
   * @param {string} value - Rating value to select
   * @returns {number} Number of questions filled
   */
  function fillRatings(value) {
    let filledCount = 0;

    // Strategy 1: Try the known naming convention (rating_1, rating_2, ...)
    // First, discover how many questions exist by finding all unique radio group names
    const allRadios = document.querySelectorAll('input[type="radio"]');
    const radioGroups = new Map();

    allRadios.forEach((radio) => {
      const name = radio.name;
      if (name && /^rating_\d+$/.test(name)) {
        if (!radioGroups.has(name)) {
          radioGroups.set(name, []);
        }
        radioGroups.get(name).push(radio);
      }
    });

    // Try to fill each radio group
    radioGroups.forEach((radios, groupName) => {
      let clicked = false;
      radios.forEach((radio) => {
        if (radio.value === value) {
          clickRadio(radio);

          // Dispatch change event for any JS listeners on the page
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          clicked = true;
        }
      });

      if (clicked) {
        filledCount++;
      }
    });

    return filledCount;
  }

  /**
   * Activate a radio button, including radios enhanced by the iCheck plugin.
   * @param {HTMLInputElement} radio - Radio input to activate
   */
  function clickRadio(radio) {
    const iCheckContainer = radio.closest('.iradio_flat-blue, .iradio');
    const iCheckHelper = iCheckContainer?.querySelector('.iCheck-helper');

    if (iCheckHelper) {
      iCheckHelper.click();
      return;
    }

    const label = radio.closest('label');
    if (label) {
      label.click();
      return;
    }

    radio.click();
  }

  /**
   * Fill the comment/notes textarea.
   * Tries multiple selectors to find the comment box.
   * @param {string} text - Comment text to fill
   * @returns {boolean} Whether the comment was filled
   */
  function fillComment(text) {
    // Try various selectors that might match the comment box
    const selectors = [
      'textarea',
      'textarea[name*="comment"]',
      'textarea[name*="note"]',
      'textarea[name*="remark"]',
      'textarea[name*="message"]',
      'textarea[name*="feedback"]',
      'input[type="text"][name*="comment"]',
      'input[type="text"][name*="note"]',
      'input[type="text"][name*="remark"]',
      '.comment textarea',
      '.notes textarea',
      '#comment',
      '#notes',
      '#remarks'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Use the last textarea found (usually the comment box is at the bottom)
        const el = elements[elements.length - 1];
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  /**
   * Click the submit button.
   * Tries multiple selectors to find it.
   * @returns {boolean} Whether submit was clicked
   */
  function clickSubmit() {
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[name="submit"]',
      'input[name="submit"]',
      '#submit',
      '.submit',
      'button.btn-primary',
      'button.btn-submit'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        el.click();
        return true;
      }
    }

    // Fallback: Look for any button containing "submit" text
    const buttons = document.querySelectorAll('button, input[type="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase().trim();
      if (text.includes('submit') || text.includes('save')) {
        btn.click();
        return true;
      }
    }

    return false;
  }
})();
