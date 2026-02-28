import { ApiResponse } from '@/types';
import { NextResponse } from 'next/server';

export const successResponse = <T>(data: T, message?: string): NextResponse<ApiResponse<T>> => {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
};

export const errorResponse = (error: string, status: number = 400): NextResponse<ApiResponse> => {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
};
