/**
 * Unified Time Context for AccountingFlow
 * Ensures "Now" is consistently interpreted across all reports/simulations.
 */
export const getNow = (selectedDate?: string) => {
  return selectedDate ? new Date(selectedDate) : new Date();
};
