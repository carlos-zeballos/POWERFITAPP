/** Keep all loyalty routes and jobs inert until the gym explicitly enables the module. */
export const loyaltyEnabled = () => process.env.LOYALTY_ENABLED === 'true';
