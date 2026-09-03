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
    console.error('[Worker] Fatal error running Temporal worker:', err);
    process.exit(1);
  });
}

