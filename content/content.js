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
      if (name) {
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
          radio.checked = true;
          radio.click();

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
