import { Router, Request, Response } from 'express';
import { HotelRate, ScenarioType } from '../types/hotel';

export const supplierRouter = Router();

// In-memory attempt tracker for flaky retry testing
const attemptCounters = new Map<string, number>();

export function resetMockState(): void {
  attemptCounters.clear();
}

supplierRouter.post('/mock/reset', (_req: Request, res: Response) => {
  resetMockState();
  res.json({ message: 'Mock state reset successfully' });
});

function getSampleHotels(city: string, baseMultiplier: number = 1.0): HotelRate[] {
  const normalizedCity = city.trim().toLowerCase();
  const cityCap = city.charAt(0).toUpperCase() + city.slice(1);

  return [
    {
      hotelId: `hotel-${normalizedCity}-1`,
      name: `${cityCap} Luxury Suites`,
      price: Math.round(180 * baseMultiplier),
      currency: 'USD',
      roomType: 'Deluxe King',
      availableRooms: 5,
    },
    {
      hotelId: `hotel-${normalizedCity}-2`,
      name: `Grand Central ${cityCap}`,
      price: Math.round(120 * baseMultiplier),
      currency: 'USD',
      roomType: 'Standard Queen',
      availableRooms: 8,
    },
    {
      hotelId: `hotel-${normalizedCity}-3`,
      name: `${cityCap} Boutique Inn`,
      price: Math.round(95 * baseMultiplier),
      currency: 'USD',
      roomType: 'Comfort Double',
      availableRooms: 2,
    },
  ];
}

// Handler for Supplier A
supplierRouter.get('/supplierA/hotels', async (req: Request, res: Response) => {
  const city = (req.query.city as string) || 'Paris';
  const scenario = (req.query.scenario as ScenarioType) || 'normal';
  const requestId = (req.query.requestId as string) || `${city}-${scenario}`;

  // Scenario: Supplier A slow (>5 seconds)
  if (scenario === 'supplierA_slow') {
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }

  // Scenario: Both fail or Supplier A fails
  if (scenario === 'supplierA_fails' || scenario === 'both_fail') {
    return res.status(500).json({ error: 'Supplier A internal server error (simulated)' });
  }

  // Scenario: Flaky (fails 2 times before success)
  if (scenario === 'supplierA_flaky') {
    const currentAttempt = (attemptCounters.get(requestId) || 0) + 1;
    attemptCounters.set(requestId, currentAttempt);

    if (currentAttempt <= 2) {
      return res.status(500).json({
        error: `Supplier A temporary failure (attempt ${currentAttempt}/3)`,
        attempt: currentAttempt,
      });
    }
  }

  // Scenario: Supplier A empty or both empty
  if (scenario === 'supplierA_empty' || scenario === 'both_empty') {
    return res.json([]);
  }

  // Scenario: Supplier A cheaper
  if (scenario === 'supplierA_cheaper') {
    return res.json([
      {
        hotelId: 'h-cheaper',
        name: `${city} Grand Hotel`,
        price: 90,
        currency: 'USD',
        roomType: 'Deluxe Room',
      },
    ]);
  }

  // Scenario: Supplier B cheaper (A is more expensive)
  if (scenario === 'supplierB_cheaper') {
    return res.json([
      {
        hotelId: 'h-cheaper',
        name: `${city} Grand Hotel`,
        price: 150,
        currency: 'USD',
        roomType: 'Deluxe Room',
      },
    ]);
  }

  // Scenario: Same rate
  if (scenario === 'same_rate') {
    return res.json([
      {
        hotelId: 'h-same',
        name: `${city} Royal Resort`,
        price: 120,
        currency: 'USD',
        roomType: 'Executive Suite',
      },
    ]);
  }

  // Normal realistic response: Supplier A base rate
  const hotels = getSampleHotels(city, 1.05); // slightly different from B
  return res.json(hotels);
});

// Handler for Supplier B
supplierRouter.get('/supplierB/hotels', async (req: Request, res: Response) => {
  const city = (req.query.city as string) || 'Paris';
  const scenario = (req.query.scenario as ScenarioType) || 'normal';

  // Scenario: Both fail
  if (scenario === 'both_fail') {
    return res.status(500).json({ error: 'Supplier B internal server error (simulated)' });
  }

  // Scenario: Both empty
  if (scenario === 'both_empty') {
    return res.json([]);
  }

  // Scenario: Supplier A cheaper (B is more expensive)
  if (scenario === 'supplierA_cheaper') {
    return res.json([
      {
        hotelId: 'h-cheaper',
        name: `${city} Grand Hotel`,
        price: 130,
        currency: 'USD',
        roomType: 'Deluxe Room',
      },
    ]);
  }

  // Scenario: Supplier B cheaper
  if (scenario === 'supplierB_cheaper') {
    return res.json([
      {
        hotelId: 'h-cheaper',
        name: `${city} Grand Hotel`,
        price: 85,
        currency: 'USD',
        roomType: 'Deluxe Room',
      },
    ]);
  }

  // Scenario: Same rate
  if (scenario === 'same_rate') {
    return res.json([
      {
        hotelId: 'h-same',
        name: `${city} Royal Resort`,
        price: 120,
        currency: 'USD',
        roomType: 'Executive Suite',
      },
    ]);
  }

  // Normal realistic response: Supplier B base rate
  const hotels = getSampleHotels(city, 0.98);
  return res.json(hotels);
});
