import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { Connection, Client } from '@temporalio/client';
import { z } from 'zod';
import { supplierRouter } from './mockSuppliers/supplierRouter';
import { TASK_QUEUE_NAME } from './worker';
import { hotelSearchWorkflow } from './workflows/hotelSearchWorkflow';
import { SearchRequest, SearchWorkflowResult } from './types/hotel';

const app = express();
const PORT = process.env.PORT || 3001;
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

app.use(cors());
app.use(express.json());

// Mount mock supplier endpoints: /supplierA/hotels, /supplierB/hotels, /mock/reset
app.use('/', supplierRouter);

// Validation schema for search request
const SearchRequestSchema = z.object({
  city: z.string().min(1, 'City is required'),
  checkIn: z.string().min(1, 'Check-in date is required'),
  checkOut: z.string().min(1, 'Check-out date is required'),
  scenario: z.enum([
    'normal',
    'supplierA_cheaper',
    'supplierB_cheaper',
    'same_rate',
    'supplierA_fails',
    'both_fail',
    'supplierA_empty',
    'both_empty',
    'supplierA_slow',
    'supplierA_flaky',
  ]).optional(),
});

let temporalClientPromise: Promise<Client> | null = null;

async function getTemporalClient(): Promise<Client> {
  if (!temporalClientPromise) {
    temporalClientPromise = (async () => {
      const connection = await Connection.connect({
        address: TEMPORAL_ADDRESS,
      });
      return new Client({ connection });
    })();
  }
  return temporalClientPromise;
}

// Health check
app.get('/api/health', async (_req: Request, res: Response) => {
  let temporalStatus = 'disconnected';
  try {
    const client = await getTemporalClient();
    await client.workflowService.getSystemInfo({});
    temporalStatus = 'connected';
  } catch {
    temporalStatus = 'unavailable';
  }

  res.json({
    status: 'ok',
    service: 'hotel-rate-comparator-backend',
    temporal: temporalStatus,
    temporalAddress: TEMPORAL_ADDRESS,
  });
});

/**
 * POST /api/search-hotels
 * Starts Temporal workflow to fetch and compare rates from Supplier A & B
 */
app.post('/api/search-hotels', async (req: Request, res: Response) => {
  const parseResult = SearchRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid search parameters',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const { city, checkIn, checkOut, scenario } = parseResult.data;
  const workflowId = `hotel-search-${uuidv4()}`;

  const searchPayload: SearchRequest = {
    city,
    checkIn,
    checkOut,
    scenario,
    requestId: workflowId,
  };

  try {
    const client = await getTemporalClient();

    // Start workflow execution
    const handle = await client.workflow.start(hotelSearchWorkflow, {
      taskQueue: TASK_QUEUE_NAME,
      workflowId,
      args: [searchPayload],
      workflowExecutionTimeout: '60s',
    });

    console.log(`[API] Started workflow ${workflowId} for city "${city}"`);

    // Await the workflow result
    const result = await handle.result();

    if (result.status === 'ERROR') {
      return res.status(502).json(result);
    }

    return res.json(result);
  } catch (err: any) {
    console.error(`[API] Error executing workflow ${workflowId}:`, err);
    return res.status(500).json({
      workflowId,
      status: 'ERROR',
      message: err.message || 'Internal error executing search workflow',
      error: err.name || 'WorkflowError',
    });
  }
});

/**
 * POST /api/search-hotels/:workflowId/cancel
 * Cancels a running workflow execution mid-way (Scenario 10)
 */
app.post('/api/search-hotels/:workflowId/cancel', async (req: Request, res: Response) => {
  const { workflowId } = req.params;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    await handle.cancel();
    console.log(`[API] Requested cancellation for workflow ${workflowId}`);

    return res.json({
      message: 'Cancellation requested successfully',
      workflowId,
    });
  } catch (err: any) {
    console.error(`[API] Error cancelling workflow ${workflowId}:`, err);
    return res.status(500).json({
      error: 'Failed to cancel workflow',
      message: err.message,
    });
  }
});

export { app };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Server] Backend API listening on http://localhost:${PORT}`);
    console.log(`[Server] Mock Supplier A: http://localhost:${PORT}/supplierA/hotels`);
    console.log(`[Server] Mock Supplier B: http://localhost:${PORT}/supplierB/hotels`);
  });
}
