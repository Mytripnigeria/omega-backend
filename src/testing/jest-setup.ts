import { Logger } from '@nestjs/common';

// These services log deliberately (ingest results, reconciliation warnings).
// Useful in production, noise in a test run.
Logger.overrideLogger(false);
