/**
 * Simple layout test to verify button alignment
 * 
 * This is a basic test to check that the buttons in the HeroSection
 * are properly aligned horizontally.
 */

// This is a manual test function that can be run in the browser console
function testButtonAlignment() {
  // Get all the category buttons
  const buttonContainer = document.querySelector('.flex.flex-wrap.gap-3.mb-12.justify-center');
  if (!buttonContainer) {
    console.error('Button container not found');
    return false;
  }
  
  // Get all direct Link children that contain buttons
  const buttonLinks = buttonContainer.querySelectorAll('a');
  
  // Check if we have at least 4 buttons (3 categories + Browse All)
  if (buttonLinks.length < 4) {
    console.error(`Expected at least 4 buttons, found ${buttonLinks.length}`);
    return false;
  }
  
  // Get the Browse All button (should be the 4th one)
  const browseAllLink = buttonLinks[3];
  const browseAllButton = browseAllLink.querySelector('button');
  
  if (!browseAllButton) {
    console.error('Browse All button not found');
    return false;
  }
  
  // Check if the button text contains "Browse All"
  if (!browseAllButton.textContent.includes('Browse All')) {
    console.error(`Expected "Browse All" button, found "${browseAllButton.textContent}"`);
    return false;
  }
  
  // Check if all buttons are in the same row by comparing their offsetTop values
  // Get the first button's top position as reference
  const firstButtonTop = buttonLinks[0].offsetTop;
  
  // Check if Browse All button is at the same vertical position
  const browseAllTop = browseAllLink.offsetTop;
  
  if (Math.abs(firstButtonTop - browseAllTop) > 5) { // Allow 5px difference for minor layout variations
    console.error(`Buttons not aligned horizontally. First button top: ${firstButtonTop}, Browse All top: ${browseAllTop}`);
    return false;
  }
  
  console.log('✅ All buttons are properly aligned horizontally');
  return true;
}

// Instructions to run this test:
// 1. Open the browser console
// 2. Copy and paste the testButtonAlignment function
// 3. Run testButtonAlignment()
// Expected result: "✅ All buttons are properly aligned horizontally"