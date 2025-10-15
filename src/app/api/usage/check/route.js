import { NextResponse } from 'next/server';
import { canUserUploadReceipt } from '../../../../lib/usage-tracker.js';

export async function GET(request) {
  try {
    // For now, we'll use a default user ID
    // In a real app, you'd get this from authentication
    const userId = 'default-user';
    
    const usageStatus = await canUserUploadReceipt(userId);
    
    return NextResponse.json({
      success: true,
      ...usageStatus
    });
    
  } catch (error) {
    console.error('❌ Usage check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}