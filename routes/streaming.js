const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');

const activeStreams = new Map();

// Start a live stream
router.post('/start', async (req, res) => {
  try {
    const { title, description, channelName } = req.body;
    
    if (!title || !channelName) {
      return res.status(400).json({ error: 'Title and channel name required' });
    }

    const streamId = uuidv4();
    const streamData = {
      id: streamId,
      title,
      description: description || '',
      channelName,
      startTime: new Date(),
      status: 'live',
      viewers: 0
    };

    activeStreams.set(streamId, streamData);
    
    const db = getDB();
    db.run(
      'INSERT INTO streams (id, title, description, channel_name, start_time, status) VALUES (?, ?, ?, ?, ?, ?)',
      [streamId, title, description || '', channelName, new Date().toISOString(), 'live']
    );

    res.json({ success: true, streamId, stream: streamData });
  } catch (error) {
    console.error('Stream start error:', error);
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

// Get active streams
router.get('/active', (req, res) => {
  const streams = Array.from(activeStreams.values());
  res.json({ success: true, streams });
});

// Get stream info
router.get('/:streamId', (req, res) => {
  const { streamId } = req.params;
  const stream = activeStreams.get(streamId);
  
  if (!stream) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  
  res.json({ success: true, stream });
});

// End stream
router.post('/:streamId/end', (req, res) => {
  const { streamId } = req.params;
  const stream = activeStreams.get(streamId);
  
  if (!stream) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  
  stream.status = 'ended';
  stream.endTime = new Date();
  
  const db = getDB();
  db.run('UPDATE streams SET status = ?, end_time = ? WHERE id = ?',
    ['ended', new Date().toISOString(), streamId]
  );
  
  setTimeout(() => activeStreams.delete(streamId), 300000);
  
  res.json({ success: true, message: 'Stream ended' });
});

module.exports = router;