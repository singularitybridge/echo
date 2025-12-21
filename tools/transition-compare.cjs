#!/usr/bin/env node
/**
 * Transition Comparison Tool
 *
 * A reusable CLI tool to test different transition concepts across video models.
 *
 * Usage:
 *   node tools/transition-compare.cjs --start <path> --end <path> --prompt <text> --name <name> [--models <list>]
 *
 * Examples:
 *   node tools/transition-compare.cjs \
 *     --start public/model-comparison-static/start-frame.png \
 *     --end public/model-comparison-static/end-frame.png \
 *     --prompt "Zoom into the desk, blur, then pull back to reveal renovated space" \
 *     --name zoom-transition
 *
 *   node tools/transition-compare.cjs \
 *     --start frames/scene1.png --end frames/scene2.png \
 *     --prompt "Camera pans left" --name pan-left \
 *     --models vidu,wan21,veo31
 */

const { fal } = require("@fal-ai/client");
const fs = require("fs");
const path = require("path");

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    start: null,
    end: null,
    prompt: null,
    name: null,
    models: ["vidu", "wan21", "veo31", "minimax", "luma"],
    aspectRatio: "9:16",
    duration: "4",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--start":
      case "-s":
        config.start = args[++i];
        break;
      case "--end":
      case "-e":
        config.end = args[++i];
        break;
      case "--prompt":
      case "-p":
        config.prompt = args[++i];
        break;
      case "--name":
      case "-n":
        config.name = args[++i];
        break;
      case "--models":
      case "-m":
        config.models = args[++i].split(",").map(m => m.trim().toLowerCase());
        break;
      case "--aspect":
      case "-a":
        config.aspectRatio = args[++i];
        break;
      case "--duration":
      case "-d":
        config.duration = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Transition Comparison Tool
==========================

Test different transition concepts across multiple AI video models.

Usage:
  node tools/transition-compare.cjs [options]

Required Options:
  --start, -s <path>     Path to start frame image
  --end, -e <path>       Path to end frame image
  --prompt, -p <text>    Transition prompt/direction
  --name, -n <name>      Output folder name (e.g., "zoom-transition")

Optional:
  --models, -m <list>    Comma-separated models (default: vidu,wan21,veo31,minimax,luma)
  --aspect, -a <ratio>   Aspect ratio (default: 9:16)
  --duration, -d <secs>  Duration in seconds (default: 4)
  --help, -h             Show this help

Available Models:
  vidu     - Vidu Q1 (native first-last-frame)
  wan21    - WAN 2.1 FLF2V (native first-last-frame)
  veo31    - Veo 3.1 Fast
  minimax  - Minimax Pro Hailuo-02
  luma     - Luma Ray 2 (requires 720p frames)

Examples:
  # Test zoom transition with all models
  node tools/transition-compare.cjs \\
    --start public/frames/old-hotel.png \\
    --end public/frames/new-hotel.png \\
    --prompt "Smooth zoom into desk, blur transition, pull back to reveal renovation" \\
    --name hotel-zoom

  # Test with specific models only
  node tools/transition-compare.cjs \\
    --start scene1.png --end scene2.png \\
    --prompt "Camera pans right" --name pan-test \\
    --models vidu,veo31
`);
}

// Validate config
function validateConfig(config) {
  const errors = [];
  if (!config.start) errors.push("Missing --start frame path");
  if (!config.end) errors.push("Missing --end frame path");
  if (!config.prompt) errors.push("Missing --prompt text");
  if (!config.name) errors.push("Missing --name for output folder");

  if (config.start && !fs.existsSync(config.start)) {
    errors.push(`Start frame not found: ${config.start}`);
  }
  if (config.end && !fs.existsSync(config.end)) {
    errors.push(`End frame not found: ${config.end}`);
  }

  if (errors.length > 0) {
    console.error("\n❌ Configuration errors:");
    errors.forEach(e => console.error(`   - ${e}`));
    console.error("\nRun with --help for usage information.\n");
    process.exit(1);
  }
}

// Initialize Fal.ai
function initFal() {
  const FAL_KEY = process.env.FAL_KEY || process.env.NEXT_PUBLIC_FAL_KEY;
  if (!FAL_KEY) {
    console.error("❌ FAL_KEY environment variable is required");
    process.exit(1);
  }
  fal.config({ credentials: FAL_KEY });
}

// Upload image to Fal storage
async function uploadImage(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const blob = new Blob([buffer], { type: "image/png" });
  const file = new File([blob], path.basename(imagePath), { type: "image/png" });
  return await fal.storage.upload(file);
}

// Download video from URL
async function downloadVideo(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// Model generators
const generators = {
  async vidu(startUrl, endUrl, prompt, config) {
    const result = await fal.subscribe("fal-ai/vidu/q1/start-end-to-video", {
      input: {
        start_image_url: startUrl,
        end_image_url: endUrl,
        prompt: prompt,
        aspect_ratio: config.aspectRatio,
        duration: config.duration,
      },
      logs: true,
    });
    return result.data?.video?.url;
  },

  async wan21(startUrl, endUrl, prompt, config) {
    const result = await fal.subscribe("fal-ai/wan-flf2v", {
      input: {
        start_image_url: startUrl,
        end_image_url: endUrl,
        prompt: prompt,
        aspect_ratio: config.aspectRatio,
        resolution: "720p",
        num_frames: 81,
        frames_per_second: 16,
        guide_scale: 5,
        num_inference_steps: 30,
      },
      logs: true,
    });
    return result.data?.video?.url;
  },

  async veo31(startUrl, endUrl, prompt, config) {
    const result = await fal.subscribe("fal-ai/veo3.1/fast/first-last-frame-to-video", {
      input: {
        first_frame_url: startUrl,
        last_frame_url: endUrl,
        prompt: prompt,
        aspect_ratio: config.aspectRatio,
        duration: config.duration + "s",
        resolution: "720p",
        generate_audio: false,
      },
      logs: true,
    });
    return result.data?.video?.url;
  },

  async minimax(startUrl, endUrl, prompt, config) {
    const result = await fal.subscribe("fal-ai/minimax-video/hailuo-02/pro/image-to-video", {
      input: {
        image_url: startUrl,
        end_image_url: endUrl,
        prompt: prompt,
      },
      logs: true,
    });
    return result.data?.video?.url;
  },

  async luma(startUrl, endUrl, prompt, config) {
    const result = await fal.subscribe("fal-ai/luma-dream-machine/ray-2/image-to-video", {
      input: {
        image_url: startUrl,
        end_image_url: endUrl,
        prompt: prompt,
        aspect_ratio: config.aspectRatio,
        resolution: "720p",
        duration: "5s",
      },
      logs: true,
    });
    return result.data?.video?.url;
  },
};

const modelNames = {
  vidu: "Vidu Q1",
  wan21: "WAN 2.1",
  veo31: "Veo 3.1 Fast",
  minimax: "Minimax Pro",
  luma: "Luma Ray 2",
};

// Generate comparison HTML page
function generateHTML(config, results) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transition: ${config.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; } video { max-height: 500px; }</style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Transition: ${config.name}</h1>
      <p class="text-gray-600">Generated ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Reference Frames</h2>
      <div class="grid grid-cols-2 gap-6">
        <div>
          <p class="text-sm text-gray-500 mb-2">Start Frame</p>
          <img src="start-frame.png" alt="Start" class="rounded-lg border border-gray-200 w-full max-h-96 object-contain bg-gray-100">
        </div>
        <div>
          <p class="text-sm text-gray-500 mb-2">End Frame</p>
          <img src="end-frame.png" alt="End" class="rounded-lg border border-gray-200 w-full max-h-96 object-contain bg-gray-100">
        </div>
      </div>
    </div>

    <div class="bg-indigo-50 rounded-xl border border-indigo-100 p-6 mb-8">
      <h2 class="text-lg font-semibold text-indigo-900 mb-2">Director's Prompt</h2>
      <p class="text-indigo-800 text-sm leading-relaxed">${config.prompt}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${Object.entries(results).map(([model, result]) => `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-4 border-b border-gray-100">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">${modelNames[model] || model}</h3>
            <span class="text-sm ${result.success ? 'text-gray-500' : 'text-red-500'}">${result.success ? result.time + 's' : 'Failed'}</span>
          </div>
        </div>
        <div class="aspect-[9/16] bg-gray-100 flex items-center justify-center">
          ${result.success ? `<video controls loop class="w-full h-full object-contain"><source src="${model}.mp4" type="video/mp4"></video>` : `<p class="text-red-500 text-sm p-4">${result.error}</p>`}
        </div>
      </div>
      `).join('')}
    </div>

    <div class="mt-8 text-center text-sm text-gray-500">
      <p>Generated with Transition Comparison Tool</p>
    </div>
  </div>
</body>
</html>`;
}

// Main execution
async function main() {
  const config = parseArgs();
  validateConfig(config);
  initFal();

  const outputDir = path.join(__dirname, "..", "public", `transition-${config.name}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log("\n" + "=".repeat(70));
  console.log(`TRANSITION COMPARISON: ${config.name}`);
  console.log("=".repeat(70));
  console.log(`\n📝 Prompt: ${config.prompt}`);
  console.log(`📐 Aspect: ${config.aspectRatio} | Duration: ${config.duration}s`);
  console.log(`🎬 Models: ${config.models.join(", ")}`);

  // Copy frames
  fs.copyFileSync(config.start, path.join(outputDir, "start-frame.png"));
  fs.copyFileSync(config.end, path.join(outputDir, "end-frame.png"));

  // Upload frames
  console.log("\n📤 Uploading frames...");
  const startUrl = await uploadImage(config.start);
  console.log("  ✓ Start frame uploaded");
  const endUrl = await uploadImage(config.end);
  console.log("  ✓ End frame uploaded");

  // Check if we need 720p versions for Luma
  let startUrl720p = startUrl;
  let endUrl720p = endUrl;

  if (config.models.includes("luma")) {
    // Check for existing 720p versions
    const start720p = config.start.replace(".png", "-720p.png");
    const end720p = config.end.replace(".png", "-720p.png");

    if (fs.existsSync(start720p) && fs.existsSync(end720p)) {
      console.log("  📐 Using existing 720p frames for Luma");
      startUrl720p = await uploadImage(start720p);
      endUrl720p = await uploadImage(end720p);
    } else {
      console.log("  ⚠️ No 720p frames found for Luma - using original frames");
    }
  }

  // Generate with each model
  const results = {};

  for (const model of config.models) {
    const generator = generators[model];
    if (!generator) {
      console.log(`\n⚠️ Unknown model: ${model}, skipping`);
      continue;
    }

    console.log(`\n📹 Generating with ${modelNames[model] || model}...`);
    const startTime = Date.now();

    try {
      // Use 720p URLs for Luma
      const sUrl = model === "luma" ? startUrl720p : startUrl;
      const eUrl = model === "luma" ? endUrl720p : endUrl;

      const videoUrl = await generator(sUrl, eUrl, config.prompt, config);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (videoUrl) {
        await downloadVideo(videoUrl, path.join(outputDir, `${model}.mp4`));
        console.log(`  ✓ Completed in ${elapsed}s`);
        results[model] = { success: true, time: elapsed, url: videoUrl };
      } else {
        console.log(`  ✗ No video URL returned`);
        results[model] = { success: false, error: "No video URL" };
      }
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ✗ Error after ${elapsed}s: ${error.message}`);
      results[model] = { success: false, error: error.message };
    }
  }

  // Save results
  fs.writeFileSync(path.join(outputDir, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(outputDir, "index.html"), generateHTML(config, results));

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("RESULTS");
  console.log("=".repeat(70));

  for (const [model, result] of Object.entries(results)) {
    const status = result.success ? "✅" : "❌";
    const info = result.success ? `${result.time}s` : result.error;
    console.log(`${status} ${modelNames[model] || model}: ${info}`);
  }

  console.log(`\n📂 Output: ${outputDir}`);
  console.log(`🌐 View: http://localhost:3039/transition-${config.name}/index.html\n`);
}

main().catch(err => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
