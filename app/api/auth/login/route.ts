import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessCode, generateAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { accessCode } = await request.json();

    if (!accessCode) {
      return NextResponse.json(
        { error: 'Access code is required' },
        { status: 400 }
      );
    }

    // Verify the access code
    const isValid = verifyAccessCode(accessCode);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 401 }
      );
    }

    // Generate auth token
    const token = generateAuthToken();

    return NextResponse.json({
      success: true,
      token,
      message: 'Authentication successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
