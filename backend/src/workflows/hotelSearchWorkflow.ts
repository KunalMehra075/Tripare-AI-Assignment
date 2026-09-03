import {
  proxyActivities,
  sleep,
  CancellationScope,
  isCancellation,
  workflowInfo,
} from '@temporalio/workflow';
import type * as activities from '../activities/supplierActivities';
import {
  HotelRate,
  SearchRequest,
  SearchWorkflowResult,
  SupplierRateResult,
  BestHotelResult,
} from '../types/hotel';

// Configure activities with retry policy for flaky suppliers
const { fetchSupplierA, fetchSupplierB } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10s',
  retry: {
    initialInterval: '200ms',
    backoffCoefficient: 1.5,
    maximumAttempts: 3, // Handles scenario: supplier fails 2x before success
    nonRetryableErrorTypes: ['NonRetryableError'],
  },
});

/**
 * Fetches rates from a supplier with a strict timeout.
 * If the supplier takes longer than timeoutMs (default 5s),
 * the activity is cancelled and a TIMED_OUT result is returned.
 */
async function fetchSupplierWithTimeout(
  supplier: 'SupplierA' | 'SupplierB',
  fetchFn: () => Promise<HotelRate[]>,
  timeoutMs: number = 5000
): Promise<SupplierRateResult> {
  const activityScope = new CancellationScope({ cancellable: true });
  const timerScope = new CancellationScope({ cancellable: true });
  let timedOut = false;

  const timerPromise = timerScope.run(async (): Promise<SupplierRateResult> => {
    try {
      await sleep(timeoutMs);
      timedOut = true;
      // Cancel the slow activity as required by Scenario 8
      activityScope.cancel();
      return {
        supplier,
        hotels: [],
        status: 'TIMED_OUT',
        error: `${supplier} exceeded 5s response time limit and was cancelled`,
      };
    } catch {
      // Timer scope was cancelled because activity finished first
      return new Promise<SupplierRateResult>(() => {});
    }
  });

  const activityPromise = activityScope.run(async (): Promise<SupplierRateResult> => {
    try {
      const hotels = await fetchFn();
      timerScope.cancel(); // Cancel timer immediately

      if (!hotels || hotels.length === 0) {
        return {
          supplier,
          hotels: [],
          status: 'EMPTY',
        };
      }

      return {
        supplier,
        hotels,
        status: 'SUCCESS',
      };
    } catch (err: any) {
      timerScope.cancel();

      if (isCancellation(err)) {
        if (timedOut) {
          return {
            supplier,
            hotels: [],
            status: 'TIMED_OUT',
            error: `${supplier} request was cancelled due to timeout`,
          };
        }
        // Cancelled by user mid-way, rethrow to workflow level
        throw err;
      }

      return {
        supplier,
        hotels: [],
        status: 'ERROR',
        error: err?.message || `${supplier} encountered an error`,
      };
    }
  });

  return Promise.race([activityPromise, timerPromise]);
}

/**
 * Main Hotel Search Workflow orchestrator.
 */
export async function hotelSearchWorkflow(request: SearchRequest): Promise<SearchWorkflowResult> {
  const { workflowId } = workflowInfo();
  const timestamp = new Date().toISOString();

  try {
    // Call Supplier A and Supplier B in parallel
    const [resA, resB] = await Promise.all([
      fetchSupplierWithTimeout('SupplierA', () => fetchSupplierA(request), 5000),
      fetchSupplierWithTimeout('SupplierB', () => fetchSupplierB(request), 5000),
    ]);

    const comparison = {
      supplierA: resA,
      supplierB: resB,
    };

    const hasHotelsA = resA.status === 'SUCCESS' && resA.hotels.length > 0;
    const hasHotelsB = resB.status === 'SUCCESS' && resB.hotels.length > 0;

    // Scenario 5: Both fail (or timed out with no results)
    const failedA = resA.status === 'ERROR' || resA.status === 'TIMED_OUT';
    const failedB = resB.status === 'ERROR' || resB.status === 'TIMED_OUT';

    if (failedA && failedB) {
      return {
        workflowId,
        status: 'ERROR',
        comparison,
        message: `Both suppliers failed: Supplier A (${resA.error || 'error'}), Supplier B (${resB.error || 'error'})`,
        timestamp,
      };
    }

    // Scenario 7: Both return empty
    const emptyA = resA.status === 'EMPTY' || (resA.status === 'SUCCESS' && resA.hotels.length === 0);
    const emptyB = resB.status === 'EMPTY' || (resB.status === 'SUCCESS' && resB.hotels.length === 0);

    if (emptyA && emptyB) {
      return {
        workflowId,
        status: 'NO_HOTELS_FOUND',
        comparison,
        message: 'No hotels found for the selected destination and dates.',
        timestamp,
      };
    }

    // Scenario 4, 6 & 8: One succeeds/available, other fails/empty/timed out
    if (hasHotelsA && !hasHotelsB) {
      const best = getCheapestHotel(resA.hotels);
      return {
        workflowId,
        status: 'SUCCESS',
        bestHotel: {
          ...best,
          supplier: 'SupplierA',
          currency: best.currency || 'USD',
        },
        comparison,
        message: `Found best rate from Supplier A (${resB.error || resB.status})`,
        timestamp,
      };
    }

    if (!hasHotelsA && hasHotelsB) {
      const best = getCheapestHotel(resB.hotels);
      return {
        workflowId,
        status: 'SUCCESS',
        bestHotel: {
          ...best,
          supplier: 'SupplierB',
          currency: best.currency || 'USD',
        },
        comparison,
        message: `Found best rate from Supplier B (${resA.error || resA.status})`,
        timestamp,
      };
    }

    // Both succeeded: Compare rates and pick cheapest
    if (hasHotelsA && hasHotelsB) {
      const bestA = getCheapestHotel(resA.hotels);
      const bestB = getCheapestHotel(resB.hotels);

      let winningSupplier: 'SupplierA' | 'SupplierB';
      let winningHotel: HotelRate;

      // Scenarios 1, 2, 3: Compare prices; pick Supplier A deterministically on tie
      if (bestA.price < bestB.price) {
        winningSupplier = 'SupplierA';
        winningHotel = bestA;
      } else if (bestB.price < bestA.price) {
        winningSupplier = 'SupplierB';
        winningHotel = bestB;
      } else {
        // Equal rate: pick Supplier A deterministically
        winningSupplier = 'SupplierA';
        winningHotel = bestA;
      }

      return {
        workflowId,
        status: 'SUCCESS',
        bestHotel: {
          ...winningHotel,
          supplier: winningSupplier,
          currency: winningHotel.currency || 'USD',
        },
        comparison,
        message: `Successfully compared rates across both suppliers. Winner: ${winningSupplier}`,
        timestamp,
      };
    }

    // Fallback if one failed and other was empty
    return {
      workflowId,
      status: 'NO_HOTELS_FOUND',
      comparison,
      message: 'No hotels found.',
      timestamp,
    };
  } catch (err: any) {
    // Scenario 10: Graceful handling of user cancellation mid-way
    if (isCancellation(err)) {
      return {
        workflowId,
        status: 'CANCELLED',
        comparison: {},
        message: 'Search workflow was cancelled gracefully by user.',
        timestamp,
      };
    }

    return {
      workflowId,
      status: 'ERROR',
      comparison: {},
      message: err?.message || 'Workflow encountered unexpected error',
      timestamp,
    };
  }
}

function getCheapestHotel(hotels: HotelRate[]): HotelRate {
  return hotels.reduce((cheapest, current) =>
    current.price < cheapest.price ? current : cheapest
  );
}
