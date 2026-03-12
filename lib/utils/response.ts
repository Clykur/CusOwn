import { ApiResponse } from '@/types';
import { NextResponse } from 'next/server';

export const successResponse = <T>(data: T, message?: string): NextResponse<ApiResponse<T>> => {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
};

export const errorResponse = (
  error: string,
  status: number = 400,
  code?: string
): NextResponse<ApiResponse> => {
  const body: ApiResponse = { success: false, error };
  if (code !== undefined) body.code = code;
  return NextResponse.json(body, { status });
};
