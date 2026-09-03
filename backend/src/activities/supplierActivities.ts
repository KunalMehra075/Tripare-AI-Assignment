import { Context } from '@temporalio/activity';
import axios from 'axios';
import { HotelRate, SearchRequest } from '../types/hotel';

const SUPPLIER_BASE_URL = process.env.SUPPLIER_BASE_URL || 'http://localhost:3001';

export async function fetchSupplierA(request: SearchRequest): Promise<HotelRate[]> {
  const context = Context.current();
  const url = `${SUPPLIER_BASE_URL}/supplierA/hotels`;

  const response = await axios.get<HotelRate[]>(url, {
    params: {
      city: request.city,
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      scenario: request.scenario,
      requestId: request.requestId,
    },
    signal: context.cancellationSignal,
    timeout: 10000,
  });

  return response.data;
}

export async function fetchSupplierB(request: SearchRequest): Promise<HotelRate[]> {
  const context = Context.current();
  const url = `${SUPPLIER_BASE_URL}/supplierB/hotels`;

  const response = await axios.get<HotelRate[]>(url, {
    params: {
      city: request.city,
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      scenario: request.scenario,
      requestId: request.requestId,
    },
    signal: context.cancellationSignal,
    timeout: 10000,
  });

  return response.data;
}
