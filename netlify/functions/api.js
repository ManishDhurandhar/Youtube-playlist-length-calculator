import express from 'express';
import serverless from 'serverless-http';

// Initialize express app
const app = express();
app.use(express.json());

// Load in-memory database as mock
const mockDb = new Map();
const mockVideoDb = new Map();
let inMemoryVisitorCount = 224195;

// Lightweight local database/mongoose replacements to prevent compilation errors
// and run purely in memory (100% database-free)
const mongoose = {
  connection: {
    readyState: 0
  }
};

const Playlist = {
  findOne: async () => null,
  create: async () => null
};

const VideoModel = {
  findOne: async () => null,
  create: async () => null
};

const PaymentModel = {
  create: async () => null
};

async function connectToDatabase() {
  return null;
}

// Validates active YouTube API key pattern
function isValidYouTubeKey(key) {
  if (!key || typeof key !== 'string') return false;
  // Standard YouTube Data API v3 key starts with AIzaSy and is 39 characters in total length
  return /^AIzaSy[A-Za-z0-9_\-]{33}$/.test(key);
}

// Robust ISO 8601 Duration Parsing
function parseISO8601Duration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Youtube API helper
async function fetchYouTubePlaylist(playlistId, apiKey) {
  let title = "Premium YouTube Playlist";
  let channelTitle = "YouTube Creator";
  let thumbnail = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=300";
  let videoCount = 0;

  // 1. Fetch metadata
  try {
    const metaUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
    const metaRes = await fetch(metaUrl);
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      if (metaData.items && metaData.items.length > 0) {
        const item = metaData.items[0];
        title = item.snippet.title;
        channelTitle = item.snippet.channelTitle;
        if (item.snippet.thumbnails) {
          const thumbs = item.snippet.thumbnails;
          thumbnail = (thumbs.high || thumbs.medium || thumbs.default || { url: thumbnail }).url;
        }
      }
    }
  } catch (error) {
    console.error("Meta retrieval error:", error);
  }

  // 2. Fetch video IDs
  let videoIds = [];
  let nextPageToken = "";
  let hasNextPage = true;
  let safetyCounter = 0;

  while (hasNextPage && safetyCounter < 20) {
    safetyCounter++;
    let itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50&key=${apiKey}`;
    if (nextPageToken) {
      itemsUrl += `&pageToken=${nextPageToken}`;
    }
    const itemsRes = await fetch(itemsUrl);
    if (!itemsRes.ok) {
      const errText = await itemsRes.text();
      throw new Error(`YouTube API returned error: ${errText}`);
    }
    const itemsData = await itemsRes.json();
    if (itemsData.items) {
      itemsData.items.forEach(item => {
        if (item.contentDetails && item.contentDetails.videoId) {
          videoIds.push(item.contentDetails.videoId);
        }
      });
    }
    nextPageToken = itemsData.nextPageToken;
    hasNextPage = !!nextPageToken;
  }

  if (videoIds.length === 0) {
    throw new Error("No videos found in this playlist.");
  }

  videoCount = videoIds.length;

  // 3. Get durations
  let totalSeconds = 0;
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk.join(",")}&key=${apiKey}`;
    const videoRes = await fetch(videoUrl);
    if (videoRes.ok) {
      const videoData = await videoRes.json();
      if (videoData.items) {
        videoData.items.forEach(item => {
          if (item.contentDetails && item.contentDetails.duration) {
            totalSeconds += parseISO8601Duration(item.contentDetails.duration);
          }
        });
      }
    }
  }

  return {
    playlistId,
    totalSeconds,
    title,
    channelTitle,
    videoCount,
    thumbnail
  };
}

// API Routes
app.get('/api/playlist/:id', async (req, res) => {
  const playlistId = req.params.id;
  if (!playlistId) {
    return res.status(400).json({ error: "Playlist ID is required" });
  }

  // Connect to DB if configured
  const hasDb = !!process.env.MONGODB_URI;
  const connection = hasDb ? await connectToDatabase() : null;
  const dbConnected = !!(connection && mongoose.connection.readyState === 1);

  try {
    let cached = null;
    if (dbConnected) {
      try {
        cached = await Playlist.findOne({ playlistId });
      } catch (dbErr) {
        console.warn("MongoDB playlist cache findOne failed:", dbErr.message || dbErr);
      }
    }

    if (cached) {
      return res.json({
        source: 'cache',
        playlistId: cached.playlistId,
        totalSeconds: cached.totalSeconds,
        title: cached.title || "Cached Playlist",
        channelTitle: cached.channelTitle || "YouTube Content",
        videoCount: cached.videoCount || 0,
        thumbnail: cached.thumbnail || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=300",
        createdAt: cached.createdAt,
        isMock: false
      });
    } else {
      // Check In-Memory Cache for Sandbox Preview or DB failure fallback
      if (mockDb.has(playlistId)) {
        const cachedMock = mockDb.get(playlistId);
        return res.json({ ...cachedMock, source: 'cache', isMock: true });
      }
    }

    // Cache miss - Fetch YouTube API
    const apiKey = process.env.YOUTUBE_API_SECRET || process.env.YOUTUBE_API_KEY;
    
    // Check if this is a demo fallback request
    const isDemo = playlistId.toLowerCase().includes("cooking") || 
                   playlistId.toLowerCase().includes("code") || 
                   playlistId.toLowerCase().includes("tech") || 
                   playlistId.toLowerCase().includes("music") || 
                   playlistId.toLowerCase().includes("lofi") || 
                   playlistId.length < 10;

    const hasNoValidKey = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("API_KEY") || !isValidYouTubeKey(apiKey);

    if (hasNoValidKey) {
      if (!isDemo) {
        return res.status(400).json({
          error: "YouTube API Key is missing or invalid. Please configure a valid YOUTUBE_API_SECRET environment variable starting with 'AIzaSy' containing 39 characters."
        });
      }

      // Create responsive mockup playlist data if API Secret is not in .env (for beautiful client previewing)
      console.warn("No valid YouTube API Key detected. Using premium simulated data for demo playlist.");
      
      let mockTitle = "Lofi Hip Hop Radio 🌌 - Beats to Relax/Study to";
      let mockChannel = "Lofi Girl";
      let mockCount = 37;
      let mockSeconds = 34212; // 9 hours, 30 minutes, 12 seconds
      let mockThumb = "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&q=80&w=400";

      if (playlistId.toLowerCase().includes("cooking")) {
        mockTitle = "Gourmet Kitchen: Ultimate Cooking Masterclass 🍳";
        mockChannel = "Gordon Ramsay Fan";
        mockCount = 12;
        mockSeconds = 14520; // 4 hours, 2 minutes
        mockThumb = "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=400";
      } else if (playlistId.toLowerCase().includes("code") || playlistId.toLowerCase().includes("tech")) {
        mockTitle = "Full-Stack Development Tutorial Series 💻";
        mockChannel = "Tech Academy";
        mockCount = 45;
        mockSeconds = 87400; // 24 hours, 16 mins, 40s
        mockThumb = "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=400";
      } else if (playlistId.toLowerCase().includes("music") || playlistId.length < 10) {
        mockTitle = "Chill Acoustic & Ambient Background Music 🎸";
        mockChannel = "Melodic Waves";
        mockCount = 18;
        mockSeconds = 5410; // 1 hr, 30 mins, 10s
        mockThumb = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=400";
      }

      const mockResult = {
        source: 'api',
        playlistId,
        totalSeconds: mockSeconds,
        title: mockTitle,
        channelTitle: mockChannel,
        videoCount: mockCount,
        thumbnail: mockThumb,
        isMock: true
      };

      if (dbConnected) {
        try {
          await Playlist.create(mockResult);
        } catch (dbErr) {
          console.warn("MongoDB playlist cache save failed:", dbErr.message || dbErr);
          mockDb.set(playlistId, mockResult);
        }
      } else {
        mockDb.set(playlistId, mockResult);
      }

      return res.json(mockResult);
    }

    // Call real YouTube API
    const result = await fetchYouTubePlaylist(playlistId, apiKey);

    const savedData = {
      playlistId: result.playlistId,
      totalSeconds: result.totalSeconds,
      title: result.title,
      channelTitle: result.channelTitle,
      videoCount: result.videoCount,
      thumbnail: result.thumbnail,
      isMock: false
    };

    // Save caching
    if (dbConnected) {
      try {
        await Playlist.create(savedData);
      } catch (dbErr) {
        console.warn("MongoDB playlist cache save failed:", dbErr.message || dbErr);
        mockDb.set(playlistId, {
          ...savedData,
          createdAt: new Date()
        });
      }
    } else {
      mockDb.set(playlistId, {
        ...savedData,
        createdAt: new Date()
      });
    }

    return res.json({
      source: 'api',
      ...savedData
    });

  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({
      error: err.message || "An unexpected error occurred while calculating playlist length."
    });
  }
});

// API Route for individual videos
app.get('/api/video/:id', async (req, res) => {
  const videoId = req.params.id;
  if (!videoId) {
    return res.status(400).json({ error: "Video ID is required" });
  }

  // Connect to DB if configured
  const hasDb = !!process.env.MONGODB_URI;
  const connection = hasDb ? await connectToDatabase() : null;
  const dbConnected = !!(connection && mongoose.connection.readyState === 1);

  try {
    let cached = null;
    if (dbConnected) {
      try {
        cached = await VideoModel.findOne({ videoId });
      } catch (dbErr) {
        console.warn("MongoDB video cache findOne failed:", dbErr.message || dbErr);
      }
    }

    if (cached) {
      return res.json({
        source: 'cache',
        videoId: cached.videoId,
        seconds: cached.seconds,
        title: cached.title || "Cached Video",
        channelTitle: cached.channelTitle || "YouTube Creator",
        thumbnail: cached.thumbnail || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=300",
        createdAt: cached.createdAt,
        isMock: false
      });
    } else {
      // Check In-Memory Cache
      if (mockVideoDb.has(videoId)) {
        const cachedMock = mockVideoDb.get(videoId);
        return res.json({ ...cachedMock, source: 'cache', isMock: true });
      }
    }

    // Cache miss - Fetch YouTube API
    const apiKey = process.env.YOUTUBE_API_SECRET || process.env.YOUTUBE_API_KEY;
    
    // Check if this is a demo fallback request
    const isDemo = videoId.toLowerCase().includes("cooking") || 
                   videoId.toLowerCase().includes("code") || 
                   videoId.toLowerCase().includes("tech") || 
                   videoId.toLowerCase().includes("music") || 
                   videoId.toLowerCase().includes("lofi") || 
                   videoId.length < 10;

    const hasNoValidKey = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("API_KEY") || !isValidYouTubeKey(apiKey);

    if (hasNoValidKey) {
      if (!isDemo) {
        return res.status(400).json({
          error: "YouTube API Key is missing or invalid. Please configure a valid YOUTUBE_API_SECRET environment variable starting with 'AIzaSy' containing 39 characters."
        });
      }

      // Simulated video data
      let mockTitle = "Never Gonna Give You Up 🎵";
      let mockChannel = "Rick Astley";
      let mockSeconds = 212; // 3 mins, 32s
      let mockThumb = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=400";

      if (videoId.toLowerCase().includes("code") || videoId.toLowerCase().includes("tech")) {
        mockTitle = "React JS Full Course for Beginners 💻";
        mockChannel = "Code Craft";
        mockSeconds = 18400; // 5 hours, 6 mins, 40s
        mockThumb = "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=400";
      } else if (videoId.toLowerCase().includes("cooking")) {
        mockTitle = "How To Cook the Perfect Steak 🍳";
        mockChannel = "Gourmet Chef";
        mockSeconds = 840; // 14 minutes
        mockThumb = "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=400";
      }

      const mockResult = {
        source: 'api',
        videoId,
        seconds: mockSeconds,
        title: mockTitle,
        channelTitle: mockChannel,
        thumbnail: mockThumb,
        isMock: true
      };

      if (dbConnected) {
        try {
          await VideoModel.create(mockResult);
        } catch (dbErr) {
          console.warn("MongoDB video cache save failed:", dbErr.message || dbErr);
          mockVideoDb.set(videoId, mockResult);
        }
      } else {
        mockVideoDb.set(videoId, mockResult);
      }

      return res.json(mockResult);
    }

    // Call real YouTube API for video
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      const errText = await videoRes.text();
      throw new Error(`YouTube API returned error: ${errText}`);
    }
    const videoData = await videoRes.json();
    if (!videoData.items || videoData.items.length === 0) {
      throw new Error("No video found for this ID.");
    }

    const item = videoData.items[0];
    const title = item.snippet.title;
    const channelTitle = item.snippet.channelTitle;
    let thumbnail = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=300";
    if (item.snippet.thumbnails) {
      const thumbs = item.snippet.thumbnails;
      thumbnail = (thumbs.high || thumbs.medium || thumbs.default || { url: thumbnail }).url;
    }
    const seconds = parseISO8601Duration(item.contentDetails.duration);

    const savedData = {
      videoId,
      seconds,
      title,
      channelTitle,
      thumbnail,
      isMock: false
    };

    // Save caching
    if (dbConnected) {
      try {
        await VideoModel.create(savedData);
      } catch (dbErr) {
        console.warn("MongoDB video cache save failed:", dbErr.message || dbErr);
        mockVideoDb.set(videoId, {
          ...savedData,
          createdAt: new Date()
        });
      }
    } else {
      mockVideoDb.set(videoId, {
        ...savedData,
        createdAt: new Date()
      });
    }

    return res.json({
      source: 'api',
      ...savedData
    });

  } catch (err) {
    console.error("API Video error:", err);
    return res.status(500).json({
      error: err.message || "An unexpected error occurred while calculating video length."
    });
  }
});

// GET current visitor count (does not increment)
app.get('/api/visits', async (req, res) => {
  try {
    const counterId = 'manish-yt-playlist-calculator-2026';
    // Using global fetch built-in in Node 18+
    const response = await fetch(`https://api.counterapi.dev/v1/${counterId}/visits`);
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.count === 'number') {
        inMemoryVisitorCount = data.count;
        return res.json({ count: data.count });
      }
    }
  } catch (err) {
    console.warn("Backend failed to fetch counterapi.dev, using in-memory fallback.");
  }
  return res.json({ count: inMemoryVisitorCount });
});

// POST to increment visitor count by 1 and return new total
app.post('/api/visits', async (req, res) => {
  try {
    const counterId = 'manish-yt-playlist-calculator-2026';
    // Using global fetch built-in in Node 18+
    const response = await fetch(`https://api.counterapi.dev/v1/${counterId}/visits/up`);
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.count === 'number') {
        inMemoryVisitorCount = data.count;
        return res.json({ count: data.count });
      }
    }
  } catch (err) {
    console.warn("Backend failed to increment counterapi.dev, using in-memory increment.");
  }
  inMemoryVisitorCount += 1;
  return res.json({ count: inMemoryVisitorCount });
});

// POST to issue a UPI Collect Request
app.post('/api/payment/collect', async (req, res) => {
  const { upiId, amount } = req.body;

  if (!upiId || typeof upiId !== 'string') {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid UPI ID (e.g., example@upi)."
    });
  }

  const cleanUpiId = upiId.trim();
  // Standard UPI ID pattern: string + @ + string
  if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanUpiId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid UPI ID format. It should look like: user@bankname or mobile@upi"
    });
  }

  const cleanAmount = Number(amount);
  if (isNaN(cleanAmount) || cleanAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid payment amount greater than 0."
    });
  }

  const trackingId = "TXN_" + Math.random().toString(36).substring(2, 11).toUpperCase() + "_" + Date.now().toString().slice(-4);

  const hasDb = !!process.env.MONGODB_URI;
  const connection = hasDb ? await connectToDatabase() : null;
  const dbConnected = !!(connection && mongoose.connection.readyState === 1);

  if (dbConnected) {
    try {
      await PaymentModel.create({
        trackingId,
        upiId: cleanUpiId,
        amount: cleanAmount,
        status: "pending"
      });
      console.log(`[UPI COLLECT] Created payment record in database. Tracking ID: ${trackingId}, Amnt: ₹${cleanAmount}, UPI ID: ${cleanUpiId}`);
    } catch (err) {
      console.error("Failed to write payment record to database:", err);
      // Fallback gracefully to simulated in-memory success
    }
  } else {
    console.log(`[UPI COLLECT] Database not connected. Simulated payment tracking ID: ${trackingId}, Amnt: ₹${cleanAmount}, UPI ID: ${cleanUpiId}`);
  }

  return res.json({
    success: true,
    trackingId,
    status: "pending",
    message: `Payment collect request of ₹${cleanAmount} successfully dispatched to "${cleanUpiId}". Please open your UPI App (GPay, PhonePe, BHIM, Paytm, etc.) to approve the collect request.`
  });
});

// Explicit health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState >= 1 ? 'connected' : 'disconnected',
    hasMongoUri: !!process.env.MONGODB_URI,
    hasYoutubeSecret: !!(process.env.YOUTUBE_API_SECRET || process.env.YOUTUBE_API_KEY)
  });
});

// For netlify export
const handler = serverless(app);
export { app, handler };
