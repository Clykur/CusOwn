import { ApiResponse } from '@/types';
import { NextResponse } from 'next/server';
import { getCorrelationId } from '@/lib/monitoring/request-context';

function attachCorrelation<T>(res: NextResponse<ApiResponse<T>>): NextResponse<ApiResponse<T>> {
  const correlationId = getCorrelationId();
  if (correlationId) {
    res.headers.set('x-correlation-id', correlationId);
  }
  return res;
}

export const successResponse = <T>(data: T, message?: string): NextResponse<ApiResponse<T>> => {
  const correlationId = getCorrelationId();
  const body: ApiResponse<T> = {
    success: true,
    data,
    message,
    ...(correlationId ? { correlationId } : {}),
  };
  const res = NextResponse.json(body);
  return attachCorrelation(res);
};

export const errorResponse = (error: string, status: number = 400): NextResponse<ApiResponse> => {
  const correlationId = getCorrelationId();
  const body: ApiResponse = {
    success: false,
    error,
    ...(correlationId ? { correlationId } : {}),
  };
  const res = NextResponse.json(body, { status });
  return attachCorrelation(res);
};
