import { fal } from "@fal-ai/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get API key from environment
    const apiKey = process.env.FAL_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "FAL_KEY not configured in environment variables"
        },
        { status: 500 }
      );
    }

    // Configure Fal client
    fal.config({
      credentials: apiKey,
    });

    // Test by uploading a tiny test blob to verify authentication
    // This is the most reliable way to test if the API key works
    const testBlob = new Blob(["test"], { type: "text/plain" });
    const testFile = new File([testBlob], "test.txt");

    const uploadedUrl = await fal.storage.upload(testFile);

    return NextResponse.json({
      success: true,
      message: "Fal.ai API connection successful",
      apiKey: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
      testUploadUrl: uploadedUrl,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Fal.ai test error:", error);

    // Check for common authentication errors
    const isAuthError = error.message?.includes("401") ||
                        error.message?.includes("403") ||
                        error.message?.includes("Unauthorized") ||
                        error.message?.includes("Invalid");

    return NextResponse.json(
      {
        success: false,
        error: isAuthError
          ? "Invalid Fal.ai API key - please check your FAL_KEY in .env.local"
          : (error.message || "Unknown error testing Fal.ai API"),
        details: error.toString(),
        apiKey: process.env.FAL_KEY
          ? `${process.env.FAL_KEY.substring(0, 8)}...${process.env.FAL_KEY.substring(process.env.FAL_KEY.length - 4)}`
          : "not set"
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
