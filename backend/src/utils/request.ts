/**
 * Safely extracts a string from a potentially multi-valued Express request parameter or query.
 * If the value is an array, returns the first element.
 * If the value is undefined or null, returns an empty string or a default value.
 */
export const getStringParam = (val: any, defaultVal: string = ''): string => {
    if (val === undefined || val === null) return defaultVal;
    if (Array.isArray(val)) return val[0]?.toString() || defaultVal;
    return val.toString();
};

/**
 * Safely extracts a number from a potentially multi-valued Express request parameter or query.
 */
export const getNumberParam = (val: any, defaultVal: number = 0): number => {
    const stringVal = getStringParam(val);
    const parsed = parseFloat(stringVal);
    return isNaN(parsed) ? defaultVal : parsed;
};
