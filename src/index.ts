/**
 * K2D - Knowledge to Data
 * 从 Claude Code 使用历史中提取可复用知识资产
 */

// Utils
export { detectGitAvailable, detectGitRepo, getTrackingMode } from './utils/git-detector';
export { filterSensitiveData, containsSensitiveData } from './utils/sensitive-filter';

// Init
export { initializeMetaDirectory, isMetaInitialized, getRequiredDirs } from './init/create-directories';

// Database
export { initializeDatabase, openDatabase, getConfig, setConfig, getAllTables } from './db/init';
export { schema, requiredTables } from './db/schema';
export type { K2DDatabase } from './db/init';

// Collectors
export * from './collectors';

// Extractors
export * from './extractors';

// Database Operations
export * from './db/operations';
