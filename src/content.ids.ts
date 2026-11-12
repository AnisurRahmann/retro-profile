/**
 * Id lists shared by the schema and by runtime code.
 * Kept free of zod so client islands can import them without bundling the validator.
 */
export const BUS_IDS = ["VOICE", "AGENTS", "DEVTOOLS", "CONSUMER", "CONTENT", "RESEARCH"] as const;
export const STATUS_IDS = ["SHIPPED", "IN_BUILD", "BUILT", "SPECD", "IDEA"] as const;
export const HORIZON_IDS = ["NOW", "NEXT", "LATER"] as const;
export const SHEET_NOS = ["00", "01", "02", "03", "04", "05", "06", "07"] as const;
