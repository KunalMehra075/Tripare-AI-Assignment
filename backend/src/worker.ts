import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities/supplierActivities';
import * as path from 'path';

export const TASK_QUEUE_NAME = 'hotel-search-queue';

export async function runWorker() {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  console.log(`[Worker] Connecting to Temporal Server at ${temporalAddress}...`);

  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE_NAME,
    workflowsPath: require.resolve('./workflows/hotelSearchWorkflow'),
    activities,
  });

  console.log(`[Worker] Temporal Worker started on task queue "${TASK_QUEUE_NAME}".`);
  await worker.run();
}

if (require.main === module) {
  runWorker().catch((err) => {
    if (err.message && err.message.includes('Connection refused')) {
      console.error('\n❌ [Worker] Could not connect to Temporal Server at localhost:7233 (Connection Refused).');
      console.error('\nPlease start a local Temporal Server using one of these options:');
      console.error('  Option 1 (Docker):       docker compose up -d');
      console.error('  Option 2 (Temporal CLI): brew install temporal && temporal server start-dev\n');
    } else {
      console.error('[Worker] Fatal error running Temporal worker:', err);
    }
    process.exit(1);
  });
}

