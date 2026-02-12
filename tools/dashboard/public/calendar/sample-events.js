/**
 * Sample events for Chronos Glyph
 * Run this script to populate the calendar with demo events
 *
 * Usage: node sample-events.js
 */

const path = require('path');
const fs = require('fs');

// Sample events JSON
const sampleEvents = [
  {
    id: 'event-sample-1',
    title: 'Team Standup',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: 30,
    color: 'cyan',
    description: 'Daily team sync'
  },
  {
    id: 'event-sample-2',
    title: 'Project Planning',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    time: '14:00',
    duration: 60,
    color: 'purple',
    description: 'Q1 roadmap planning session'
  },
  {
    id: 'event-sample-3',
    title: 'Van Fund Checkpoint',
    date: new Date(Date.now() + 172800000).toISOString().split('T')[0], // 2 days
    time: '10:00',
    duration: 60,
    color: 'pink',
    description: 'Review progress toward $50k van goal'
  },
  {
    id: 'event-sample-4',
    title: 'Dashboard Dev',
    date: new Date(Date.now() + 259200000).toISOString().split('T')[0], // 3 days
    time: '13:00',
    duration: 120,
    color: 'blue',
    description: 'Continue work on Grand Architect Dashboard v2.5'
  },
  {
    id: 'event-sample-5',
    title: 'Birthday Party',
    date: new Date(Date.now() + 604800000).toISOString().split('T')[0], // 1 week
    time: '18:00',
    duration: 240,
    color: 'green',
    description: 'Celebration at favorites restaurant'
  }
];

// Write to localStorage.json for browser import
const storagePath = path.join(__dirname, 'localStorage.json');

const data = {
  'chronos-events': sampleEvents
};

fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));

console.log('✅ Sample events created in localStorage.json');
console.log('📋 To load them in the browser:');
console.log('   1. Open the calendar app');
console.log('   2. Open DevTools (F12)');
console.log('   3. Run: localStorage.setItem("chronos-events", JSON.stringify(' + JSON.stringify(sampleEvents) + '))');
console.log('   4. Refresh the page');
