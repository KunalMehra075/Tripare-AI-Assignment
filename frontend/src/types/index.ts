export interface HotelRate {
  hotelId: string;
  name: string;
  price: number;
  currency?: string;
  roomType?: string;
  availableRooms?: number;
}

export type ScenarioType =
  | 'normal'
  | 'supplierA_cheaper'
  | 'supplierB_cheaper'
  | 'same_rate'
  | 'supplierA_fails'
  | 'both_fail'
  | 'supplierA_empty'
  | 'both_empty'
  | 'supplierA_slow'
  | 'supplierA_flaky';

export interface SearchFormData {
  city: string;
  checkIn: string;
  checkOut: string;
  scenario: ScenarioType;
}

export interface SupplierRateResult {
  supplier: 'SupplierA' | 'SupplierB';
  hotels: HotelRate[];
  status: 'SUCCESS' | 'EMPTY' | 'ERROR' | 'TIMED_OUT';
  error?: string;
}

export interface BestHotelResult {
  hotelId: string;
  name: string;
  price: number;
  currency: string;
  supplier: 'SupplierA' | 'SupplierB';
}

export interface SearchWorkflowResult {
  workflowId: string;
  status: 'SUCCESS' | 'NO_HOTELS_FOUND' | 'ERROR' | 'CANCELLED';
  bestHotel?: BestHotelResult;
  comparison: {
    supplierA?: SupplierRateResult;
    supplierB?: SupplierRateResult;
  };
  message?: string;
  timestamp: string;
}

