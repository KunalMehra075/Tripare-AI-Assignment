import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { Context, CancelledFailure } from '@temporalio/activity';
import { hotelSearchWorkflow } from '../workflows/hotelSearchWorkflow';
import { SearchRequest, HotelRate } from '../types/hotel';

describe('Hotel Rate Comparator Workflow - Scenario Tests', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  }, 60000);

  afterAll(async () => {
    await testEnv?.teardown();
  });

  const baseRequest: SearchRequest = {
    city: 'Paris',
    checkIn: '2026-09-10',
    checkOut: '2026-09-15',
  };

  // -------------------------------------------------------------
  // BASIC SCENARIOS
  // -------------------------------------------------------------

  test('Scenario 1: Supplier A cheaper -> Return A\'s result', async () => {
    const taskQueue = 'test-queue-s1';

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-1', name: 'Paris Plaza', price: 100, currency: 'USD' },
        ],
        fetchSupplierB: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-1', name: 'Paris Plaza', price: 140, currency: 'USD' },
        ],
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's1-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('SUCCESS');
      expect(result.bestHotel).toBeDefined();
      expect(result.bestHotel?.supplier).toBe('SupplierA');
      expect(result.bestHotel?.price).toBe(100);
    });
  });

  test('Scenario 2: Supplier B cheaper -> Return B\'s result', async () => {
    const taskQueue = 'test-queue-s2';

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-1', name: 'Paris Plaza', price: 150, currency: 'USD' },
        ],
        fetchSupplierB: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-1', name: 'Paris Plaza', price: 110, currency: 'USD' },
        ],
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's2-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('SUCCESS');
      expect(result.bestHotel).toBeDefined();
      expect(result.bestHotel?.supplier).toBe('SupplierB');
      expect(result.bestHotel?.price).toBe(110);
    });
  });

  test('Scenario 3: Both return same rate -> Pick deterministically (Supplier A)', async () => {
    const taskQueue = 'test-queue-s3';

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-1', name: 'Grand Luxury Hotel', price: 120, currency: 'USD' },
        ],
        fetchSupplierB: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-1', name: 'Grand Luxury Hotel', price: 120, currency: 'USD' },
        ],
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's3-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('SUCCESS');
      expect(result.bestHotel).toBeDefined();
      expect(result.bestHotel?.price).toBe(120);
      expect(result.bestHotel?.supplier).toBe('SupplierA');
    });
  });

  test('Scenario 4: Supplier A fails, B succeeds -> Return B\'s result', async () => {
    const taskQueue = 'test-queue-s4';

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: async (): Promise<HotelRate[]> => {
          throw new Error('Supplier A API down');
        },
        fetchSupplierB: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-2', name: 'Eiffel View Suites', price: 130, currency: 'USD' },
        ],
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's4-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('SUCCESS');
      expect(result.bestHotel?.supplier).toBe('SupplierB');
      expect(result.bestHotel?.price).toBe(130);
      expect(result.comparison.supplierA?.status).toBe('ERROR');
      expect(result.comparison.supplierB?.status).toBe('SUCCESS');
    });
  });

  test('Scenario 5: Both fail -> Return error', async () => {
    const taskQueue = 'test-queue-s5';

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: async (): Promise<HotelRate[]> => {
          throw new Error('Supplier A crashed');
        },
        fetchSupplierB: async (): Promise<HotelRate[]> => {
          throw new Error('Supplier B timeout');
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's5-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('ERROR');
      expect(result.bestHotel).toBeUndefined();
      expect(result.message).toContain('Both suppliers failed');
    });
  });

  test('Scenario 6: One returns empty -> Use available result', async () => {
    const taskQueue = 'test-queue-s6';

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: async (): Promise<HotelRate[]> => [],
        fetchSupplierB: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-3', name: 'Seine Riverside Hotel', price: 160, currency: 'USD' },
        ],
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's6-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('SUCCESS');
      expect(result.bestHotel?.supplier).toBe('SupplierB');
      expect(result.bestHotel?.price).toBe(160);
      expect(result.comparison.supplierA?.status).toBe('EMPTY');
      expect(result.comparison.supplierB?.status).toBe('SUCCESS');
    });
  });

  test('Scenario 7: Both return empty -> Return "No hotels found"', async () => {
    const taskQueue = 'test-queue-s7';

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: async (): Promise<HotelRate[]> => [],
        fetchSupplierB: async (): Promise<HotelRate[]> => [],
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's7-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('NO_HOTELS_FOUND');
      expect(result.bestHotel).toBeUndefined();
      expect(result.message).toBe('No hotels found for the selected destination and dates.');
    });
  });

  // -------------------------------------------------------------
  // ADVANCED SCENARIOS
  // -------------------------------------------------------------

  test('Scenario 8: One supplier takes >5s to respond -> Cancel slow activity, proceed with one result', async () => {
    const taskQueue = 'test-queue-s8';

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        // Slow activity simulating supplier delay >5s
        fetchSupplierA: async (): Promise<HotelRate[]> => {
          await new Promise((resolve) => setTimeout(resolve, 6000));
          return [{ hotelId: 'h-slow', name: 'Slow Hotel', price: 80, currency: 'USD' }];
        },
        // Fast activity that succeeds immediately
        fetchSupplierB: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-fast', name: 'Fast Hotel Resort', price: 145, currency: 'USD' },
        ],
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's8-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('SUCCESS');
      expect(result.bestHotel?.supplier).toBe('SupplierB');
      expect(result.bestHotel?.price).toBe(145);
      expect(result.comparison.supplierA?.status).toBe('TIMED_OUT');
      expect(result.comparison.supplierA?.error).toContain('exceeded 5s response time limit and was cancelled');
      expect(result.comparison.supplierB?.status).toBe('SUCCESS');
    });
  });

  test('Scenario 9: Supplier A fails 2x before success -> Still succeeds if within retry policy', async () => {
    const taskQueue = 'test-queue-s9';
    let attemptsA = 0;

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: async (): Promise<HotelRate[]> => {
          attemptsA++;
          if (attemptsA <= 2) {
            throw new Error(`Flaky failure attempt ${attemptsA}`);
          }
          return [
            { hotelId: 'h-retry', name: 'Recovered Hotel Suites', price: 90, currency: 'USD' },
          ];
        },
        fetchSupplierB: async (): Promise<HotelRate[]> => [
          { hotelId: 'h-retry', name: 'Recovered Hotel Suites', price: 120, currency: 'USD' },
        ],
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's9-workflow',
        args: [baseRequest],
      });

      const result = await handle.result();
      expect(result.status).toBe('SUCCESS');
      expect(attemptsA).toBe(3); // Failed 2 times, succeeded on 3rd attempt
      expect(result.bestHotel?.supplier).toBe('SupplierA');
      expect(result.bestHotel?.price).toBe(90);
    });
  });

  test('Scenario 10: User cancels request mid-way -> Workflow stops gracefully', async () => {
    const taskQueue = 'test-queue-s10';

    const createCancellableActivity = () => async (): Promise<HotelRate[]> => {
      const context = Context.current();
      return new Promise<HotelRate[]>((_, reject) => {
        const interval = setInterval(() => {
          try {
            context.heartbeat();
          } catch {
            // ignore
          }
        }, 50);

        const onAbort = () => {
          clearInterval(interval);
          reject(new CancelledFailure('Cancelled by user'));
        };

        if (context.cancellationSignal.aborted) {
          onAbort();
        } else {
          context.cancellationSignal.addEventListener('abort', onAbort);
        }
      });
    };

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../workflows/hotelSearchWorkflow'),
      activities: {
        fetchSupplierA: createCancellableActivity(),
        fetchSupplierB: createCancellableActivity(),
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue,
        workflowId: 's10-workflow',
        args: [baseRequest],
      });

      // User cancels request mid-way
      await handle.cancel();

      const result = await handle.result();
      expect(result.status).toBe('CANCELLED');
      expect(result.message).toContain('cancelled gracefully by user');
    });
  });
});
