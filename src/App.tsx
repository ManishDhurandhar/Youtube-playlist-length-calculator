import React, { useState, useEffect } from "react";
// @ts-ignore
import { motion, AnimatePresence } from "motion/react";
import { Helmet } from "react-helmet-async";
import {
  Clock,
  Coffee,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  Youtube,
  Heart,
  Sparkles,
  Database,
  Search,
  X,
  Play,
  TrendingUp,
  AlertCircle,
  Sun,
  Moon,
  Trash2,
  Sliders,
  Calendar,
  Layers,
  HelpCircle,
  ArrowLeft,
  SlidersHorizontal,
  Plus,
  Github,
  Twitter,
  Globe,
  Award
} from "lucide-react";

interface AnalyzedItem {
  id: string;
  type: "playlist" | "video";
  title: string;
  channelTitle: string;
  thumbnail: string;
  totalSeconds: number;
  videoCount: number;
  source: "cache" | "api";
  checked: boolean;
  startVideo: number; // For range analysis (1-indexed)
  endVideo: number;   // For range analysis (1-indexed)
}

const humorTexts = [
  "Calculating total duration...",
  "Gathering video metrics...",
  "Formatting speed coefficients...",
  "Checking local cache...",
  "Analyzing ranges seamlessly..."
];

export default function App() {
  // Page selector ('calculator' or 'coffee')
  const [activePage, setActivePage] = useState<"calculator" | "coffee">("calculator");

  // Mode state ('dark' or 'light')
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("tubetimer-theme") as "dark" | "light") || "dark";
  });

  // Inputs
  const [inputMode, setInputMode] = useState<"single" | "bulk">("single");
  const [singleInput, setSingleInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  
  // Analytics processing
  const [loading, setLoading] = useState(false);
  const [humorIndex, setHumorIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Workbench of analyzed playlists and videos
  const [analyzedItems, setAnalyzedItems] = useState<AnalyzedItem[]>([]);

  // Speed multiplier state
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [customSpeedInput, setCustomSpeedInput] = useState<string>("1.0");

  // Live visitor count state
  const [visitorCount, setVisitorCount] = useState<number>(224195);

  // Live Visitor count effect
  useEffect(() => {
    fetch("/api/visits", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to post visit");
        return res.json();
      })
      .then((data) => {
        if (data && typeof data.count === "number") {
          setVisitorCount(data.count);
        }
      })
      .catch((err) => {
        console.error("Live visits count error:", err);
      });
  }, []);

  // Buy me a coffee states
  const [supportAmount, setSupportAmount] = useState<number>(50);
  const [customAmountText, setCustomAmountText] = useState("50");
  const [isCopied, setIsCopied] = useState(false);

  // Theme Sync effect
  useEffect(() => {
    localStorage.setItem("tubetimer-theme", theme);
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [theme]);

  // Loading text cycling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setHumorIndex(0);
      interval = setInterval(() => {
        setHumorIndex((prev) => (prev + 1) % humorTexts.length);
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  // Handle support presets in the Coffee view
  const handleSupportPreset = (amount: number) => {
    setSupportAmount(amount);
    setCustomAmountText(amount.toString());
  };

  const handleCustomSupportChange = (val: string) => {
    setCustomAmountText(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setSupportAmount(parsed);
    } else {
      setSupportAmount(0);
    }
  };

  const copyUPIId = () => {
    navigator.clipboard.writeText(upiId);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  // Helper to parse complex/multiple YouTube URLs or IDs
  const parseInputs = (inputText: string): { type: "playlist" | "video"; id: string }[] => {
    if (!inputText) return [];
    
    const tokens = inputText.split(/[,\n\s]+/).map(t => t.trim()).filter(Boolean);
    const parsedTokens: { type: "playlist" | "video"; id: string }[] = [];

    tokens.forEach(token => {
      try {
        if (token.startsWith("http") || token.includes("youtube.com") || token.includes("youtu.be")) {
          const urlObj = new URL(token.startsWith("http") ? token : `https://${token}`);
          
          const listParam = urlObj.searchParams.get("list");
          if (listParam) {
            parsedTokens.push({ type: "playlist", id: listParam });
            return;
          }
          
          const vParam = urlObj.searchParams.get("v");
          if (vParam) {
            parsedTokens.push({ type: "video", id: vParam });
            return;
          }
          
          if (urlObj.hostname === "youtu.be" || urlObj.hostname.endsWith("youtu.be")) {
            const pathId = urlObj.pathname.slice(1);
            if (pathId) {
              parsedTokens.push({ type: "video", id: pathId });
              return;
            }
          }
        }
      } catch (err) {
        // Safe query parser fallback
      }

      if (token.startsWith("PL") || token.length >= 18) {
        parsedTokens.push({ type: "playlist", id: token });
      } else if (token.length >= 8) {
        parsedTokens.push({ type: "video", id: token });
      }
    });

    return parsedTokens;
  };

  // Aggregated analytics resolver
  const runAnalysis = async (inputText: string) => {
    const targets = parseInputs(inputText);
    if (targets.length === 0) {
      setError("Invalid link format");
      return;
    }

    setLoading(true);
    setError(null);

    const successfulItems: AnalyzedItem[] = [];
    let failures = 0;

    for (const target of targets) {
      try {
        const isPlaylist = target.type === "playlist";
        const endpoint = isPlaylist ? `/api/playlist/${target.id}` : `/api/video/${target.id}`;
        
        const response = await fetch(endpoint);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Could not fetch ${target.type}`);
        }

        const data = await response.json();

        const item: AnalyzedItem = {
          id: target.id,
          type: target.type,
          title: data.title || (isPlaylist ? "Slick Playlist Support" : "Fine Video Target"),
          channelTitle: data.channelTitle || "YouTube Creator",
          thumbnail: data.thumbnail || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=400",
          totalSeconds: isPlaylist ? (data.totalSeconds || 0) : (data.seconds || 0),
          videoCount: isPlaylist ? (data.videoCount || 1) : 1,
          source: data.source || "api",
          checked: true,
          startVideo: 1,
          endVideo: isPlaylist ? (data.videoCount || 1) : 1
        };

        successfulItems.push(item);
      } catch (err: any) {
        console.error("Fetch failure for: ", target.id, err);
        failures++;
      }
    }

    if (successfulItems.length > 0) {
      setAnalyzedItems(successfulItems);
      setPlaybackSpeed(1.0);
      setCustomSpeedInput("1.0");
      setSingleInput("");
      setBulkInput("");
    }

    if (failures === targets.length) {
      setError("Failed to fetch information. Please check your internet connection or check if the YouTube URL/ID is correct.");
    } else if (failures > 0) {
      setError(`Caution: Skipped ${failures} items due to retrieval errors.`);
    }

    setLoading(false);
  };

  // Sliced calculations helper
  const getItemSeconds = (item: AnalyzedItem) => {
    if (item.type === "video") return item.totalSeconds;
    const sliceCount = item.endVideo - item.startVideo + 1;
    if (sliceCount <= 0 || item.videoCount <= 0) return 0;
    const fraction = sliceCount / item.videoCount;
    return Math.round(item.totalSeconds * fraction);
  };

  const checkedItems = analyzedItems.filter(i => i.checked);
  
  const totalSeconds = checkedItems.reduce((acc, item) => {
    return acc + getItemSeconds(item);
  }, 0);

  const totalVideos = checkedItems.reduce((acc, item) => {
    if (item.type === "video") return acc + 1;
    const sliceCount = item.endVideo - item.startVideo + 1;
    return acc + (sliceCount > 0 ? sliceCount : 0);
  }, 0);

  const averageVideoSeconds = totalVideos > 0 ? Math.round(totalSeconds / totalVideos) : 0;

  const calculateDuration = (sec: number, speed: number) => {
    const adjustedSecs = Math.max(0, Math.round(sec / speed));
    const h = Math.floor(adjustedSecs / 3600);
    const m = Math.floor((adjustedSecs % 3600) / 60);
    const s = adjustedSecs % 60;
    return { hours: h, minutes: m, seconds: s };
  };

  const activeResult = calculateDuration(totalSeconds, playbackSpeed);

  const handleCustomSpeedRange = (val: number) => {
    setPlaybackSpeed(val);
    setCustomSpeedInput(val.toFixed(2));
  };

  const handleCustomSpeedTextChange = (val: string) => {
    setCustomSpeedInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 10.0) {
      setPlaybackSpeed(parsed);
    }
  };

  const updateItemRange = (id: string, start: number, end: number, max: number) => {
    setAnalyzedItems(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const cleanStart = Math.max(1, Math.min(start, max));
          const cleanEnd = Math.max(cleanStart, Math.min(end, max));
          return {
            ...item,
            startVideo: cleanStart,
            endVideo: cleanEnd
          };
        }
        return item;
      });
    });
  };

  const deleteItem = (id: string) => {
    setAnalyzedItems(prev => prev.filter(i => i.id !== id));
  };

  const clearDatabase = () => {
    setAnalyzedItems([]);
    setError(null);
  };

  const upiId = "manishdhurandharbob@ybl";
  const upiLink = `upi://pay?pa=${upiId}&pn=Manish&am=${supportAmount}&cu=INR&tn=Coffee%20for%20Manish`;

  return (
    <div className={`relative min-h-screen w-full font-sans overflow-x-hidden flex flex-col justify-between transition-colors duration-300 ${
      theme === "dark" ? "bg-[#0b0c10] text-zinc-100" : "bg-[#f5f5f7] text-zinc-800"
    }`}>
      
      <Helmet>
        <title>YouTube Playlist Length Calculator - Fast Duration & Speed Analyzer</title>
        <meta name="description" content="Calculate playback duration of any YouTube playlist instantly with optional caching. Sift ranges, slice video lists, select custom speeds, and view aggregated duration metrics." />
        <meta name="keywords" content="youtube playlist length, yt playlist length, playlist duration, watch hours calculator, study helper" />
        
        {/* Open Graph Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="YouTube Playlist Length Calculator" />
        <meta property="og:description" content="Calculate playback duration of any YouTube playlist instantly with optional caching. Customize speeds, slice segment indexes, and plan studies." />
        <meta property="og:image" content="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=800" />
        
        {/* Twitter Card Details */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="YouTube Playlist Length Calculator" />
        <meta property="twitter:description" content="Instantly analyze how long your favorite playlists are, adjust playback speed, and slice video segments." />
        <meta property="twitter:image" content="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=800" />
      </Helmet>
      
      {/* Sleek, minimalistic glow effects resembling macOS dark background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {theme === "dark" ? (
          <>
            <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
            <div className="absolute bottom-10 left-10 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[120px]" />
          </>
        ) : (
          <>
            <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-purple-500/2 blur-[80px]" />
            <div className="absolute bottom-10 left-10 w-[500px] h-[500px] rounded-full bg-blue-500/2 blur-[100px]" />
          </>
        )}
      </div>

      {/* Top Application Bar with clean Apple alignment */}
      <nav className={`z-10 px-4 sm:px-8 py-3.5 flex justify-between items-center border-b backdrop-blur-md transition-all ${
        theme === "dark" ? "border-zinc-800 bg-[#0b0c10]/85" : "border-zinc-200 bg-white/90"
      }`}>
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActivePage("calculator")}>
          <img src="/ytplaylistlengthcalculatorlogo.png" alt="YT Playlist Logo" className="w-6 h-6 object-contain rounded-md" referrerPolicy="no-referrer" />
          <span className={`text-[11.5px] font-extrabold uppercase tracking-wider ${
            theme === "dark" ? "text-zinc-100" : "text-zinc-900"
          }`}>
            YT Playlist Length
          </span>
        </div>
        
        {/* Navigation Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActivePage(activePage === "calculator" ? "coffee" : "calculator")}
            className={`text-xs px-3.5 py-1.5 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              activePage === "coffee"
                ? theme === "dark"
                  ? "bg-white text-black border-transparent"
                  : "bg-zinc-900 text-white border-transparent"
                : theme === "dark"
                ? "border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-900"
                : "border-zinc-250 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100"
            }`}
          >
            <Coffee className="w-3.5 h-3.5 text-orange-500 fill-orange-500/10" />
            <span>{activePage === "coffee" ? "Home Calculator" : "Buy me a coffee"}</span>
          </button>

          {/* Theme Toggler */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              theme === "dark"
                ? "border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900"
                : "border-zinc-250 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100"
            }`}
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-750" />}
          </button>
        </div>
      </nav>

      {/* Pages Router Switch */}
      <AnimatePresence mode="wait">
        
        {activePage === "calculator" ? (
          
          /* VIEW 1: ADVANCED TIMER CALCULATOR (Apple style clean workspace) */
          <motion.main
            key="calculator-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="z-10 flex-grow w-full max-w-2xl mx-auto px-4 py-6 md:py-8 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-5 w-full">
              
              <div className="space-y-0.5">
                <h1 className={`text-xs font-bold uppercase tracking-widest ${
                  theme === "dark" ? "text-zinc-200" : "text-zinc-850"
                }`}>
                  Youtube Playlist length calculator
                </h1>
                <p className={`text-[11px] font-semibold ${
                  theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                }`}>
                  Calculate playback durations instantly for quick planning.
                </p>
              </div>

              {/* Input Card Container - Promoted to the top for optimal UX */}
              <div className={`rounded-xl border transition-all overflow-hidden shadow-sm ${
                theme === "dark" 
                  ? "bg-[#111216] border-zinc-800" 
                  : "bg-white border-zinc-300 ring-2 ring-red-600/5"
              }`}>
                {/* Mode Selector Tabs */}
                <div className={`flex border-b ${theme === "dark" ? "border-zinc-800 bg-[#0d0e12]" : "border-zinc-200 bg-zinc-50"}`}>
                  <button
                    onClick={() => setInputMode("single")}
                    className={`flex-1 py-3 text-xs font-extrabold tracking-wide transition-all cursor-pointer ${
                      inputMode === "single"
                        ? theme === "dark"
                          ? "text-white border-b-2 border-red-500 bg-zinc-900/40"
                          : "text-zinc-950 border-b-2 border-red-600 bg-white"
                        : theme === "dark"
                        ? "text-zinc-400 hover:text-zinc-200"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    <span>⌨️ Single Link / ID</span>
                  </button>
                  <button
                    onClick={() => setInputMode("bulk")}
                    className={`flex-1 py-3 text-xs font-extrabold tracking-wide transition-all cursor-pointer ${
                      inputMode === "bulk"
                        ? theme === "dark"
                          ? "text-white border-b-2 border-red-500 bg-zinc-900/40"
                          : "text-zinc-950 border-b-2 border-red-600 bg-white"
                        : theme === "dark"
                        ? "text-zinc-400 hover:text-zinc-200"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    <span>📋 Bulk Paste / Multi-Link</span>
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {inputMode === "single" ? (
                    <div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (singleInput.trim()) runAnalysis(singleInput);
                        }}
                        className="flex flex-col sm:flex-row gap-2"
                      >
                        <input
                          type="text"
                          placeholder="Paste YouTube playlist URL, video URL, or ID here..."
                          className={`flex-grow px-3 py-2 text-xs rounded-lg outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-mono font-medium ${
                            theme === "dark" ? "bg-zinc-900 text-zinc-100 border border-zinc-800" : "bg-zinc-50 text-zinc-900 border border-zinc-300"
                          }`}
                          value={singleInput}
                          onChange={(e) => setSingleInput(e.target.value)}
                        />
                        <button
                          type="submit"
                          disabled={loading || !singleInput.trim()}
                          className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 whitespace-nowrap min-h-[36px] shadow-sm cursor-pointer ${
                            theme === "dark"
                              ? "bg-white text-black hover:bg-zinc-100"
                              : "bg-red-600 text-white hover:bg-red-700"
                          }`}
                        >
                          {loading ? (
                            <span className="flex items-center gap-1.5 font-bold">
                              <span className="animate-spin border-2 border-current/30 border-t-current rounded-full w-3 h-3" />
                              <span>Calculating...</span>
                            </span>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Calculate Duration</span>
                            </>
                          )}
                        </button>
                      </form>
                      <p className={`text-[10px] mt-1.5 font-mono font-bold ${
                        theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                      }`}>
                        Fits playlist URLs, individual video watch links, or short clip IDs.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        rows={3}
                        placeholder="Paste links / IDs separated by spaces or lines (e.g. PLu0W_..., dQw4w9W...)"
                        className={`w-full p-3 text-xs rounded-lg outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-mono resize-y font-medium ${
                          theme === "dark" ? "bg-zinc-900 text-zinc-100 border border-zinc-800" : "bg-zinc-50 text-zinc-900 border border-zinc-300"
                        }`}
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                      />
                      <div className="flex justify-between items-center mt-2">
                        <button
                          onClick={() => setBulkInput("")}
                          className={`text-[10px] font-bold transition-all cursor-pointer ${
                            theme === "dark" ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-600 hover:text-zinc-950"
                          }`}
                        >
                          Clear Textarea
                        </button>
                        <button
                          onClick={() => {
                            if (bulkInput.trim()) runAnalysis(bulkInput);
                          }}
                          disabled={loading || !bulkInput.trim()}
                          className={`px-4 py-1.5 rounded-lg font-bold text-xs tracking-wide transition-all flex items-center gap-1 cursor-pointer ${
                            theme === "dark"
                              ? "bg-white text-black hover:bg-zinc-100"
                              : "bg-zinc-950 text-white hover:bg-zinc-800"
                          }`}
                        >
                          {loading ? (
                            <span className="animate-pulse">Analyzing...</span>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Import All</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PRIMARY VISUAL DASHBOARD - Simplified & Shrunk into a clean, space-saving layout */}
              <section className={`p-4 rounded-xl border transition-all ${
                theme === "dark" 
                  ? "bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800 text-zinc-100 shadow-lg" 
                  : "bg-gradient-to-br from-white to-zinc-100 border-zinc-200 shadow-xs text-zinc-800"
              }`}>
                {analyzedItems.length === 0 ? (
                  <div className={`text-center py-2 text-[11.5px] font-bold flex items-center justify-center gap-1.5 ${
                    theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                  }`}>
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Stats and slicing options will appear here once you paste your link above.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between gap-2 border-b pb-1.5 ${
                      theme === "dark" ? "border-zinc-800/60" : "border-zinc-200"
                    }`}>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                        theme === "dark" ? "text-zinc-300" : "text-zinc-800"
                      }`}>
                        <Clock className="w-3.5 h-3.5 text-red-650" />
                        <span>Watch Summary Statistics</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {analyzedItems.length > 0 && (
                          <button
                            onClick={clearDatabase}
                            className={`text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors ${
                              theme === "dark" ? "text-zinc-400 hover:text-red-400" : "text-zinc-550 hover:text-red-650"
                            }`}
                            title="Clear Playlists"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear</span>
                          </button>
                        )}
                        <span className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full ${
                          theme === "dark" ? "bg-zinc-800 text-zinc-200" : "bg-zinc-100 text-zinc-800"
                        }`}>
                          {totalVideos} Videos Selected
                        </span>
                      </div>
                    </div>

                    {/* Active Playlist & Video details list */}
                    <div className="space-y-1.5 pt-0.5">
                      {analyzedItems.map((item) => (
                        <div key={item.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${
                          theme === "dark" ? "bg-zinc-950/25 border-zinc-800/30" : "bg-zinc-50 border-zinc-205"
                        }`}>
                          <div className="min-w-0 flex-1 flex items-center gap-2.5">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                className="w-9 h-9 rounded-md object-cover shrink-0 shadow-xs border border-zinc-200/50 dark:border-zinc-800"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className={`text-[8px] font-extrabold px-1.5 py-2.5 rounded font-mono shrink-0 uppercase ${
                                item.type === "playlist"
                                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                              }`}>
                                {item.type.slice(0, 4)}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className={`text-[11px] font-bold truncate block ${
                                theme === "dark" ? "text-zinc-100" : "text-zinc-900"
                              }`}>
                                {item.title}
                              </span>
                              <p className="text-[9.5px]">
                                <span className={theme === "dark" ? "text-zinc-400 font-semibold" : "text-zinc-550 font-bold"}>by </span>
                                <span className={`font-bold ${theme === "dark" ? "text-zinc-200" : "text-zinc-750"}`}>{item.channelTitle}</span>
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className={`transition-all p-1 rounded cursor-pointer shrink-0 ${
                              theme === "dark" ? "text-zinc-500 hover:text-red-400" : "text-zinc-400 hover:text-red-655"
                            }`}
                            title="Remove from workspace"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Highly Compact Duration Countdown Readout */}
                    <div className={`flex flex-wrap items-center justify-between gap-3 py-2 px-2.5 rounded-lg border ${
                      theme === "dark" ? "bg-zinc-950/30 border-zinc-800/40" : "bg-zinc-50 border-zinc-200"
                    }`}>
                      <div className={`text-2xl font-black flex items-baseline gap-0.5 ${
                        theme === "dark" ? "text-white" : "text-zinc-900"
                      }`}>
                        {activeResult.hours > 0 && (
                          <span className="flex items-baseline">
                            {activeResult.hours}
                            <span className={`text-[10px] font-extrabold ml-0.5 mr-1 uppercase font-mono ${
                              theme === "dark" ? "text-zinc-400" : "text-zinc-650"
                            }`}>hr</span>
                          </span>
                        )}
                        <span className="flex items-baseline">
                          {activeResult.minutes}
                          <span className={`text-[10px] font-extrabold ml-0.5 mr-1 uppercase font-mono ${
                            theme === "dark" ? "text-zinc-400" : "text-zinc-650"
                          }`}>min</span>
                        </span>
                        <span className="flex items-baseline">
                          {activeResult.seconds}
                          <span className={`text-[10px] font-extrabold ml-0.5 uppercase font-mono ${
                            theme === "dark" ? "text-zinc-400" : "text-zinc-655"
                          }`}>sec</span>
                        </span>
                      </div>
                      
                      <div className={`text-[11px] font-bold ${
                        theme === "dark" ? "text-zinc-300" : "text-zinc-700"
                      }`}>
                        Average duration: <span className={`font-extrabold ${theme === "dark" ? "text-zinc-100" : "text-zinc-950"}`}>{totalSeconds > 0 ? `${Math.floor(averageVideoSeconds / 60)}m ${averageVideoSeconds % 60}s` : "0m"}</span>
                      </div>
                    </div>

                    {/* Playback items segment slicer inside the same compact widget */}
                    {analyzedItems.length > 0 && analyzedItems[0].type === "playlist" && (
                      <div className={`space-y-2 pt-1 border-t ${
                        theme === "dark" ? "border-zinc-800/50" : "border-zinc-200"
                      }`}>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-extrabold flex items-center gap-1 ${
                            theme === "dark" ? "text-zinc-300" : "text-zinc-800"
                          }`}>
                            <SlidersHorizontal className="w-3 h-3 text-red-650" />
                            <span>Segment Slices:</span>
                          </span>
                          <span className={`font-mono font-bold ${
                            theme === "dark" ? "text-zinc-200" : "text-zinc-750"
                          }`}>
                            Video #{analyzedItems[0].startVideo} to #{analyzedItems[0].endVideo} ({analyzedItems[0].endVideo - analyzedItems[0].startVideo + 1} Slices)
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                            theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                          }`}>
                            <span className={`text-[8.5px] uppercase font-extrabold ${
                              theme === "dark" ? "text-zinc-450" : "text-zinc-600"
                            }`}>Start #</span>
                            <input
                              type="number"
                              min={1}
                              max={analyzedItems[0].videoCount}
                              value={analyzedItems[0].startVideo}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                updateItemRange(analyzedItems[0].id, val, Math.max(val, analyzedItems[0].endVideo), analyzedItems[0].videoCount);
                              }}
                              className={`w-full text-center text-xs font-bold font-mono bg-transparent outline-none ${
                                theme === "dark" ? "text-white" : "text-zinc-950"
                              }`}
                            />
                          </div>

                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                            theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                          }`}>
                            <span className={`text-[8.5px] uppercase font-extrabold ${
                              theme === "dark" ? "text-zinc-450" : "text-zinc-600"
                            }`}>End #</span>
                            <input
                              type="number"
                              min={1}
                              max={analyzedItems[0].videoCount}
                              value={analyzedItems[0].endVideo}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || analyzedItems[0].videoCount;
                                updateItemRange(analyzedItems[0].id, Math.min(val, analyzedItems[0].startVideo), val, analyzedItems[0].videoCount);
                              }}
                              className={`w-full text-center text-xs font-bold font-mono bg-transparent outline-none ${
                                theme === "dark" ? "text-white" : "text-zinc-950"
                              }`}
                            />
                          </div>
                        </div>

                        {/* Standard responsive range sliders */}
                        <div className="grid grid-cols-2 gap-3 pb-1">
                          <input
                            type="range"
                            min={1}
                            max={analyzedItems[0].videoCount}
                            value={analyzedItems[0].startVideo}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                updateItemRange(analyzedItems[0].id, val, Math.max(val, analyzedItems[0].endVideo), analyzedItems[0].videoCount);
                            }}
                            className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-500"
                          />
                          <input
                            type="range"
                            min={1}
                            max={analyzedItems[0].videoCount}
                            value={analyzedItems[0].endVideo}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                updateItemRange(analyzedItems[0].id, Math.min(val, analyzedItems[0].startVideo), val, analyzedItems[0].videoCount);
                            }}
                            className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Integrated Playback Speed Customizer with range slider, text input and quick presets */}
                    <div className={`pt-2.5 border-t space-y-2.5 ${
                      theme === "dark" ? "border-zinc-800/60" : "border-zinc-200"
                    }`}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-extrabold uppercase tracking-wider block ${
                          theme === "dark" ? "text-zinc-350" : "text-zinc-700"
                        }`}>
                          ⚡ Speed Rate multiplier:
                        </span>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
                          theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-250"
                        }`}>
                          <input
                            type="text"
                            placeholder="e.g. 1.25"
                            value={customSpeedInput}
                            onChange={(e) => handleCustomSpeedTextChange(e.target.value)}
                            className={`w-12 text-center text-xs font-mono font-bold bg-transparent outline-none ${
                              theme === "dark" ? "text-white" : "text-zinc-950"
                            }`}
                          />
                          <span className="text-[10px] font-extrabold text-zinc-400 font-mono font-semibold">x</span>
                        </div>
                      </div>

                      {/* Speed Range Slider Bar */}
                      <div className="space-y-1">
                        <input
                          type="range"
                          min={0.25}
                          max={3.0}
                          step={0.05}
                          value={playbackSpeed}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPlaybackSpeed(val);
                            setCustomSpeedInput(val.toFixed(2));
                          }}
                          className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600 dark:accent-zinc-300"
                        />
                        <div className={`flex justify-between text-[8.5px] font-mono px-0.5 ${
                          theme === "dark" ? "text-zinc-500" : "text-zinc-600 font-bold"
                        }`}>
                          <span>0.25x</span>
                          <span>1.0x (Normal)</span>
                          <span>1.75x</span>
                          <span>2.5x</span>
                          <span>3.0x</span>
                        </div>
                      </div>

                      <div className={`flex gap-1 p-0.5 rounded-lg border ${
                        theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                      }`}>
                        {[1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
                          <button
                            key={spd}
                            onClick={() => {
                              setPlaybackSpeed(spd);
                              setCustomSpeedInput(spd.toFixed(2));
                            }}
                            className={`flex-1 py-1 text-[10.5px] font-bold rounded transition-all cursor-pointer ${
                              Math.abs(playbackSpeed - spd) < 0.01
                                ? theme === "dark"
                                  ? "bg-white text-black shadow-sm"
                                  : "bg-zinc-900 text-white shadow-xs"
                                : theme === "dark"
                                ? "text-zinc-400 hover:text-white"
                                : "text-zinc-600 hover:text-zinc-950"
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Status loading text line */}
              <AnimatePresence mode="wait">
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-500 font-mono italic font-semibold"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600"></span>
                    </span>
                    <span>{humorTexts[humorIndex]}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error alerts */}
              {error && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Note on Analysis</span>
                    <p className="text-xs opacity-95">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.main>
          
        ) : (
          
          /* VIEW 2: BUY ME A COFFEE (Clean Cupertino aesthetics) */
          <motion.main
            key="coffee-page"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="z-10 flex-grow w-full max-w-xl mx-auto px-4 py-8 flex justify-center items-center"
          >
            <div className={`w-full max-w-md rounded-2xl p-5 md:p-6 border relative overflow-hidden transition-all ${
              theme === "dark" ? "bg-[#121318] border-zinc-800 shadow-xl" : "bg-white border-zinc-200 shadow-md"
            }`}>
              
              {/* Back button */}
              <button
                onClick={() => setActivePage("calculator")}
                className={`absolute top-4 left-4 p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-extrabold ${
                  theme === "dark" 
                    ? "hover:bg-zinc-800 text-zinc-300 hover:text-white" 
                    : "hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950"
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Calculator</span>
              </button>

              <div className="text-center mt-6 mb-5 space-y-2">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-orange-500/10 text-orange-500">
                  <Coffee className="w-5 h-5 fill-orange-500" />
                </div>
                
                <h2 className={`text-base font-extrabold ${
                  theme === "dark" ? "text-zinc-100" : "text-zinc-950"
                }`}>
                  Support Developer
                </h2>

                <div className={`text-xs max-w-sm mx-auto ${
                  theme === "dark" ? "text-zinc-200 font-medium" : "text-zinc-950 font-black"
                }`}>
                  Made with ❤️ by{" "}
                  <a
                    href="https://manishdhurandhar.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline transition-colors ${
                      theme === "dark" ? "font-bold text-zinc-100 hover:text-red-400" : "font-black text-black hover:text-red-600"
                    }`}
                  >
                    Manish Dhurandhar
                  </a>
                </div>

                <p className={`text-[11px] max-w-xs mx-auto leading-normal font-semibold ${
                  theme === "dark" ? "text-zinc-400" : "text-zinc-650"
                }`}>
                  If this calculator saved your time, feel free to support serverless calculations and keep things fast and ad-free!
                </p>
              </div>

              {/* Support presets row */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[20, 50, 100, 200].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleSupportPreset(preset)}
                    className={`py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                      supportAmount === preset
                        ? theme === "dark"
                          ? "bg-white text-black border-white shadow-sm"
                          : "bg-zinc-900 text-white border-zinc-900"
                        : theme === "dark"
                        ? "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900"
                        : "border-zinc-250 bg-zinc-50 hover:bg-zinc-100 text-zinc-750"
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>

              {/* Exact Custom Amount field */}
              <div className="relative mb-4">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-mono font-bold">₹</span>
                <input
                  type="number"
                  placeholder="Custom Support Amount"
                  value={customAmountText}
                  onChange={(e) => handleCustomSupportChange(e.target.value)}
                  className={`w-full py-2.5 pl-7 pr-4 text-xs font-mono font-bold rounded-lg border outline-none focus:ring-1 focus:ring-zinc-400 ${
                    theme === "dark" ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-250 text-zinc-950"
                  }`}
                />
              </div>

              {/* Authentic UPI QR representation */}
              <div className={`p-3 rounded-xl mb-4 flex flex-col justify-center items-center border ${
                theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200 shadow-sm"
              } mx-auto max-w-[170px]`}>
                <img src="/qr.jpeg" alt="UPI QR Code" className="w-28 h-28 object-contain rounded opacity-95" referrerPolicy="no-referrer" />
                <p className={`text-[8.5px] font-extrabold font-mono tracking-wider mt-1.5 ${
                  theme === "dark" ? "text-zinc-300" : "text-zinc-700"
                }`}>
                  manishdhurandharbob@ybl
                </p>
              </div>

              {/* UPI address copy bar */}
              <div className={`flex items-center rounded-lg overflow-hidden border mb-4 ${
                theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"
              }`}>
                <div className={`flex-grow px-3 py-1.5 text-[10.5px] font-mono truncate font-bold ${
                  theme === "dark" ? "text-zinc-300" : "text-zinc-750"
                }`}>
                  {upiId}
                </div>
                <button
                  onClick={copyUPIId}
                  className={`px-3 py-2 hover:opacity-90 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer ${
                    theme === "dark" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-white"
                  }`}
                >
                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* Secure Transaction Link */}
              <button
                disabled={supportAmount <= 0}
                onClick={() => {
                  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                    window.location.href = upiLink;
                  } else {
                    alert(`UPI Gateway Redirecting! Action targets: ${upiId} to receive ₹${supportAmount}`);
                  }
                }}
                className={`w-full py-2.5 rounded-lg font-bold text-xs tracking-wide transition-all text-center cursor-pointer ${
                  supportAmount > 0
                    ? theme === "dark"
                      ? "bg-white text-black hover:bg-zinc-100"
                      : "bg-zinc-900 text-white hover:bg-zinc-805"
                    : theme === "dark"
                    ? "bg-zinc-800/10 text-zinc-500 cursor-not-allowed"
                    : "bg-zinc-200/50 text-zinc-400 cursor-not-allowed"
                }`}
              >
                Pay ₹{supportAmount} with UPI App Securely
              </button>

            </div>
          </motion.main>
        )}
      </AnimatePresence>

      {/* Static refined footer containing requested portfolio / git / x links */}
      <footer className="z-10 px-4 sm:px-8 py-5 flex flex-col items-center gap-3 mt-auto">
        <div className={`h-[1px] w-full max-w-5xl bg-gradient-to-r ${theme === "dark" ? "from-transparent via-zinc-800 to-transparent" : "from-transparent via-zinc-200 to-transparent"}`} />
        
        {/* Made with ❤️ by Manish Dhurandhar linked inline */}
        <div className={`text-[11.5px] flex flex-col items-center gap-1.5 ${
          theme === "dark" ? "text-zinc-400 font-bold" : "text-zinc-950 font-black"
        }`}>
          <span>
            Made with ❤️ by{" "}
            <a
              href="https://manishdhurandhar.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className={`font-black underline transition-all ${
                theme === "dark" ? "text-zinc-200 hover:text-red-400" : "text-zinc-950 hover:text-red-600"
              }`}
            >
              Manish Dhurandhar
            </a>
          </span>
          <button
            onClick={() => setActivePage("coffee")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] rounded-lg border font-extrabold cursor-pointer transition-all shadow-2xs ${
              theme === "dark"
                ? "border-zinc-800 bg-[#16171d] text-zinc-200 hover:text-white hover:bg-zinc-800 hover:border-zinc-700"
                : "border-zinc-250 bg-zinc-50 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 px-3.5"
            }`}
          >
            <Coffee className="w-3.5 h-3.5 text-orange-500 fill-orange-500/10" />
            <span>Buy me a Coffee</span>
          </button>
        </div>

        {/* Dynamic and simple Apple styling segment links */}
        <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-semibold">
          <a
            href="https://x.com/Manishxdhurndhr"
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-colors flex items-center gap-1 cursor-pointer ${
              theme === "dark" ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <Twitter className="w-3.5 h-3.5 text-zinc-400" />
            <span>X / Twitter</span>
          </a>

          <span className={theme === "dark" ? "text-zinc-800" : "text-zinc-300"}>|</span>

          <a
            href="https://github.com/ManishDhurandhar"
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-colors flex items-center gap-1 cursor-pointer ${
              theme === "dark" ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <Github className="w-3.5 h-3.5 text-zinc-400" />
            <span>GitHub</span>
          </a>
        </div>

        {/* Total Views at the end of the site */}
        <div className={`mt-1 flex items-center gap-1.5 px-3 py-1 border rounded-full text-[10px] font-mono shadow-2xs ${
          theme === "dark" ? "bg-zinc-950/40 border-zinc-800 text-zinc-400" : "bg-white border-zinc-250 text-zinc-600"
        }`}>
          <Globe className="w-3.5 h-3.5 text-red-600 animate-pulse" />
          <span>Total Site Visitors: <b className={theme === "dark" ? "text-zinc-100" : "text-zinc-950"}>{visitorCount.toLocaleString()}</b></span>
        </div>
      </footer>

      {/* Subtle bottom-left workbench ticker */}
      <div className={`absolute bottom-4 left-4 hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm ${
        theme === "dark" ? "border-zinc-805 bg-zinc-900/50" : "border-zinc-250 bg-white"
      }`}>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className={`text-[9px] font-extrabold uppercase tracking-wide ${
          theme === "dark" ? "text-zinc-400" : "text-zinc-650"
        }`}>
          Sync Status: Online
        </span>
      </div>

    </div>
  );
}
