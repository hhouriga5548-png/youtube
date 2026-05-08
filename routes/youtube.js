const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getDB } = require('../db/database');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'youtube-v31.p.rapidapi.com';

// Search YouTube videos using RapidAPI
router.get('/search', async (req, res) => {
  try {
    const { q, maxResults = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const options = {
      method: 'GET',
      url: 'https://youtube-v31.p.rapidapi.com/search',
      params: {
        q: q,
        part: 'snippet',
        regionCode: 'US',
        maxResults: maxResults,
        order: 'relevance'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);

    const videos = response.data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt
    })).filter(v => v.id); // Filter out non-video results

    res.json({ success: true, videos });
  } catch (error) {
    console.error('YouTube search error:', error.message);
    res.status(500).json({ error: 'Failed to search YouTube. Check your RapidAPI key.' });
  }
});

// Get video details
router.get('/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const options = {
      method: 'GET',
      url: 'https://youtube-v31.p.rapidapi.com/videos',
      params: {
        id: videoId,
        part: 'snippet,statistics,contentDetails'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);

    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = response.data.items[0];
    res.json({
      id: videoId,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnail: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high.url,
      channelTitle: video.snippet.channelTitle,
      viewCount: video.statistics.viewCount,
      likeCount: video.statistics.likeCount,
      duration: video.contentDetails.duration,
      publishedAt: video.snippet.publishedAt
    });
  } catch (error) {
    console.error('Video details error:', error.message);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

// Get trending videos
router.get('/trending', async (req, res) => {
  try {
    const options = {
      method: 'GET',
      url: 'https://youtube-v31.p.rapidapi.com/videos',
      params: {
        part: 'snippet,statistics',
        chart: 'mostPopular',
        maxResults: 20,
        regionCode: 'US'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);

    const videos = response.data.items.map(item => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      viewCount: item.statistics.viewCount,
      likeCount: item.statistics.likeCount
    }));

    res.json({ success: true, videos });
  } catch (error) {
    console.error('Trending error:', error.message);
    res.status(500).json({ error: 'Failed to fetch trending videos' });
  }
});

// Get video comments
router.get('/comments/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const options = {
      method: 'GET',
      url: 'https://youtube-v31.p.rapidapi.com/commentThreads',
      params: {
        videoId: videoId,
        part: 'snippet',
        maxResults: 20,
        order: 'relevance'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);

    const comments = response.data.items.map(item => ({
      id: item.id,
      author: item.snippet.topLevelComment.snippet.authorDisplayName,
      text: item.snippet.topLevelComment.snippet.textDisplay,
      likes: item.snippet.topLevelComment.snippet.likeCount,
      publishedAt: item.snippet.topLevelComment.snippet.publishedAt
    }));

    res.json({ success: true, comments });
  } catch (error) {
    console.error('Comments error:', error.message);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

module.exports = router;