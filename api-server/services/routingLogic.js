function determineApprovalFlow(amount, isPreApproved) {
  let requiredLevels = [];

  // 1. Threshold-Based Routing
  if (amount <= 1000) {
    requiredLevels = [1]; // Level 1 (Team Lead)
  } else if (amount <= 10000) {
    requiredLevels = [1, 2]; // Level 1 + Level 2 (Finance)
  } else {
    requiredLevels = [1, 2, 3]; // Level 1 + Level 2 + Level 3 (Executive)
  }

  // 2. Conditional Logic: Pre-approved allocation bypasses Finance (Level 2)
  if (isPreApproved) {
    requiredLevels = requiredLevels.filter((level) => level !== 2);
  }

  return requiredLevels;
}

module.exports = { determineApprovalFlow };